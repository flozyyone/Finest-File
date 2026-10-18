use serde::{Deserialize, Serialize};
use std::fs::Metadata;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EntryKind {
    File,
    Directory,
    /// A symbolic link or other reparse point (for example a junction). These are
    /// never followed during recursive operations.
    Link,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    /// Lower-case extension without the dot. Empty for folders or files without one.
    pub ext: String,
    pub kind: EntryKind,
    /// Whether a link points at a directory (only meaningful for `Link`).
    pub link_to_dir: bool,
    /// Size in bytes for files; `None` for folders (never computed eagerly).
    pub size: Option<u64>,
    /// Milliseconds since the Unix epoch.
    pub modified: Option<i64>,
    pub created: Option<i64>,
    pub accessed: Option<i64>,
    pub hidden: bool,
    pub system: bool,
    pub readonly: bool,
    pub attributes: u32,
}

pub fn to_millis(t: std::io::Result<SystemTime>) -> Option<i64> {
    let t = t.ok()?;
    match t.duration_since(UNIX_EPOCH) {
        Ok(d) => Some(d.as_millis() as i64),
        Err(e) => Some(-(e.duration().as_millis() as i64)),
    }
}

pub fn extension_of(name: &str) -> String {
    match name.rfind('.') {
        // A leading dot (".gitignore") is a name, not an extension.
        Some(i) if i > 0 && i + 1 < name.len() => name[i + 1..].to_lowercase(),
        _ => String::new(),
    }
}

#[cfg(windows)]
pub(crate) fn attributes(md: &Metadata) -> u32 {
    use std::os::windows::fs::MetadataExt;
    md.file_attributes()
}

#[cfg(not(windows))]
pub(crate) fn attributes(_md: &Metadata) -> u32 {
    0
}

pub const ATTR_READONLY: u32 = 0x1;
pub const ATTR_HIDDEN: u32 = 0x2;
pub const ATTR_SYSTEM: u32 = 0x4;
pub const ATTR_DIRECTORY: u32 = 0x10;
pub const ATTR_REPARSE_POINT: u32 = 0x400;

/// Builds an entry from metadata obtained *without* following links
/// (`symlink_metadata` or `DirEntry::metadata`, which on Windows comes from the
/// directory enumeration itself and costs no extra file open).
pub fn entry_from_metadata(path: &Path, name: String, md: &Metadata) -> FileEntry {
    let attrs = attributes(md);
    let ft = md.file_type();
    // On Windows `is_symlink` is true for name-surrogate reparse points
    // (symbolic links and junctions). Other reparse points, such as OneDrive
    // cloud placeholders, are ordinary files/folders for browsing purposes.
    let is_link = ft.is_symlink();
    let kind = if is_link {
        EntryKind::Link
    } else if ft.is_dir() {
        EntryKind::Directory
    } else {
        EntryKind::File
    };
    let link_to_dir = is_link && attrs & ATTR_DIRECTORY != 0;
    let is_dir_like = kind == EntryKind::Directory || link_to_dir;
    FileEntry {
        ext: if is_dir_like { String::new() } else { extension_of(&name) },
        name,
        path: path.to_string_lossy().into_owned(),
        kind,
        link_to_dir,
        size: if is_dir_like { None } else { Some(md.len()) },
        modified: to_millis(md.modified()),
        created: to_millis(md.created()),
        accessed: to_millis(md.accessed()),
        hidden: attrs & ATTR_HIDDEN != 0,
        system: attrs & ATTR_SYSTEM != 0,
        readonly: attrs & ATTR_READONLY != 0,
        attributes: attrs,
    }
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extensions() {
        assert_eq!(extension_of("a.TXT"), "txt");
        assert_eq!(extension_of(".gitignore"), "");
        assert_eq!(extension_of("archive.tar.gz"), "gz");
        assert_eq!(extension_of("noext"), "");
        assert_eq!(extension_of("trailing."), "");
        assert_eq!(extension_of("résumé.pdf"), "pdf");
    }
}
