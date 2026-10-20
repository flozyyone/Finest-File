//! Bak-it-Up! Local Offline Backup System
//!
//! Provides verifiable, offline-first backups for individual files, multiple files,
//! or entire folder hierarchies with SHA-256 integrity checks, manifests, and restore preview.

use crate::error::{ErrorCode, FsError, FsResult};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupFileEntry {
    pub relative_path: String,
    pub original_path: String,
    pub size: u64,
    pub sha256: String,
    pub modified_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupManifest {
    pub version: u32,
    pub backup_id: String,
    pub name: String,
    pub created_at_ms: i64,
    pub total_size: u64,
    pub total_files: usize,
    pub files: Vec<BackupFileEntry>,
    pub backup_root_dir: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupVerifyResult {
    pub is_valid: bool,
    pub verified_files: usize,
    pub corrupt_or_missing: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestorePreviewItem {
    pub relative_path: String,
    pub target_path: String,
    pub exists_at_target: bool,
    pub size_differs: bool,
    pub target_is_newer: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestorePreview {
    pub backup_id: String,
    pub total_files: usize,
    pub conflicts_count: usize,
    pub items: Vec<RestorePreviewItem>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RestorePolicy {
    SkipExisting,
    OverwriteAll,
    KeepBoth,
}

/// Computes the SHA-256 hex string for a local file.
pub fn hash_file_sha256(path: &Path) -> std::io::Result<String> {
    let mut file = File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 64 * 1024];

    loop {
        let count = file.read(&mut buffer)?;
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
    }

    Ok(format!("{:x}", hasher.finalize()))
}

/// Recursively gathers files to backup from a given source path.
fn collect_source_files(
    src_root: &Path,
    current: &Path,
    collected: &mut Vec<(PathBuf, String)>,
) -> std::io::Result<()> {
    if current.is_file() {
        let rel = match current.strip_prefix(src_root) {
            Ok(p) => {
                let s = p.to_string_lossy().replace('\\', "/");
                if s.is_empty() {
                    current.file_name().unwrap_or_default().to_string_lossy().into_owned()
                } else {
                    s
                }
            }
            Err(_) => current.file_name().unwrap_or_default().to_string_lossy().into_owned(),
        };
        collected.push((current.to_path_buf(), rel));
        return Ok(());
    }

    if current.is_dir() {
        for entry in fs::read_dir(current)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_dir() {
                collect_source_files(src_root, &path, collected)?;
            } else if path.is_file() {
                let rel = path
                    .strip_prefix(src_root)
                    .unwrap_or(&path)
                    .to_string_lossy()
                    .replace('\\', "/");
                collected.push((path, rel));
            }
        }
    }

    Ok(())
}

/// Creates a new backup of one or multiple files/directories.
///
/// If `is_single_file_bak` is true and only 1 file is selected, it can create a `.bak`
/// copy with manifest alongside it or in target_dir.
pub fn create_backup(
    sources: &[String],
    target_dir: &Path,
    custom_name: Option<&str>,
    is_single_file_bak: bool,
) -> FsResult<BackupManifest> {
    if sources.is_empty() {
        return Err(FsError::new(ErrorCode::InvalidPath, "No files specified for backup"));
    }

    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);

    let default_name = if sources.len() == 1 {
        Path::new(&sources[0])
            .file_name()
            .map(|s| s.to_string_lossy().into_owned())
            .unwrap_or_else(|| "backup".into())
    } else {
        "multi_selection".to_string()
    };

    let base_name = custom_name.filter(|s| !s.trim().is_empty()).unwrap_or(&default_name);
    let sanitized_name = base_name.replace(['\\', '/', ':', '*', '?', '"', '<', '>', '|'], "_");

    fs::create_dir_all(target_dir).map_err(|e| FsError::io(e, target_dir))?;

    // Format folder name: Name_bak_YYYYMMDD_HHMMSS
    let backup_id = format!("{}_bak_{}", sanitized_name, now_ms);
    let backup_dest_folder = if is_single_file_bak && sources.len() == 1 && Path::new(&sources[0]).is_file() {
        // Direct .bak folder
        target_dir.join(&backup_id)
    } else {
        target_dir.join(&backup_id)
    };

    fs::create_dir_all(&backup_dest_folder).map_err(|e| FsError::io(e, &backup_dest_folder))?;
    let data_dir = backup_dest_folder.join("data");
    fs::create_dir_all(&data_dir).map_err(|e| FsError::io(e, &data_dir))?;

    let mut all_files: Vec<(PathBuf, String)> = Vec::new();

    for src_str in sources {
        let src_path = PathBuf::from(src_str);
        if !src_path.exists() {
            continue;
        }

        if src_path.is_file() {
            let fname = src_path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .into_owned();
            all_files.push((src_path, fname));
        } else if src_path.is_dir() {
            let dir_name = src_path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .into_owned();
            let mut sub_files = Vec::new();
            collect_source_files(&src_path, &src_path, &mut sub_files)
                .map_err(|e| FsError::io(e, &src_path))?;
            for (p, rel) in sub_files {
                all_files.push((p, format!("{}/{}", dir_name, rel)));
            }
        }
    }

    if all_files.is_empty() {
        return Err(FsError::new(ErrorCode::NotFound, "No readable files found to backup"));
    }

    let mut manifest_files = Vec::new();
    let mut total_size = 0u64;

    for (src_path, rel_path) in all_files {
        let meta = fs::metadata(&src_path).map_err(|e| FsError::io(e, &src_path))?;
        let size = meta.len();
        let modified_ms = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as i64)
            .unwrap_or(now_ms);

        let sha256 = hash_file_sha256(&src_path).map_err(|e| FsError::io(e, &src_path))?;

        // Copy file into data folder preserving relative structure
        let dest_file_path = data_dir.join(&rel_path);
        if let Some(parent) = dest_file_path.parent() {
            fs::create_dir_all(parent).map_err(|e| FsError::io(e, parent))?;
        }

        // Atomic copy: write to temp file then rename
        let temp_dest = dest_file_path.with_extension("tmp_bak");
        fs::copy(&src_path, &temp_dest).map_err(|e| FsError::io(e, &src_path))?;
        fs::rename(&temp_dest, &dest_file_path).map_err(|e| FsError::io(e, &dest_file_path))?;

        // Verify copy hash immediately
        let copied_hash = hash_file_sha256(&dest_file_path).map_err(|e| FsError::io(e, &dest_file_path))?;
        if copied_hash != sha256 {
            return Err(FsError::new(
                ErrorCode::Io,
                format!("Backup copy verification failed for {}", rel_path),
            ));
        }

        total_size += size;
        manifest_files.push(BackupFileEntry {
            relative_path: rel_path,
            original_path: src_path.to_string_lossy().into_owned(),
            size,
            sha256,
            modified_ms,
        });
    }

    let manifest = BackupManifest {
        version: 1,
        backup_id: backup_id.clone(),
        name: base_name.to_string(),
        created_at_ms: now_ms,
        total_size,
        total_files: manifest_files.len(),
        files: manifest_files,
        backup_root_dir: backup_dest_folder.to_string_lossy().into_owned(),
    };

    let manifest_path = backup_dest_folder.join("manifest.json");
    let manifest_json = serde_json::to_string_pretty(&manifest)
        .map_err(|e| FsError::new(ErrorCode::Io, e.to_string()))?;
    fs::write(&manifest_path, manifest_json).map_err(|e| FsError::io(e, &manifest_path))?;

    // Also record in app backups registry index if target_dir has a registry
    save_backup_to_registry(&manifest)?;

    Ok(manifest)
}

/// Verifies all files in an existing backup against its manifest SHA-256 hashes.
pub fn verify_backup(backup_root_dir: &Path) -> FsResult<BackupVerifyResult> {
    let manifest_path = backup_root_dir.join("manifest.json");
    if !manifest_path.exists() {
        return Err(FsError::new(
            ErrorCode::NotFound,
            format!("Manifest not found at {}", manifest_path.display()),
        ));
    }

    let manifest_str = fs::read_to_string(&manifest_path).map_err(|e| FsError::io(e, &manifest_path))?;
    let manifest: BackupManifest = serde_json::from_str(&manifest_str)
        .map_err(|e| FsError::new(ErrorCode::Io, format!("Corrupt manifest: {e}")))?;

    let data_dir = backup_root_dir.join("data");
    let mut corrupt_or_missing = Vec::new();
    let mut verified = 0;

    for item in &manifest.files {
        let fpath = data_dir.join(&item.relative_path);
        if !fpath.exists() {
            corrupt_or_missing.push(format!("Missing: {}", item.relative_path));
            continue;
        }

        match hash_file_sha256(&fpath) {
            Ok(hash) => {
                if hash == item.sha256 {
                    verified += 1;
                } else {
                    corrupt_or_missing.push(format!("Corrupt hash: {}", item.relative_path));
                }
            }
            Err(e) => {
                corrupt_or_missing.push(format!("Read error {}: {}", item.relative_path, e));
            }
        }
    }

    Ok(BackupVerifyResult {
        is_valid: corrupt_or_missing.is_empty(),
        verified_files: verified,
        corrupt_or_missing,
    })
}

/// Previews restoring a backup to a target directory, identifying conflicts and newer files.
pub fn preview_restore(backup_root_dir: &Path, target_restore_dir: &Path) -> FsResult<RestorePreview> {
    let manifest_path = backup_root_dir.join("manifest.json");
    let manifest_str = fs::read_to_string(&manifest_path).map_err(|e| FsError::io(e, &manifest_path))?;
    let manifest: BackupManifest = serde_json::from_str(&manifest_str)
        .map_err(|e| FsError::new(ErrorCode::Io, format!("Corrupt manifest: {e}")))?;

    let mut items = Vec::new();
    let mut conflicts = 0;

    for file in &manifest.files {
        let dest = target_restore_dir.join(&file.relative_path);
        let exists = dest.exists();
        let mut size_differs = false;
        let mut target_is_newer = false;

        if exists {
            conflicts += 1;
            if let Ok(m) = fs::metadata(&dest) {
                size_differs = m.len() != file.size;
                if let Ok(mod_time) = m.modified() {
                    let dest_mod_ms = mod_time
                        .duration_since(UNIX_EPOCH)
                        .map(|d| d.as_millis() as i64)
                        .unwrap_or(0);
                    target_is_newer = dest_mod_ms > file.modified_ms;
                }
            }
        }

        items.push(RestorePreviewItem {
            relative_path: file.relative_path.clone(),
            target_path: dest.to_string_lossy().into_owned(),
            exists_at_target: exists,
            size_differs,
            target_is_newer,
        });
    }

    Ok(RestorePreview {
        backup_id: manifest.backup_id,
        total_files: manifest.files.len(),
        conflicts_count: conflicts,
        items,
    })
}

/// Restores files from a verified backup to a target directory according to conflict policy.
pub fn restore_backup(
    backup_root_dir: &Path,
    target_restore_dir: &Path,
    policy: RestorePolicy,
) -> FsResult<usize> {
    let manifest_path = backup_root_dir.join("manifest.json");
    let manifest_str = fs::read_to_string(&manifest_path).map_err(|e| FsError::io(e, &manifest_path))?;
    let manifest: BackupManifest = serde_json::from_str(&manifest_str)
        .map_err(|e| FsError::new(ErrorCode::Io, format!("Corrupt manifest: {e}")))?;

    let data_dir = backup_root_dir.join("data");
    let mut restored_count = 0;

    for item in &manifest.files {
        let src_file = data_dir.join(&item.relative_path);
        if !src_file.exists() {
            continue;
        }

        let mut dest_file = target_restore_dir.join(&item.relative_path);
        if dest_file.exists() {
            match policy {
                RestorePolicy::SkipExisting => continue,
                RestorePolicy::OverwriteAll => {
                    // Safe overwrite
                }
                RestorePolicy::KeepBoth => {
                    // Rename new restored copy, e.g. "file (restored).txt"
                    let parent = dest_file.parent().unwrap_or(target_restore_dir);
                    let stem = dest_file
                        .file_stem()
                        .unwrap_or_default()
                        .to_string_lossy();
                    let ext = dest_file
                        .extension()
                        .map(|e| format!(".{}", e.to_string_lossy()))
                        .unwrap_or_default();
                    dest_file = parent.join(format!("{} (restored){}", stem, ext));
                }
            }
        }

        if let Some(p) = dest_file.parent() {
            fs::create_dir_all(p).map_err(|e| FsError::io(e, p))?;
        }

        fs::copy(&src_file, &dest_file).map_err(|e| FsError::io(e, &dest_file))?;
        restored_count += 1;
    }

    Ok(restored_count)
}

/// Registry of known backups
pub fn get_backups_registry_path() -> PathBuf {
    #[cfg(windows)]
    {
        if let Ok(app_data) = std::env::var("APPDATA") {
            return PathBuf::from(app_data).join("FinestFile").join("backups_registry.json");
        }
    }
    PathBuf::from("backups_registry.json")
}

pub fn list_all_backups() -> Vec<BackupManifest> {
    let reg_path = get_backups_registry_path();
    if let Ok(content) = fs::read_to_string(&reg_path) {
        if let Ok(list) = serde_json::from_str::<Vec<BackupManifest>>(&content) {
            // Filter only those whose backup_root_dir still exists
            return list
                .into_iter()
                .filter(|m| Path::new(&m.backup_root_dir).exists())
                .collect();
        }
    }
    Vec::new()
}

fn save_backup_to_registry(manifest: &BackupManifest) -> FsResult<()> {
    let reg_path = get_backups_registry_path();
    if let Some(parent) = reg_path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    let mut list = list_all_backups();
    // Prepend new backup
    list.retain(|m| m.backup_id != manifest.backup_id);
    list.insert(0, manifest.clone());

    if let Ok(json) = serde_json::to_string_pretty(&list) {
        let _ = fs::write(&reg_path, json);
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::tempdir;

    #[test]
    fn test_backup_and_restore_cycle() {
        let dir = tempdir().unwrap();
        let src = dir.path().join("source");
        let dest = dir.path().join("backups");
        let restore = dir.path().join("restored");

        fs::create_dir_all(&src).unwrap();
        let f1 = src.join("hello.txt");
        let mut file1 = File::create(&f1).unwrap();
        file1.write_all(b"Hello FinestFile Backup System!").unwrap();

        let sub = src.join("nested");
        fs::create_dir_all(&sub).unwrap();
        let f2 = sub.join("doc.md");
        let mut file2 = File::create(&f2).unwrap();
        file2.write_all(b"# Markdown Backup Content").unwrap();

        // 1. Create backup
        let sources = vec![src.to_string_lossy().into_owned()];
        let manifest = create_backup(&sources, &dest, Some("TestBackup"), false).unwrap();
        assert_eq!(manifest.files.len(), 2);
        assert_eq!(manifest.name, "TestBackup");

        let backup_root = PathBuf::from(&manifest.backup_root_dir);
        assert!(backup_root.exists());

        // 2. Verify backup
        let verify = verify_backup(&backup_root).unwrap();
        assert!(verify.is_valid);
        assert_eq!(verify.verified_files, 2);

        // 3. Preview restore
        let preview = preview_restore(&backup_root, &restore).unwrap();
        assert_eq!(preview.conflicts_count, 0);
        assert_eq!(preview.total_files, 2);

        // 4. Restore
        let restored_count = restore_backup(&backup_root, &restore, RestorePolicy::OverwriteAll).unwrap();
        assert_eq!(restored_count, 2);

        let restored_f1 = restore.join("source/hello.txt");
        assert!(restored_f1.exists());
        let text = fs::read_to_string(&restored_f1).unwrap();
        assert_eq!(text, "Hello FinestFile Backup System!");
    }
}
