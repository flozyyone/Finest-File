//! Directory listing and single-item metadata.

use crate::error::{ErrorCode, FsError, FsResult};
use crate::model::{entry_from_metadata, FileEntry};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirListing {
    pub path: String,
    pub entries: Vec<FileEntry>,
    /// Number of entries that disappeared or could not be read during enumeration.
    pub skipped: u32,
}

/// Lists a directory without following links and without opening any file.
///
/// Hidden/system filtering is left to the caller (the UI toggles it instantly
/// without re-reading the disk).
pub fn list_dir(path: &Path) -> FsResult<DirListing> {
    let md = fs::metadata(path).map_err(|e| FsError::io(e, path))?;
    if !md.is_dir() {
        return Err(FsError::new(ErrorCode::NotADirectory, format!("\"{}\" is not a folder.", path.display())).with_path(path));
    }
    let rd = fs::read_dir(path).map_err(|e| FsError::io(e, path))?;
    let mut entries = Vec::with_capacity(256);
    let mut skipped = 0u32;
    for item in rd {
        let Ok(item) = item else {
            skipped += 1;
            continue;
        };
        // On Windows DirEntry::metadata is served from the FindNextFileW record.
        match item.metadata() {
            Ok(md) => {
                let name = item.file_name().to_string_lossy().into_owned();
                entries.push(entry_from_metadata(&item.path(), name, &md));
            }
            Err(_) => skipped += 1,
        }
    }
    Ok(DirListing { path: path.to_string_lossy().into_owned(), entries, skipped })
}

/// Metadata for one path, not following links.
pub fn stat(path: &Path) -> FsResult<FileEntry> {
    let md = fs::symlink_metadata(path).map_err(|e| FsError::io(e, path))?;
    let name = display_name(path);
    Ok(entry_from_metadata(path, name, &md))
}

pub fn display_name(path: &Path) -> String {
    path.file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.to_string_lossy().trim_end_matches('\\').to_string())
}

/// Normalises user input from the address bar: trims quotes and whitespace,
/// expands `%VAR%` environment variables and resolves to an absolute path.
pub fn normalize_user_path(input: &str) -> FsResult<PathBuf> {
    let trimmed = input.trim().trim_matches('"').trim();
    if trimmed.is_empty() {
        return Err(FsError::new(ErrorCode::InvalidPath, "Enter a location."));
    }
    let expanded = expand_env(trimmed);
    let mut p = PathBuf::from(&expanded);
    // "C:" alone means the current directory on that drive in Win32; users mean the root.
    if expanded.len() == 2 && expanded.ends_with(':') {
        p = PathBuf::from(format!("{expanded}\\"));
    }
    if !p.is_absolute() {
        return Err(FsError::new(ErrorCode::InvalidPath, format!("\"{trimmed}\" is not a full path.")));
    }
    Ok(p)
}

fn expand_env(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut rest = s;
    while let Some(start) = rest.find('%') {
        out.push_str(&rest[..start]);
        let after = &rest[start + 1..];
        match after.find('%') {
            Some(end) if end > 0 => {
                let var = &after[..end];
                match std::env::var(var) {
                    Ok(v) => out.push_str(&v),
                    Err(_) => {
                        out.push('%');
                        out.push_str(var);
                        out.push('%');
                    }
                }
                rest = &after[end + 1..];
            }
            _ => {
                out.push('%');
                rest = after;
            }
        }
    }
    out.push_str(rest);
    out
}

/// Recursively computes the total size of a folder (used by Properties only,
/// never during listing). Links are not followed. Cancellable.
pub fn folder_size(path: &Path, cancel: &dyn Fn() -> bool) -> FsResult<FolderStats> {
    let mut stats = FolderStats::default();
    let mut stack = vec![path.to_path_buf()];
    while let Some(dir) = stack.pop() {
        if cancel() {
            return Err(FsError::cancelled());
        }
        let Ok(rd) = fs::read_dir(&dir) else {
            stats.inaccessible += 1;
            continue;
        };
        for item in rd.flatten() {
            let Ok(md) = item.metadata() else { continue };
            let ft = md.file_type();
            if ft.is_symlink() {
                continue;
            }
            if ft.is_dir() {
                stats.folders += 1;
                stack.push(item.path());
            } else {
                stats.files += 1;
                stats.bytes += md.len();
            }
        }
    }
    Ok(stats)
}

#[derive(Debug, Default, Serialize, Clone, Copy)]
#[serde(rename_all = "camelCase")]
pub struct FolderStats {
    pub bytes: u64,
    pub files: u64,
    pub folders: u64,
    pub inaccessible: u64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::EntryKind;

    #[test]
    fn lists_unicode_entries() {
        let t = tempfile::tempdir().unwrap();
        fs::write(t.path().join("ünïcødé 文件.TXT"), b"hello").unwrap();
        fs::create_dir(t.path().join("sub dir")).unwrap();
        let l = list_dir(t.path()).unwrap();
        assert_eq!(l.entries.len(), 2);
        let f = l.entries.iter().find(|e| e.kind == EntryKind::File).unwrap();
        assert_eq!(f.name, "ünïcødé 文件.TXT");
        assert_eq!(f.ext, "txt");
        assert_eq!(f.size, Some(5));
        let d = l.entries.iter().find(|e| e.kind == EntryKind::Directory).unwrap();
        assert_eq!(d.size, None);
    }

    #[test]
    fn missing_dir_is_not_found() {
        let t = tempfile::tempdir().unwrap();
        let e = list_dir(&t.path().join("nope")).unwrap_err();
        assert_eq!(e.code, ErrorCode::NotFound);
    }

    #[test]
    fn file_is_not_a_directory() {
        let t = tempfile::tempdir().unwrap();
        let f = t.path().join("f");
        fs::write(&f, "").unwrap();
        assert_eq!(list_dir(&f).unwrap_err().code, ErrorCode::NotADirectory);
    }

    #[test]
    fn long_paths() {
        let t = tempfile::tempdir().unwrap();
        let mut p = t.path().to_path_buf();
        while p.as_os_str().len() < 300 {
            p.push("a_rather_long_folder_name_segment");
        }
        fs::create_dir_all(&p).unwrap();
        fs::write(p.join("deep.txt"), "x").unwrap();
        assert_eq!(list_dir(&p).unwrap().entries.len(), 1);
        let s = folder_size(t.path(), &|| false).unwrap();
        assert_eq!(s.files, 1);
        assert_eq!(s.bytes, 1);
    }

    #[test]
    fn normalizes_input() {
        assert_eq!(normalize_user_path(" \"C:\\Windows\" ").unwrap(), PathBuf::from("C:\\Windows"));
        assert_eq!(normalize_user_path("C:").unwrap(), PathBuf::from("C:\\"));
        assert!(normalize_user_path("relative\\x").is_err());
        std::env::set_var("FF_TEST_VAR", "C:\\Temp");
        assert_eq!(normalize_user_path("%FF_TEST_VAR%\\x").unwrap(), PathBuf::from("C:\\Temp\\x"));
        assert_eq!(expand_env("100%"), "100%");
    }
}
