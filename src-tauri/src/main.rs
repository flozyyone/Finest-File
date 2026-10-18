// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

use finestfile_core::index::{IndexDb, IndexSettings, ScannerState};
use finestfile_core::jobs::{JobManager, JobProgress, JobSink};
use finestfile_core::settings::{load_settings, settings_file_path, AppSettings};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};

struct TauriJobSink {
    app: AppHandle,
}

impl JobSink for TauriJobSink {
    fn update(&self, progress: &JobProgress) {
        let _ = self.app.emit("job-progress", progress);
    }
}

pub struct AppState {
    pub jobs: JobManager,
    pub index_db: IndexDb,
    pub scanner_state: Arc<ScannerState>,
    pub settings: Mutex<AppSettings>,
    pub settings_path: PathBuf,
}

fn main() {
    let settings_path = settings_file_path();
    let settings = load_settings(&settings_path);

    let index_db_path = settings_path
        .parent()
        .map(|p| p.join("index.db"))
        .unwrap_or_else(|| PathBuf::from("index.db"));

    let index_db = IndexDb::open(&index_db_path).unwrap_or_else(|_| IndexDb::in_memory().unwrap());
    let scanner_state = Arc::new(ScannerState::default());

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let handle = app.handle().clone();
            let sink = Arc::new(TauriJobSink { app: handle });
            let jobs = JobManager::new(2, sink);

            app.manage(AppState {
                jobs,
                index_db,
                scanner_state,
                settings: Mutex::new(settings),
                settings_path,
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_system_info,
            commands::list_directory,
            commands::get_item_metadata,
            commands::create_folder,
            commands::create_file,
            commands::rename_item,
            commands::trash_items,
            commands::delete_items_permanently,
            commands::open_item_default,
            commands::open_item_with,
            commands::show_item_properties,
            commands::check_transfer_conflicts,
            commands::start_transfer_job,
            commands::list_archive_entries,
            commands::start_extract_archive_job,
            commands::start_create_archive_job,
            commands::cancel_job,
            commands::list_jobs,
            commands::clear_finished_jobs,
            commands::search_files,
            commands::get_index_status,
            commands::start_index_scan,
            commands::cancel_index_scan,
            commands::clear_index,
            commands::get_settings,
            commands::update_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running FinestFile desktop application");
}
