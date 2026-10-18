//! Windows filename rules and conflict-free name generation.

use crate::error::{ErrorCode, FsError, FsResult};
use std::path::{Path, PathBuf};

const RESERVED: [&str; 22] = [
    "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9", "LPT1",
    "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

/// Validates a single path component as a Windows file or folder name.
pub fn validate_name(name: &str) -> FsResult<()> {
    let invalid = |why: &str| Err(FsError::new(ErrorCode::InvalidName, format!("\"{name}\" is not a valid name: {why}.")));
    if name.is_empty() || name.trim().is_empty() {
        return Err(FsError::new(ErrorCode::InvalidName, "A name cannot be empty."));
    }
    if name == "." || name == ".." {
        return invalid("reserved name");
    }
    if name.chars().count() > 255 {
        return invalid("longer than 255 characters");
    }
    if let Some(c) = name.chars().find(|c| matches!(c, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*') || (*c as u32) < 32) {
        return invalid(&format!("contains the character {c:?}"));
    }
    if name.ends_with('.') || name.ends_with(' ') {
        return invalid("ends with a dot or space");
    }
    let stem = name.split('.').next().unwrap_or("").trim_end().to_ascii_uppercase();
    if RESERVED.contains(&stem.as_str()) {
        return invalid("reserved by Windows");
    }
    Ok(())
}

/// Returns `dir/name` if free, otherwise `dir/stem (2).ext`, `dir/stem (3).ext`, …
pub fn unique_path(dir: &Path, name: &str) -> PathBuf {
    let first = dir.join(name);
    if !exists_no_follow(&first) {
        return first;
    }
    let (stem, ext) = split_name(name);
    for n in 2..100_000u32 {
        let candidate = dir.join(format!("{stem} ({n}){ext}"));
        if !exists_no_follow(&candidate) {
            return candidate;
        }
    }
    dir.join(format!("{stem} ({}){ext}", std::process::id()))
}

/// Splits "report.final.pdf" into ("report.final", ".pdf"); folders and
/// dot-files keep the whole name as stem.
pub fn split_name(name: &str) -> (&str, &str) {
    match name.rfind('.') {
        Some(i) if i > 0 => (&name[..i], &name[i..]),
        _ => (name, ""),
    }
}

/// `Path::exists` follows links and returns false for broken ones; for conflict
/// detection a dangling link still occupies the name.
pub fn exists_no_follow(p: &Path) -> bool {
    std::fs::symlink_metadata(p).is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_invalid() {
        for bad in ["", " ", "a<b", "a:b", "con", "CON.txt", "lpt1", "name.", "name ", "a/b", "..", "tab\there"] {
            assert!(validate_name(bad).is_err(), "{bad:?} should be invalid");
        }
    }

    #[test]
    fn accepts_valid() {
        for ok in ["a.txt", "Résumé 2024.pdf", "日本語フォルダ", ".gitignore", "console.log", "con-artist", "emoji 📁"] {
            assert!(validate_name(ok).is_ok(), "{ok:?} should be valid");
        }
    }

    #[test]
    fn unique_names() {
        let t = tempfile::tempdir().unwrap();
        std::fs::write(t.path().join("a.txt"), "").unwrap();
        std::fs::write(t.path().join("a (2).txt"), "").unwrap();
        assert_eq!(unique_path(t.path(), "a.txt"), t.path().join("a (3).txt"));
        assert_eq!(unique_path(t.path(), "b.txt"), t.path().join("b.txt"));
        std::fs::create_dir(t.path().join("folder")).unwrap();
        assert_eq!(unique_path(t.path(), "folder"), t.path().join("folder (2)"));
    }
}
