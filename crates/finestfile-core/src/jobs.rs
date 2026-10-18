//! Background job queue with bounded concurrency, throttled progress reporting
//! and cooperative cancellation.

use crate::error::{ErrorCode, FsError, FsResult};
use serde::Serialize;
use std::collections::{HashMap, VecDeque};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Condvar, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum JobKind {
    Copy,
    Move,
    Delete,
    Trash,
    CreateArchive,
    ExtractArchive,
    FolderSize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum JobState {
    Queued,
    Running,
    Completed,
    Failed,
    Cancelled,
}

impl JobState {
    pub fn is_finished(self) -> bool {
        matches!(self, JobState::Completed | JobState::Failed | JobState::Cancelled)
    }
}

const MAX_WARNINGS: usize = 50;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobProgress {
    pub id: u64,
    pub kind: JobKind,
    pub title: String,
    pub state: JobState,
    pub bytes_done: u64,
    pub bytes_total: u64,
    pub items_done: u64,
    pub items_total: u64,
    pub current: Option<String>,
    pub error: Option<FsError>,
    pub warnings: Vec<String>,
    pub warning_count: u64,
    /// Paths the UI should refresh when the job finishes.
    pub affected_dirs: Vec<String>,
    /// Optional result payload (e.g. created archive path, folder size JSON).
    pub result: Option<serde_json::Value>,
    pub started_at: Option<i64>,
    pub finished_at: Option<i64>,
}

/// Receives job progress snapshots (implemented by the UI layer).
pub trait JobSink: Send + Sync + 'static {
    fn update(&self, progress: &JobProgress);
}

/// Handle passed to running jobs.
pub struct JobCtx {
    cancel: Arc<AtomicBool>,
    state: Arc<Mutex<JobProgress>>,
    sink: Arc<dyn JobSink>,
    last_emit: Mutex<Instant>,
}

impl JobCtx {
    pub fn is_cancelled(&self) -> bool {
        self.cancel.load(Ordering::Relaxed)
    }

    pub fn check(&self) -> FsResult<()> {
        if self.is_cancelled() {
            Err(FsError::cancelled())
        } else {
            Ok(())
        }
    }

    pub fn set_totals(&self, bytes: u64, items: u64) {
        let mut s = self.state.lock().unwrap();
        s.bytes_total = bytes;
        s.items_total = items;
        drop(s);
        self.emit(true);
    }

    pub fn add_bytes(&self, n: u64) {
        self.state.lock().unwrap().bytes_done += n;
        self.emit(false);
    }

    pub fn item_done(&self) {
        self.state.lock().unwrap().items_done += 1;
        self.emit(false);
    }

    pub fn set_current(&self, s: impl Into<String>) {
        self.state.lock().unwrap().current = Some(s.into());
        self.emit(false);
    }

    pub fn warn(&self, msg: impl Into<String>) {
        let mut s = self.state.lock().unwrap();
        s.warning_count += 1;
        if s.warnings.len() < MAX_WARNINGS {
            s.warnings.push(msg.into());
        }
    }

    pub fn affect_dir(&self, dir: &std::path::Path) {
        let d = dir.to_string_lossy().into_owned();
        let mut s = self.state.lock().unwrap();
        if !s.affected_dirs.contains(&d) {
            s.affected_dirs.push(d);
        }
    }

    pub fn set_result(&self, v: serde_json::Value) {
        self.state.lock().unwrap().result = Some(v);
    }

    /// Emits at most every 100 ms unless forced.
    fn emit(&self, force: bool) {
        let mut last = self.last_emit.lock().unwrap();
        if force || last.elapsed() >= Duration::from_millis(100) {
            *last = Instant::now();
            drop(last);
            let snapshot = self.state.lock().unwrap().clone();
            self.sink.update(&snapshot);
        }
    }
}

type JobFn = Box<dyn FnOnce(&JobCtx) -> FsResult<()> + Send + 'static>;

struct Entry {
    progress: Arc<Mutex<JobProgress>>,
    cancel: Arc<AtomicBool>,
}

struct Inner {
    jobs: Mutex<HashMap<u64, Entry>>,
    queue: Mutex<VecDeque<(u64, JobFn)>>,
    cv: Condvar,
    next_id: AtomicU64,
    sink: Arc<dyn JobSink>,
    shutdown: AtomicBool,
}

#[derive(Clone)]
pub struct JobManager {
    inner: Arc<Inner>,
}

fn now_ms() -> i64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as i64).unwrap_or(0)
}

impl JobManager {
    /// Starts `workers` background threads (bounded concurrency).
    pub fn new(workers: usize, sink: Arc<dyn JobSink>) -> Self {
        let inner = Arc::new(Inner {
            jobs: Mutex::new(HashMap::new()),
            queue: Mutex::new(VecDeque::new()),
            cv: Condvar::new(),
            next_id: AtomicU64::new(1),
            sink,
            shutdown: AtomicBool::new(false),
        });
        for i in 0..workers.max(1) {
            let inner = inner.clone();
            std::thread::Builder::new()
                .name(format!("ff-job-{i}"))
                .spawn(move || worker(inner))
                .expect("spawn job worker");
        }
        Self { inner }
    }

    pub fn submit<F>(&self, kind: JobKind, title: impl Into<String>, f: F) -> u64
    where
        F: FnOnce(&JobCtx) -> FsResult<()> + Send + 'static,
    {
        let id = self.inner.next_id.fetch_add(1, Ordering::Relaxed);
        let progress = JobProgress {
            id,
            kind,
            title: title.into(),
            state: JobState::Queued,
            bytes_done: 0,
            bytes_total: 0,
            items_done: 0,
            items_total: 0,
            current: None,
            error: None,
            warnings: Vec::new(),
            warning_count: 0,
            affected_dirs: Vec::new(),
            result: None,
            started_at: None,
            finished_at: None,
        };
        self.inner.sink.update(&progress);
        self.inner.jobs.lock().unwrap().insert(
            id,
            Entry { progress: Arc::new(Mutex::new(progress)), cancel: Arc::new(AtomicBool::new(false)) },
        );
        self.inner.queue.lock().unwrap().push_back((id, Box::new(f)));
        self.inner.cv.notify_one();
        id
    }

    pub fn cancel(&self, id: u64) -> bool {
        let jobs = self.inner.jobs.lock().unwrap();
        let Some(e) = jobs.get(&id) else { return false };
        e.cancel.store(true, Ordering::Relaxed);
        // A queued job is finalised immediately.
        let mut p = e.progress.lock().unwrap();
        if p.state == JobState::Queued {
            p.state = JobState::Cancelled;
            p.finished_at = Some(now_ms());
            self.inner.sink.update(&p);
        }
        true
    }

    pub fn list(&self) -> Vec<JobProgress> {
        let jobs = self.inner.jobs.lock().unwrap();
        let mut v: Vec<_> = jobs.values().map(|e| e.progress.lock().unwrap().clone()).collect();
        v.sort_by_key(|p| p.id);
        v
    }

    pub fn clear_finished(&self) {
        self.inner.jobs.lock().unwrap().retain(|_, e| !e.progress.lock().unwrap().state.is_finished());
    }

    pub fn active_count(&self) -> usize {
        self.inner.jobs.lock().unwrap().values().filter(|e| !e.progress.lock().unwrap().state.is_finished()).count()
    }

    /// Blocks until the job finishes (used by tests and CLI tools).
    pub fn wait(&self, id: u64, timeout: Duration) -> Option<JobProgress> {
        let start = Instant::now();
        loop {
            let p = self.inner.jobs.lock().unwrap().get(&id).map(|e| e.progress.lock().unwrap().clone())?;
            if p.state.is_finished() {
                return Some(p);
            }
            if start.elapsed() > timeout {
                return None;
            }
            std::thread::sleep(Duration::from_millis(10));
        }
    }
}

impl Drop for Inner {
    fn drop(&mut self) {
        self.shutdown.store(true, Ordering::Relaxed);
    }
}

fn worker(inner: Arc<Inner>) {
    loop {
        let (id, f) = {
            let mut q = inner.queue.lock().unwrap();
            loop {
                if inner.shutdown.load(Ordering::Relaxed) {
                    return;
                }
                if let Some(item) = q.pop_front() {
                    break item;
                }
                q = inner.cv.wait_timeout(q, Duration::from_secs(5)).unwrap().0;
            }
        };
        let (progress, cancel) = {
            let jobs = inner.jobs.lock().unwrap();
            match jobs.get(&id) {
                Some(e) => (e.progress.clone(), e.cancel.clone()),
                None => continue,
            }
        };
        if cancel.load(Ordering::Relaxed) {
            continue; // already finalised as cancelled
        }
        {
            let mut p = progress.lock().unwrap();
            p.state = JobState::Running;
            p.started_at = Some(now_ms());
            inner.sink.update(&p);
        }
        let ctx = JobCtx {
            cancel: cancel.clone(),
            state: progress.clone(),
            sink: inner.sink.clone(),
            last_emit: Mutex::new(Instant::now() - Duration::from_secs(1)),
        };
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| f(&ctx)));
        let mut p = progress.lock().unwrap();
        p.finished_at = Some(now_ms());
        p.current = None;
        match result {
            Ok(Ok(())) => p.state = JobState::Completed,
            Ok(Err(e)) if e.code == ErrorCode::Cancelled => p.state = JobState::Cancelled,
            Ok(Err(e)) => {
                p.state = JobState::Failed;
                p.error = Some(e);
            }
            Err(_) => {
                p.state = JobState::Failed;
                p.error = Some(FsError::new(ErrorCode::Io, "The operation failed unexpectedly."));
            }
        }
        inner.sink.update(&p);
    }
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;

    pub struct NullSink;
    impl JobSink for NullSink {
        fn update(&self, _p: &JobProgress) {}
    }

    #[test]
    fn runs_and_cancels() {
        let m = JobManager::new(1, Arc::new(NullSink));
        let ok = m.submit(JobKind::Copy, "ok", |ctx| {
            ctx.set_totals(10, 1);
            ctx.add_bytes(10);
            Ok(())
        });
        let p = m.wait(ok, Duration::from_secs(5)).unwrap();
        assert_eq!(p.state, JobState::Completed);
        assert_eq!(p.bytes_done, 10);

        let slow = m.submit(JobKind::Copy, "slow", |ctx| loop {
            ctx.check()?;
            std::thread::sleep(Duration::from_millis(5));
        });
        std::thread::sleep(Duration::from_millis(50));
        m.cancel(slow);
        assert_eq!(m.wait(slow, Duration::from_secs(5)).unwrap().state, JobState::Cancelled);

        let fail = m.submit(JobKind::Copy, "fail", |_| Err(FsError::new(ErrorCode::Io, "boom")));
        let p = m.wait(fail, Duration::from_secs(5)).unwrap();
        assert_eq!(p.state, JobState::Failed);
        assert_eq!(p.error.unwrap().message, "boom");
    }
}
