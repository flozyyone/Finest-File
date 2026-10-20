use crate::AppState;
use finestfile_core::archive::{self, ArchiveListing};
use finestfile_core::error::{ErrorCode, FsError};
use finestfile_core::index::{self, IndexStatus};
use finestfile_core::jobs::{JobKind, JobProgress};
use finestfile_core::listing::{self, DirListing};
use finestfile_core::model::FileEntry;
use finestfile_core::ops;
use finestfile_core::platform::{self, DriveInfo, KnownFolder};
use finestfile_core::search::{self, SearchQuery, SearchResultItem};
use finestfile_core::settings::{save_settings, AppSettings};
use finestfile_core::sorting::{self, FileGroup, ViewPreferences};
use finestfile_core::transfer::{self, ConflictPolicy, ConflictReport, TransferMode};
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::atomic::Ordering;
use tauri::State;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    pub drives: Vec<DriveInfo>,
    pub known_folders: Vec<KnownFolder>,
}

#[tauri::command]
pub fn get_system_info() -> SystemInfo {
    SystemInfo {
        drives: platform::drives(),
        known_folders: platform::known_folders(),
    }
}

#[tauri::command]
pub fn list_directory(path: String) -> Result<DirListing, FsError> {
    let resolved = listing::normalize_user_path(&path)?;
    listing::list_dir(&resolved)
}

#[tauri::command]
pub fn get_item_metadata(path: String) -> Result<FileEntry, FsError> {
    let p = PathBuf::from(&path);
    listing::stat(&p)
}

#[tauri::command]
pub fn create_folder(parent: String, name: Option<String>) -> Result<String, FsError> {
    let p = PathBuf::from(&parent);
    let created = ops::create_folder(&p, name.as_deref())?;
    Ok(created.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn create_file(parent: String, name: String) -> Result<String, FsError> {
    let p = PathBuf::from(&parent);
    let created = ops::create_file(&p, &name)?;
    Ok(created.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn rename_item(path: String, new_name: String) -> Result<String, FsError> {
    let p = PathBuf::from(&path);
    let renamed = ops::rename(&p, &new_name)?;
    Ok(renamed.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn trash_items(paths: Vec<String>) -> Result<(), FsError> {
    let buf_paths: Vec<PathBuf> = paths.into_iter().map(PathBuf::from).collect();
    ops::trash(&buf_paths)
}

#[tauri::command]
pub fn delete_items_permanently(paths: Vec<String>) -> Result<(), FsError> {
    for p in paths {
        ops::delete_permanently(Path::new(&p))?;
    }
    Ok(())
}

#[tauri::command]
pub fn open_item_default(path: String) -> Result<(), FsError> {
    platform::open_default(Path::new(&path))
}

#[tauri::command]
pub fn open_item_with(path: String) -> Result<(), FsError> {
    platform::open_with(Path::new(&path))
}

#[tauri::command]
pub fn show_item_properties(path: String) -> Result<(), FsError> {
    platform::show_properties(Path::new(&path))
}

#[tauri::command]
pub fn check_transfer_conflicts(
    sources: Vec<String>,
    dest_dir: String,
    mode: TransferMode,
) -> Result<ConflictReport, FsError> {
    let s_bufs: Vec<PathBuf> = sources.into_iter().map(PathBuf::from).collect();
    transfer::check_conflicts(&s_bufs, Path::new(&dest_dir), mode)
}

#[tauri::command]
pub fn start_transfer_job(
    state: State<'_, AppState>,
    sources: Vec<String>,
    dest_dir: String,
    mode: TransferMode,
    policy: ConflictPolicy,
) -> Result<u64, FsError> {
    let s_bufs: Vec<PathBuf> = sources.into_iter().map(PathBuf::from).collect();
    let d_buf = PathBuf::from(&dest_dir);
    let kind = match mode {
        TransferMode::Copy => JobKind::Copy,
        TransferMode::Move => JobKind::Move,
    };
    let title = format!(
        "{} {} item(s) to {}",
        match mode {
            TransferMode::Copy => "Copying",
            TransferMode::Move => "Moving",
        },
        s_bufs.len(),
        d_buf.file_name().map(|n| n.to_string_lossy()).unwrap_or_default()
    );

    let id = state.jobs.submit(kind, title, move |ctx| {
        transfer::run_transfer(&s_bufs, &d_buf, mode, policy, ctx)
    });
    Ok(id)
}

#[tauri::command]
pub fn list_archive_entries(path: String) -> Result<ArchiveListing, FsError> {
    archive::list_zip(Path::new(&path))
}

#[tauri::command]
pub fn start_extract_archive_job(
    state: State<'_, AppState>,
    archive_path: String,
    dest_dir: Option<String>,
    policy: ConflictPolicy,
) -> Result<u64, FsError> {
    let a_buf = PathBuf::from(&archive_path);
    let d_buf = match dest_dir {
        Some(d) => PathBuf::from(d),
        None => archive::default_extract_dir(&a_buf),
    };
    let title = format!("Extracting {}", a_buf.file_name().map(|n| n.to_string_lossy()).unwrap_or_default());

    let id = state.jobs.submit(JobKind::ExtractArchive, title, move |ctx| {
        archive::extract_zip(&a_buf, &d_buf, policy, ctx)
    });
    Ok(id)
}

#[tauri::command]
pub fn start_create_archive_job(
    state: State<'_, AppState>,
    sources: Vec<String>,
    dest_archive: Option<String>,
) -> Result<u64, FsError> {
    let s_bufs: Vec<PathBuf> = sources.into_iter().map(PathBuf::from).collect();
    let d_buf = match dest_archive {
        Some(d) => PathBuf::from(d),
        None => archive::default_archive_path(&s_bufs)
            .ok_or_else(|| FsError::new(ErrorCode::InvalidPath, "No valid destination path"))?,
    };
    let title = format!("Creating {}", d_buf.file_name().map(|n| n.to_string_lossy()).unwrap_or_default());

    let id = state.jobs.submit(JobKind::CreateArchive, title, move |ctx| {
        archive::create_zip(&s_bufs, &d_buf, ctx)
    });
    Ok(id)
}

#[tauri::command]
pub fn cancel_job(state: State<'_, AppState>, job_id: u64) -> bool {
    state.jobs.cancel(job_id)
}

#[tauri::command]
pub fn list_jobs(state: State<'_, AppState>) -> Vec<JobProgress> {
    state.jobs.list()
}

#[tauri::command]
pub fn clear_finished_jobs(state: State<'_, AppState>) {
    state.jobs.clear_finished();
}

#[tauri::command]
pub fn search_files(
    state: State<'_, AppState>,
    query: SearchQuery,
    use_index: bool,
) -> Result<Vec<SearchResultItem>, FsError> {
    if use_index {
        search::search_index(&state.index_db, &query)
    } else {
        let root = query
            .scope_path
            .as_ref()
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("C:\\"));
        search::search_directory_live(&root, &query, &|| false)
    }
}

#[tauri::command]
pub fn get_index_status(state: State<'_, AppState>) -> Result<IndexStatus, FsError> {
    let (files, folders, bytes) = state.index_db.count_stats()?;
    let settings = state.settings.lock().unwrap();
    let scanning = state.scanner_state.is_scanning.load(Ordering::Relaxed);
    let scanned = *state.scanner_state.scanned_count.lock().unwrap();
    let cur = state.scanner_state.current_path.lock().unwrap().clone();

    Ok(IndexStatus {
        enabled: settings.index.enabled,
        total_files: files,
        total_folders: folders,
        total_bytes: bytes,
        last_scan: None,
        is_scanning: scanning,
        scanned_items: scanned,
        current_path: cur,
    })
}

#[tauri::command]
pub fn start_index_scan(state: State<'_, AppState>) -> Result<(), FsError> {
    if state.scanner_state.is_scanning.load(Ordering::Relaxed) {
        return Ok(());
    }
    let db = state.index_db.clone();
    let settings = state.settings.lock().unwrap().index.clone();
    let sc_state = state.scanner_state.clone();

    std::thread::spawn(move || {
        let _ = index::scan_roots(db, settings, sc_state);
    });
    Ok(())
}

#[tauri::command]
pub fn cancel_index_scan(state: State<'_, AppState>) {
    state.scanner_state.cancel_flag.store(true, Ordering::SeqCst);
}

#[tauri::command]
pub fn clear_index(state: State<'_, AppState>) -> Result<(), FsError> {
    state.index_db.clear()
}

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> AppSettings {
    state.settings.lock().unwrap().clone()
}

#[tauri::command]
pub fn update_settings(state: State<'_, AppState>, new_settings: AppSettings) -> Result<(), FsError> {
    let mut s = state.settings.lock().unwrap();
    *s = new_settings.clone();
    save_settings(&state.settings_path, &new_settings)
}

#[tauri::command]
pub fn group_and_sort_files(
    entries: Vec<FileEntry>,
    prefs: ViewPreferences,
) -> Vec<FileGroup> {
    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);

    sorting::group_and_sort_entries(&entries, &prefs, now_ms)
}

#[tauri::command]
pub fn get_file_thumbnail(
    state: State<'_, AppState>,
    path: String,
    max_dimension: Option<u32>,
) -> Result<finestfile_core::thumbnail::ThumbnailResult, String> {
    let p = PathBuf::from(&path);
    let cache_dir = state
        .settings_path
        .parent()
        .map(|d| d.join("cache").join("thumbnails"))
        .unwrap_or_else(|| PathBuf::from("cache").join("thumbnails"));
    let dim = max_dimension.unwrap_or(128);
    finestfile_core::thumbnail::get_thumbnail(&p, dim, &cache_dir)
}

#[tauri::command]
pub fn get_media_preview(
    state: State<'_, AppState>,
    path: String,
) -> Result<finestfile_core::thumbnail::MediaPreviewInfo, String> {
    let p = PathBuf::from(&path);
    let cache_dir = state
        .settings_path
        .parent()
        .map(|d| d.join("cache").join("thumbnails"))
        .unwrap_or_else(|| PathBuf::from("cache").join("thumbnails"));
    finestfile_core::thumbnail::get_preview_info(&p, &cache_dir)
}

// --- BAK-IT-UP! COMMANDS ---

#[tauri::command]
pub fn create_backup_command(
    sources: Vec<String>,
    target_dir: String,
    custom_name: Option<String>,
    is_single_file_bak: bool,
) -> Result<finestfile_core::backup::BackupManifest, FsError> {
    let p = PathBuf::from(&target_dir);
    finestfile_core::backup::create_backup(
        &sources,
        &p,
        custom_name.as_deref(),
        is_single_file_bak,
    )
}

#[tauri::command]
pub fn verify_backup_command(
    backup_root_dir: String,
) -> Result<finestfile_core::backup::BackupVerifyResult, FsError> {
    let p = PathBuf::from(&backup_root_dir);
    finestfile_core::backup::verify_backup(&p)
}

#[tauri::command]
pub fn preview_restore_command(
    backup_root_dir: String,
    target_restore_dir: String,
) -> Result<finestfile_core::backup::RestorePreview, FsError> {
    let b = PathBuf::from(&backup_root_dir);
    let t = PathBuf::from(&target_restore_dir);
    finestfile_core::backup::preview_restore(&b, &t)
}

#[tauri::command]
pub fn restore_backup_command(
    backup_root_dir: String,
    target_restore_dir: String,
    policy: finestfile_core::backup::RestorePolicy,
) -> Result<usize, FsError> {
    let b = PathBuf::from(&backup_root_dir);
    let t = PathBuf::from(&target_restore_dir);
    finestfile_core::backup::restore_backup(&b, &t, policy)
}

#[tauri::command]
pub fn list_all_backups_command() -> Vec<finestfile_core::backup::BackupManifest> {
    finestfile_core::backup::list_all_backups()
}

// --- WORKSPACE & TAB GROUPING COMMANDS ---

#[tauri::command]
pub fn list_workspaces_command() -> Vec<finestfile_core::workspaces::Workspace> {
    finestfile_core::workspaces::list_workspaces()
}

#[tauri::command]
pub fn save_workspace_command(
    name: String,
    tabs: Vec<finestfile_core::workspaces::WorkspaceTab>,
    active_tab_id: String,
    is_dual_pane: bool,
    secondary_path: Option<String>,
) -> Result<finestfile_core::workspaces::Workspace, FsError> {
    finestfile_core::workspaces::save_workspace(
        &name,
        tabs,
        &active_tab_id,
        is_dual_pane,
        secondary_path,
    )
}

#[tauri::command]
pub fn delete_workspace_command(id: String) -> Result<(), FsError> {
    finestfile_core::workspaces::delete_workspace(&id)
}

#[tauri::command]
pub fn export_workspaces_command(export_path: String) -> Result<(), FsError> {
    let p = PathBuf::from(&export_path);
    finestfile_core::workspaces::export_workspaces(&p)
}

#[tauri::command]
pub fn import_workspaces_command(import_path: String) -> Result<usize, FsError> {
    let p = PathBuf::from(&import_path);
    finestfile_core::workspaces::import_workspaces(&p)
}

// --- ATTRIBUTES & TIMES COMMANDS ---

#[tauri::command]
pub fn set_file_attributes_command(
    update: finestfile_core::platform::FileAttributesUpdate,
) -> Result<(), FsError> {
    finestfile_core::platform::set_file_attributes(&update)
}

#[tauri::command]
pub fn set_file_times_command(
    update: finestfile_core::platform::FileTimesUpdate,
) -> Result<(), FsError> {
    finestfile_core::platform::set_file_times(&update)
}

// --- ELEVATION (SAFE ADMIN) COMMAND ---

#[tauri::command]
pub fn request_admin_elevation() -> Result<(), FsError> {
    finestfile_core::platform::elevate_application()
}
