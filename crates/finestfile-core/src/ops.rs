//! Small synchronous operations: create folder, rename, delete.

use crate::error::{ErrorCode, FsError, FsResult};
use crate::names::{exists_no_follow, unique_path, validate_name};
use crate::platform;
use std::fs;
use std::path::{Path, PathBuf};

/// Creates a new folder. When `name` is `None`, a unique "New folder" name is chosen.
pub fn create_folder(parent: &Path, name: Option<&str>) -> FsResult<PathBuf> {
    let target = match name {
        Some(n) => {
            validate_name(n)?;
            let t = parent.join(n);
            if exists_no_follow(&t) {
                return Err(FsError::new(ErrorCode::AlreadyExists, format!("\"{n}\" already exists here.")).with_path(&t));
            }
            t
        }
        None => unique_path(parent, "New folder"),
    };
    fs::create_dir(&target).map_err(|e| FsError::io(e, &target))?;
    Ok(target)
}

/// Creates an empty file with a unique name (for "New > Text document").
pub fn create_file(parent: &Path, name: &str) -> FsResult<PathBuf> {
    validate_name(name)?;
    let target = unique_path(parent, name);
    fs::OpenOptions::new().write(true).create_new(true).open(&target).map_err(|e| FsError::io(e, &target))?;
    Ok(target)
}

/// Renames within the same folder. Never overwrites an existing item; a
/// case-only change ("a.txt" -> "A.txt") is allowed.
pub fn rename(path: &Path, new_name: &str) -> FsResult<PathBuf> {
    validate_name(new_name)?;
    let parent = path.parent().ok_or_else(|| FsError::new(ErrorCode::InvalidPath, "Drive roots cannot be renamed here."))?;
    let target = parent.join(new_name);
    if target == path {
        return Ok(target);
    }
    if !exists_no_follow(path) {
        return Err(FsError::new(ErrorCode::NotFound, format!("\"{}\" no longer exists.", path.display())).with_path(path));
    }
    platform::move_no_replace(path, &target)?;
    Ok(target)
}

/// Moves items to the Recycle Bin.
pub fn trash(paths: &[PathBuf]) -> FsResult<()> {
    for p in paths {
        if !exists_no_follow(p) {
            return Err(FsError::new(ErrorCode::NotFound, format!("\"{}\" no longer exists.", p.display())).with_path(p));
        }
    }
    trash::delete_all(paths).map_err(|e| {
        let first = paths.first().map(|p| p.as_path()).unwrap_or(Path::new(""));
        FsError::new(ErrorCode::Io, format!("Could not move to the Recycle Bin: {e}")).with_path(first)
    })
}

/// Permanently deletes one item. Links are removed, never followed.
pub fn delete_permanently(path: &Path) -> FsResult<()> {
    let md = fs::symlink_metadata(path).map_err(|e| FsError::io(e, path))?;
    let ft = md.file_type();
    let res = if ft.is_symlink() {
        // A directory symlink/junction is removed with remove_dir; its target is untouched.
        fs::remove_dir(path).or_else(|_| fs::remove_file(path))
    } else if ft.is_dir() {
        // std's remove_dir_all does not follow links (CVE-2022-21658 fixed in 1.58.1).
        clear_readonly_tree(path);
        fs::remove_dir_all(path)
    } else {
        clear_readonly(path);
        fs::remove_file(path)
    };
    res.map_err(|e| FsError::io(e, path))
}

fn clear_readonly(path: &Path) {
    if let Ok(md) = fs::symlink_metadata(path) {
        let mut perm = md.permissions();
        if perm.readonly() {
            #[allow(clippy::permissions_set_readonly_false)]
            perm.set_readonly(false);
            let _ = fs::set_permissions(path, perm);
        }
    }
}

fn clear_readonly_tree(root: &Path) {
    let mut stack = vec![root.to_path_buf()];
    while let Some(d) = stack.pop() {
        let Ok(rd) = fs::read_dir(&d) else { continue };
        for e in rd.flatten() {
            let Ok(md) = e.metadata() else { continue };
            if md.file_type().is_symlink() {
                continue;
            }
            if md.is_dir() {
                stack.push(e.path());
            } else if md.permissions().readonly() {
                clear_readonly(&e.path());
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_and_rename() {
        let t = tempfile::tempdir().unwrap();
        let a = create_folder(t.path(), None).unwrap();
        assert!(a.ends_with("New folder"));
        let b = create_folder(t.path(), None).unwrap();
        assert!(b.ends_with("New folder (2)"));
        assert_eq!(create_folder(t.path(), Some("New folder")).unwrap_err().code, ErrorCode::AlreadyExists);
        assert_eq!(create_folder(t.path(), Some("bad|name")).unwrap_err().code, ErrorCode::InvalidName);

        let r = rename(&a, "Renamed é").unwrap();
        assert!(r.is_dir());
        // Conflict: renaming onto an existing name must fail, not overwrite.
        assert_eq!(rename(&b, "Renamed é").unwrap_err().code, ErrorCode::AlreadyExists);
        // Case-only rename is allowed.
        let c = rename(&r, "RENAMED é").unwrap();
        let names: Vec<_> = fs::read_dir(t.path()).unwrap().map(|e| e.unwrap().file_name().into_string().unwrap()).collect();
        assert!(names.contains(&"RENAMED é".to_string()), "{names:?}");
        assert!(c.is_dir());
    }

    #[test]
    fn rename_file_conflict_preserves_both() {
        let t = tempfile::tempdir().unwrap();
        let a = t.path().join("a.txt");
        let b = t.path().join("b.txt");
        fs::write(&a, "A").unwrap();
        fs::write(&b, "B").unwrap();
        assert!(rename(&a, "b.txt").is_err());
        assert_eq!(fs::read_to_string(&a).unwrap(), "A");
        assert_eq!(fs::read_to_string(&b).unwrap(), "B");
    }

    #[test]
    fn permanent_delete_readonly_tree() {
        let t = tempfile::tempdir().unwrap();
        let d = t.path().join("d");
        fs::create_dir_all(d.join("x")).unwrap();
        let f = d.join("x").join("ro.txt");
        fs::write(&f, "x").unwrap();
        let mut p = fs::metadata(&f).unwrap().permissions();
        p.set_readonly(true);
        fs::set_permissions(&f, p).unwrap();
        delete_permanently(&d).unwrap();
        assert!(!d.exists());
    }

    #[test]
    fn create_empty_file() {
        let t = tempfile::tempdir().unwrap();
        let a = create_file(t.path(), "New text document.txt").unwrap();
        let b = create_file(t.path(), "New text document.txt").unwrap();
        assert_ne!(a, b);
        assert_eq!(fs::metadata(&b).unwrap().len(), 0);
    }
}
