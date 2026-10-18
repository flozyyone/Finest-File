//! Persistent SQLite index for fast metadata search and configurable scanning.
//!
//! Stores file metadata (path, name, ext, kind, size, modified, indexed_at)
//! with WAL mode, transactions, schema migrations, and exclusion support.

use crate::error::{ErrorCode, FsError, FsResult};
use crate::model::{entry_from_metadata, EntryKind, FileEntry};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;

pub const SCHEMA_VERSION: i32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexSettings {
    pub enabled: bool,
    pub roots: Vec<String>,
    pub excluded_patterns: Vec<String>,
    pub auto_watch: bool,
}

impl Default for IndexSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            roots: Vec::new(),
            excluded_patterns: vec![
                "node_modules".into(),
                ".git".into(),
                "$RECYCLE.BIN".into(),
                "System Volume Information".into(),
                "AppData\\Local\\Temp".into(),
            ],
            auto_watch: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexStatus {
    pub enabled: bool,
    pub total_files: u64,
    pub total_folders: u64,
    pub total_bytes: u64,
    pub last_scan: Option<i64>,
    pub is_scanning: bool,
    pub scanned_items: u64,
    pub current_path: Option<String>,
}

#[derive(Clone)]
pub struct IndexDb {
    pub(crate) conn: Arc<Mutex<Connection>>,
    db_path: PathBuf,
}

impl IndexDb {
    pub fn open(path: &Path) -> FsResult<Self> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| FsError::io(e, parent))?;
        }
        let conn = Connection::open(path).map_err(FsError::from)?;
        
        // Setup SQLite pragma for performance & concurrency
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA synchronous = NORMAL;
             PRAGMA foreign_keys = ON;
             PRAGMA temp_store = MEMORY;
             PRAGMA mmap_size = 268435456;",
        ).map_err(FsError::from)?;

        let db = Self {
            conn: Arc::new(Mutex::new(conn)),
            db_path: path.to_path_buf(),
        };
        db.migrate()?;
        Ok(db)
    }

    pub fn in_memory() -> FsResult<Self> {
        let conn = Connection::open_in_memory().map_err(FsError::from)?;
        let db = Self {
            conn: Arc::new(Mutex::new(conn)),
            db_path: PathBuf::from(":memory:"),
        };
        db.migrate()?;
        Ok(db)
    }

    fn migrate(&self) -> FsResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "CREATE TABLE IF NOT EXISTS schema_info (
                version INTEGER PRIMARY KEY
            )",
            [],
        ).map_err(FsError::from)?;

        let current_version: Option<i32> = conn
            .query_row("SELECT version FROM schema_info", [], |row| row.get(0))
            .optional()
            .map_err(FsError::from)?;

        match current_version {
            None => {
                conn.execute_batch(
                    "BEGIN TRANSACTION;
                     CREATE TABLE files (
                         id INTEGER PRIMARY KEY AUTOINCREMENT,
                         path TEXT NOT NULL UNIQUE,
                         parent_path TEXT NOT NULL,
                         name TEXT NOT NULL,
                         ext TEXT NOT NULL,
                         kind TEXT NOT NULL,
                         size INTEGER,
                         modified INTEGER,
                         created INTEGER,
                         indexed_at INTEGER NOT NULL
                     );
                     CREATE INDEX idx_files_name ON files(name COLLATE NOCASE);
                     CREATE INDEX idx_files_ext ON files(ext COLLATE NOCASE);
                     CREATE INDEX idx_files_parent ON files(parent_path);
                     CREATE INDEX idx_files_kind ON files(kind);

                     INSERT INTO schema_info (version) VALUES (1);
                     COMMIT;",
                ).map_err(FsError::from)?;
            }
            Some(v) if v < SCHEMA_VERSION => {
                // Future migrations go here
            }
            Some(_) => {}
        }
        Ok(())
    }

    pub fn insert_or_update(&self, entry: &FileEntry, now_ms: i64) -> FsResult<()> {
        let conn = self.conn.lock().unwrap();
        let path = Path::new(&entry.path);
        let parent = path.parent().map(|p| p.to_string_lossy().into_owned()).unwrap_or_default();
        let kind_str = match entry.kind {
            EntryKind::File => "file",
            EntryKind::Directory => "directory",
            EntryKind::Link => "link",
        };

        conn.execute(
            "INSERT INTO files (path, parent_path, name, ext, kind, size, modified, created, indexed_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
             ON CONFLICT(path) DO UPDATE SET
                parent_path = excluded.parent_path,
                name = excluded.name,
                ext = excluded.ext,
                kind = excluded.kind,
                size = excluded.size,
                modified = excluded.modified,
                created = excluded.created,
                indexed_at = excluded.indexed_at",
            params![
                entry.path,
                parent,
                entry.name,
                entry.ext,
                kind_str,
                entry.size.map(|s| s as i64),
                entry.modified,
                entry.created,
                now_ms,
            ],
        ).map_err(FsError::from)?;
        Ok(())
    }

    pub fn delete_path(&self, path: &str) -> FsResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM files WHERE path = ?1 OR path LIKE ?2", params![path, format!("{path}\\%")])
            .map_err(FsError::from)?;
        Ok(())
    }

    pub fn count_stats(&self) -> FsResult<(u64, u64, u64)> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT 
                COUNT(CASE WHEN kind = 'file' THEN 1 END),
                COUNT(CASE WHEN kind = 'directory' THEN 1 END),
                COALESCE(SUM(CASE WHEN kind = 'file' THEN size ELSE 0 END), 0)
             FROM files"
        ).map_err(FsError::from)?;

        let row = stmt.query_row([], |r| {
            Ok((
                r.get::<_, i64>(0)? as u64,
                r.get::<_, i64>(1)? as u64,
                r.get::<_, i64>(2)? as u64,
            ))
        }).map_err(FsError::from)?;
        Ok(row)
    }

    pub fn clear(&self) -> FsResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM files", []).map_err(FsError::from)?;
        Ok(())
    }
}

pub struct ScannerState {
    pub is_scanning: AtomicBool,
    pub cancel_flag: AtomicBool,
    pub scanned_count: Mutex<u64>,
    pub current_path: Mutex<Option<String>>,
}

impl Default for ScannerState {
    fn default() -> Self {
        Self {
            is_scanning: AtomicBool::new(false),
            cancel_flag: AtomicBool::new(false),
            scanned_count: Mutex::new(0),
            current_path: Mutex::new(None),
        }
    }
}

pub fn scan_roots(
    db: IndexDb,
    settings: IndexSettings,
    state: Arc<ScannerState>,
) -> FsResult<()> {
    if !settings.enabled || settings.roots.is_empty() {
        return Ok(());
    }
    state.is_scanning.store(true, Ordering::SeqCst);
    state.cancel_flag.store(false, Ordering::SeqCst);
    *state.scanned_count.lock().unwrap() = 0;

    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);

    let res = run_scan(&db, &settings, &state, now_ms);
    state.is_scanning.store(false, Ordering::SeqCst);
    *state.current_path.lock().unwrap() = None;
    res
}

fn run_scan(
    db: &IndexDb,
    settings: &IndexSettings,
    state: &ScannerState,
    now_ms: i64,
) -> FsResult<()> {
    let mut batch = Vec::with_capacity(500);

    for root_str in &settings.roots {
        let root = Path::new(root_str);
        if !root.exists() {
            continue;
        }

        let mut stack = vec![root.to_path_buf()];

        while let Some(dir) = stack.pop() {
            if state.cancel_flag.load(Ordering::Relaxed) {
                return Err(FsError::cancelled());
            }

            *state.current_path.lock().unwrap() = Some(dir.to_string_lossy().into_owned());

            let Ok(rd) = fs::read_dir(&dir) else {
                continue;
            };

            for item in rd.flatten() {
                if state.cancel_flag.load(Ordering::Relaxed) {
                    return Err(FsError::cancelled());
                }

                let path = item.path();
                let path_str = path.to_string_lossy();

                // Check exclusions
                if settings.excluded_patterns.iter().any(|pat| path_str.contains(pat)) {
                    continue;
                }

                let Ok(md) = item.metadata() else {
                    continue;
                };

                let name = item.file_name().to_string_lossy().into_owned();
                let entry = entry_from_metadata(&path, name, &md);

                if entry.kind == EntryKind::Directory && !entry.link_to_dir {
                    stack.push(path.clone());
                }

                batch.push(entry);
                *state.scanned_count.lock().unwrap() += 1;

                if batch.len() >= 500 {
                    flush_batch(db, &mut batch, now_ms)?;
                }
            }
        }
    }

    if !batch.is_empty() {
        flush_batch(db, &mut batch, now_ms)?;
    }
    Ok(())
}

fn flush_batch(db: &IndexDb, batch: &mut Vec<FileEntry>, now_ms: i64) -> FsResult<()> {
    let mut conn = db.conn.lock().unwrap();
    let tx = conn.transaction().map_err(FsError::from)?;
    {
        let mut stmt = tx.prepare(
            "INSERT INTO files (path, parent_path, name, ext, kind, size, modified, created, indexed_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
             ON CONFLICT(path) DO UPDATE SET
                parent_path = excluded.parent_path,
                name = excluded.name,
                ext = excluded.ext,
                kind = excluded.kind,
                size = excluded.size,
                modified = excluded.modified,
                created = excluded.created,
                indexed_at = excluded.indexed_at"
        ).map_err(FsError::from)?;

        for entry in batch.drain(..) {
            let path = Path::new(&entry.path);
            let parent = path.parent().map(|p| p.to_string_lossy().into_owned()).unwrap_or_default();
            let kind_str = match entry.kind {
                EntryKind::File => "file",
                EntryKind::Directory => "directory",
                EntryKind::Link => "link",
            };

            stmt.execute(params![
                entry.path,
                parent,
                entry.name,
                entry.ext,
                kind_str,
                entry.size.map(|s| s as i64),
                entry.modified,
                entry.created,
                now_ms,
            ]).map_err(FsError::from)?;
        }
    }
    tx.commit().map_err(FsError::from)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_index_db_basic() {
        let db = IndexDb::in_memory().unwrap();
        let (f, d, b) = db.count_stats().unwrap();
        assert_eq!(f, 0);
        assert_eq!(d, 0);
        assert_eq!(b, 0);

        let entry = FileEntry {
            name: "test.txt".into(),
            path: "C:\\test\\test.txt".into(),
            ext: "txt".into(),
            kind: EntryKind::File,
            link_to_dir: false,
            size: Some(1024),
            modified: Some(123456),
            created: Some(123456),
            hidden: false,
            system: false,
            readonly: false,
        };

        db.insert_or_update(&entry, 1000).unwrap();
        let (f, d, b) = db.count_stats().unwrap();
        assert_eq!(f, 1);
        assert_eq!(d, 0);
        assert_eq!(b, 1024);

        db.delete_path("C:\\test\\test.txt").unwrap();
        let (f, _, _) = db.count_stats().unwrap();
        assert_eq!(f, 0);
    }
}
