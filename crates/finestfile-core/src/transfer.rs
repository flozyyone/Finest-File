//! Copy and move with progress, cancellation, conflict policies and
//! verify-before-delete for cross-volume moves.

use crate::error::{ErrorCode, FsError, FsResult};
use crate::jobs::JobCtx;
use crate::listing::display_name;
use crate::names::{exists_no_follow, unique_path};
use crate::platform::move_no_replace;
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConflictPolicy {
    /// Leave the existing destination untouched and skip the source item.
    Skip,
    /// Replace existing files; existing folders are merged.
    Replace,
    /// Give the incoming item a new name: "name (2).ext".
    KeepBoth,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TransferMode {
    Copy,
    Move,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConflictReport {
    /// Top-level source names that already exist in the destination.
    pub conflicts: Vec<String>,
    /// Items being moved into the folder they are already in (no-ops).
    pub same_location: Vec<String>,
}

const BUF: usize = 1024 * 1024;
const PART_SUFFIX: &str = ".ffpart";

fn is_inside(child: &Path, parent: &Path) -> bool {
    let c = child.to_string_lossy().to_lowercase();
    let p = parent.to_string_lossy().to_lowercase();
    let p = p.trim_end_matches('\\');
    c == p || c.starts_with(&format!("{p}\\")) || c.starts_with(&format!("{p}/"))
}

fn same_path(a: &Path, b: &Path) -> bool {
    a.to_string_lossy().trim_end_matches('\\').eq_ignore_ascii_case(b.to_string_lossy().trim_end_matches('\\'))
}

/// Validates a transfer and lists top-level name conflicts so the UI can ask
/// the user *before* anything is written.
pub fn check_conflicts(sources: &[PathBuf], dest_dir: &Path, mode: TransferMode) -> FsResult<ConflictReport> {
    let md = fs::metadata(dest_dir).map_err(|e| FsError::io(e, dest_dir))?;
    if !md.is_dir() {
        return Err(FsError::new(ErrorCode::NotADirectory, "The destination is not a folder.").with_path(dest_dir));
    }
    let mut report = ConflictReport { conflicts: vec![], same_location: vec![] };
    for src in sources {
        let smd = fs::symlink_metadata(src).map_err(|e| FsError::io(e, src))?;
        if smd.is_dir() && !smd.file_type().is_symlink() && is_inside(dest_dir, src) {
            return Err(FsError::new(
                ErrorCode::DestinationInsideSource,
                format!("\"{}\" cannot be placed inside itself.", display_name(src)),
            )
            .with_path(src));
        }
        let name = display_name(src);
        if src.parent().is_some_and(|p| same_path(p, dest_dir)) {
            if mode == TransferMode::Move {
                report.same_location.push(name);
            }
            // Copy into the same folder always creates "name (2)", never a conflict prompt.
            continue;
        }
        if exists_no_follow(&dest_dir.join(&name)) {
            report.conflicts.push(name);
        }
    }
    Ok(report)
}

/// One planned unit of work.
enum Step {
    Dir { dst: PathBuf },
    File { src: PathBuf, dst: PathBuf, len: u64 },
}

/// Runs a copy or move job.
pub fn run_transfer(
    sources: &[PathBuf],
    dest_dir: &Path,
    mode: TransferMode,
    policy: ConflictPolicy,
    ctx: &JobCtx,
) -> FsResult<()> {
    check_conflicts(sources, dest_dir, mode)?;
    ctx.affect_dir(dest_dir);

    // Phase 1: same-volume moves are instant renames; resolve them first.
    let mut needs_copy: Vec<(PathBuf, PathBuf, bool)> = Vec::new(); // (src, dst, delete_source_after)
    for src in sources {
        ctx.check()?;
        let name = display_name(src);
        let same_dir = src.parent().is_some_and(|p| same_path(p, dest_dir));
        if mode == TransferMode::Move && same_dir {
            continue; // moving into its own folder is a no-op
        }
        if let Some(parent) = src.parent() {
            if mode == TransferMode::Move {
                ctx.affect_dir(parent);
            }
        }
        let mut dst = dest_dir.join(&name);
        let mut merge = false;
        if exists_no_follow(&dst) {
            if same_dir {
                dst = unique_path(dest_dir, &name);
            } else {
                match policy {
                    ConflictPolicy::Skip => {
                        ctx.warn(format!("Skipped \"{name}\" (already exists)."));
                        continue;
                    }
                    ConflictPolicy::KeepBoth => dst = unique_path(dest_dir, &name),
                    ConflictPolicy::Replace => {
                        let sdir = fs::symlink_metadata(src).map(|m| m.is_dir()).unwrap_or(false);
                        let ddir = fs::symlink_metadata(&dst).map(|m| m.is_dir()).unwrap_or(false);
                        if sdir && ddir {
                            merge = true;
                        } else if sdir != ddir {
                            return Err(FsError::new(
                                ErrorCode::AlreadyExists,
                                format!("\"{name}\" cannot replace an item of a different type."),
                            )
                            .with_path(&dst));
                        }
                    }
                }
            }
        }
        if mode == TransferMode::Move && !merge {
            if !exists_no_follow(&dst) {
                match move_no_replace(src, &dst) {
                    Ok(()) => {
                        ctx.item_done();
                        continue;
                    }
                    Err(e) if e.code == ErrorCode::CrossDevice => {}
                    Err(e) if e.code == ErrorCode::PermissionDenied => return Err(e),
                    Err(e) if e.code == ErrorCode::NotFound => return Err(e),
                    Err(_) => {} // fall back to copy + verify + delete
                }
            } else if let Ok(md) = fs::symlink_metadata(src) {
                if md.is_file() {
                    // Replace a file on the same volume via backup-and-swap.
                    if replace_by_rename(src, &dst).is_ok() {
                        ctx.item_done();
                        continue;
                    }
                }
            }
        }
        needs_copy.push((src.clone(), dst, mode == TransferMode::Move));
    }

    if needs_copy.is_empty() {
        return Ok(());
    }

    // Phase 2: plan copies (measures real totals for progress).
    let mut steps = Vec::new();
    let (mut total_bytes, mut total_items) = (0u64, 0u64);
    for (src, dst, _) in &needs_copy {
        plan(src, dst, &mut steps, &mut total_bytes, &mut total_items, ctx)?;
    }
    ctx.set_totals(total_bytes, total_items);

    // Phase 3: execute.
    let replace = policy == ConflictPolicy::Replace;
    for step in &steps {
        ctx.check()?;
        match step {
            Step::Dir { dst } => {
                if !dst.is_dir() {
                    fs::create_dir(dst).map_err(|e| FsError::io(e, dst))?;
                }
                ctx.item_done();
            }
            Step::File { src, dst, len } => {
                ctx.set_current(display_name(src));
                if exists_no_follow(dst) && !replace {
                    ctx.warn(format!("Skipped \"{}\" (already exists).", dst.display()));
                    ctx.add_bytes(*len);
                } else {
                    copy_file(src, dst, ctx)?;
                }
                ctx.item_done();
            }
        }
    }

    // Phase 4: for moves, verify every copied file then delete the sources.
    for (src, dst, delete_after) in &needs_copy {
        if !*delete_after {
            continue;
        }
        verify_tree(src, dst)?;
        crate::ops::delete_permanently(src)?;
    }
    Ok(())
}

fn plan(src: &Path, dst: &Path, steps: &mut Vec<Step>, bytes: &mut u64, items: &mut u64, ctx: &JobCtx) -> FsResult<()> {
    let md = fs::symlink_metadata(src).map_err(|e| FsError::io(e, src))?;
    if md.file_type().is_symlink() {
        ctx.warn(format!("Skipped link \"{}\" (links are not followed).", src.display()));
        return Ok(());
    }
    if md.is_file() {
        steps.push(Step::File { src: src.to_path_buf(), dst: dst.to_path_buf(), len: md.len() });
        *bytes += md.len();
        *items += 1;
        return Ok(());
    }
    steps.push(Step::Dir { dst: dst.to_path_buf() });
    *items += 1;
    let rd = fs::read_dir(src).map_err(|e| FsError::io(e, src))?;
    for e in rd {
        ctx.check()?;
        let e = e.map_err(|e| FsError::io(e, src))?;
        plan(&e.path(), &dst.join(e.file_name()), steps, bytes, items, ctx)?;
    }
    Ok(())
}

/// Copies one file through a temporary ".ffpart" file and only then gives it
/// its final name, so an interrupted copy never leaves a truncated file that
/// looks complete.
pub fn copy_file(src: &Path, dst: &Path, ctx: &JobCtx) -> FsResult<()> {
    let parent = dst.parent().unwrap_or(Path::new("."));
    let tmp = unique_path(parent, &format!("{}{PART_SUFFIX}", display_name(dst)));
    let result = (|| {
        let mut input = File::open(src).map_err(|e| FsError::io(e, src))?;
        let src_md = input.metadata().map_err(|e| FsError::io(e, src))?;
        let mut out = fs::OpenOptions::new().write(true).create_new(true).open(&tmp).map_err(|e| FsError::io(e, &tmp))?;
        let mut buf = vec![0u8; BUF.min(src_md.len().max(4096) as usize)];
        loop {
            ctx.check()?;
            let n = input.read(&mut buf).map_err(|e| FsError::io(e, src))?;
            if n == 0 {
                break;
            }
            out.write_all(&buf[..n]).map_err(|e| FsError::io(e, &tmp))?;
            ctx.add_bytes(n as u64);
        }
        out.flush().map_err(|e| FsError::io(e, &tmp))?;
        if let Ok(m) = src_md.modified() {
            let _ = out.set_modified(m);
        }
        drop(out);
        let copied = fs::metadata(&tmp).map_err(|e| FsError::io(e, &tmp))?.len();
        if copied != src_md.len() {
            return Err(FsError::new(ErrorCode::Io, format!("Copy of \"{}\" is incomplete.", src.display())).with_path(src));
        }
        if exists_no_follow(dst) {
            replace_by_rename(&tmp, dst)?;
        } else {
            move_no_replace(&tmp, dst)?;
        }
        if src_md.permissions().readonly() {
            let mut p = fs::metadata(dst).map_err(|e| FsError::io(e, dst))?.permissions();
            p.set_readonly(true);
            let _ = fs::set_permissions(dst, p);
        }
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&tmp);
    }
    result
}

/// Replaces `dst` with `src` safely: `dst` is first renamed to a backup, then
/// `src` is moved in, and the backup is removed. On failure the backup is restored.
fn replace_by_rename(src: &Path, dst: &Path) -> FsResult<()> {
    let parent = dst.parent().unwrap_or(Path::new("."));
    let backup = unique_path(parent, &format!("{}.ffbak", display_name(dst)));
    move_no_replace(dst, &backup)?;
    match move_no_replace(src, dst) {
        Ok(()) => {
            let _ = crate::ops::delete_permanently(&backup);
            Ok(())
        }
        Err(e) => {
            let _ = move_no_replace(&backup, dst);
            Err(e)
        }
    }
}

/// Confirms every file in `src` has a same-sized counterpart in `dst`.
fn verify_tree(src: &Path, dst: &Path) -> FsResult<()> {
    let md = fs::symlink_metadata(src).map_err(|e| FsError::io(e, src))?;
    if md.file_type().is_symlink() {
        return Ok(());
    }
    if md.is_file() {
        let d = fs::metadata(dst).map_err(|e| FsError::io(e, dst))?;
        if d.len() != md.len() {
            return Err(FsError::new(
                ErrorCode::Io,
                format!("Verification failed for \"{}\"; the source was kept.", src.display()),
            )
            .with_path(src));
        }
        return Ok(());
    }
    for e in fs::read_dir(src).map_err(|e| FsError::io(e, src))? {
        let e = e.map_err(|e| FsError::io(e, src))?;
        verify_tree(&e.path(), &dst.join(e.file_name()))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::jobs::{tests::NullSink, JobKind, JobManager, JobState};
    use std::sync::Arc;
    use std::time::Duration;

    fn run(srcs: Vec<PathBuf>, dest: &Path, mode: TransferMode, policy: ConflictPolicy) -> crate::jobs::JobProgress {
        let m = JobManager::new(1, Arc::new(NullSink));
        let d = dest.to_path_buf();
        let id = m.submit(JobKind::Copy, "t", move |ctx| run_transfer(&srcs, &d, mode, policy, ctx));
        m.wait(id, Duration::from_secs(30)).unwrap()
    }

    fn tree(root: &Path) {
        fs::create_dir_all(root.join("sub/deeper")).unwrap();
        fs::write(root.join("a.txt"), "alpha").unwrap();
        fs::write(root.join("sub/ü.bin"), vec![7u8; 3 * 1024 * 1024 + 17]).unwrap();
        fs::write(root.join("sub/deeper/z.txt"), "zed").unwrap();
    }

    #[test]
    fn copy_tree_and_keep_both() {
        let t = tempfile::tempdir().unwrap();
        let src = t.path().join("src");
        let dst = t.path().join("dst");
        tree(&src);
        fs::create_dir(&dst).unwrap();
        let p = run(vec![src.clone()], &dst, TransferMode::Copy, ConflictPolicy::Skip);
        assert_eq!(p.state, JobState::Completed, "{:?}", p.error);
        assert_eq!(fs::read(dst.join("src/sub/ü.bin")).unwrap().len(), 3 * 1024 * 1024 + 17);
        assert_eq!(p.bytes_done, p.bytes_total);
        // No temp files left behind.
        assert!(!fs::read_dir(dst.join("src/sub")).unwrap().any(|e| e.unwrap().file_name().to_string_lossy().contains(".ffpart")));

        let p = run(vec![src.clone()], &dst, TransferMode::Copy, ConflictPolicy::KeepBoth);
        assert_eq!(p.state, JobState::Completed);
        assert!(dst.join("src (2)/sub/deeper/z.txt").exists());
        assert!(src.join("a.txt").exists());
    }

    #[test]
    fn copy_into_same_folder_makes_copy() {
        let t = tempfile::tempdir().unwrap();
        let f = t.path().join("doc.txt");
        fs::write(&f, "x").unwrap();
        let p = run(vec![f.clone()], t.path(), TransferMode::Copy, ConflictPolicy::Skip);
        assert_eq!(p.state, JobState::Completed);
        assert!(t.path().join("doc (2).txt").exists());
    }

    #[test]
    fn skip_and_replace() {
        let t = tempfile::tempdir().unwrap();
        let a = t.path().join("a");
        let b = t.path().join("b");
        fs::create_dir_all(&a).unwrap();
        fs::create_dir_all(&b).unwrap();
        fs::write(a.join("f.txt"), "new").unwrap();
        fs::write(b.join("f.txt"), "old").unwrap();
        run(vec![a.join("f.txt")], &b, TransferMode::Copy, ConflictPolicy::Skip);
        assert_eq!(fs::read_to_string(b.join("f.txt")).unwrap(), "old");
        run(vec![a.join("f.txt")], &b, TransferMode::Copy, ConflictPolicy::Replace);
        assert_eq!(fs::read_to_string(b.join("f.txt")).unwrap(), "new");
        assert_eq!(fs::read_dir(&b).unwrap().count(), 1, "no backup leftovers");
    }

    #[test]
    fn move_same_volume_and_merge() {
        let t = tempfile::tempdir().unwrap();
        let src = t.path().join("src");
        let dst = t.path().join("dst");
        tree(&src);
        fs::create_dir_all(dst.join("src/sub")).unwrap();
        fs::write(dst.join("src/keep.txt"), "keep").unwrap();
        let p = run(vec![src.clone()], &dst, TransferMode::Move, ConflictPolicy::Replace);
        assert_eq!(p.state, JobState::Completed, "{:?}", p.error);
        assert!(!src.exists());
        assert!(dst.join("src/keep.txt").exists());
        assert!(dst.join("src/sub/deeper/z.txt").exists());

        let f = t.path().join("plain.txt");
        fs::write(&f, "p").unwrap();
        let p = run(vec![f.clone()], &dst, TransferMode::Move, ConflictPolicy::Skip);
        assert_eq!(p.state, JobState::Completed);
        assert!(!f.exists() && dst.join("plain.txt").exists());
    }

    #[test]
    fn refuses_copy_into_itself() {
        let t = tempfile::tempdir().unwrap();
        let src = t.path().join("src");
        tree(&src);
        let e = check_conflicts(&[src.clone()], &src.join("sub"), TransferMode::Copy).unwrap_err();
        assert_eq!(e.code, ErrorCode::DestinationInsideSource);
    }

    #[test]
    fn reports_conflicts() {
        let t = tempfile::tempdir().unwrap();
        let a = t.path().join("a");
        let b = t.path().join("b");
        fs::create_dir_all(&a).unwrap();
        fs::create_dir_all(&b).unwrap();
        fs::write(a.join("x"), "").unwrap();
        fs::write(b.join("x"), "").unwrap();
        let r = check_conflicts(&[a.join("x")], &b, TransferMode::Copy).unwrap();
        assert_eq!(r.conflicts, vec!["x".to_string()]);
        let r = check_conflicts(&[a.join("x")], &a, TransferMode::Move).unwrap();
        assert_eq!(r.same_location, vec!["x".to_string()]);
    }

    #[test]
    fn cancel_leaves_no_partial_file() {
        let t = tempfile::tempdir().unwrap();
        let big = t.path().join("big.bin");
        fs::write(&big, vec![1u8; 64 * 1024 * 1024]).unwrap();
        let dst = t.path().join("dst");
        fs::create_dir(&dst).unwrap();
        let m = JobManager::new(1, Arc::new(NullSink));
        let (s, d) = (vec![big.clone()], dst.clone());
        let id = m.submit(JobKind::Copy, "t", move |ctx| {
            ctx.check()?;
            run_transfer(&s, &d, TransferMode::Copy, ConflictPolicy::Skip, ctx)
        });
        m.cancel(id);
        let p = m.wait(id, Duration::from_secs(30)).unwrap();
        assert_eq!(p.state, JobState::Cancelled);
        assert_eq!(fs::read_dir(&dst).unwrap().count(), 0);
    }
}
