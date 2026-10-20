// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

use finestfile_core::index::{IndexDb, ScannerState};
use finestfile_core::jobs::{JobManager, JobProgress, JobSink};
use finestfile_core::settings::{load_settings, settings_file_path, AppSettings};
use finestfile_core::window_state::{
    load_window_state, save_window_state, window_state_file_path, MonitorBounds,
};
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

            let window_state_path = window_state_file_path();
            let mut initial_state = load_window_state(&window_state_path);

            if let Some(window) = app.get_webview_window("main") {
                let mut monitors = Vec::new();
                if let Ok(avail) = window.available_monitors() {
                    for m in avail {
                        let pos = m.position();
                        let size = m.size();
                        monitors.push(MonitorBounds {
                            x: pos.x,
                            y: pos.y,
                            width: size.width,
                            height: size.height,
                        });
                    }
                }

                initial_state.validate_and_recover(&monitors);

                let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
                    width: initial_state.width,
                    height: initial_state.height,
                }));

                if let (Some(x), Some(y)) = (initial_state.x, initial_state.y) {
                    let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                        x,
                        y,
                    }));
                }

                if initial_state.is_maximized || initial_state.first_launch {
                    let _ = window.maximize();
                }

                let state_arc = Arc::new(Mutex::new(initial_state));
                let state_for_events = state_arc.clone();
                let win_for_events = window.clone();
                let save_path = window_state_path.clone();

                window.on_window_event(move |event| match event {
                    tauri::WindowEvent::Resized(size) => {
                        let is_max = win_for_events.is_maximized().unwrap_or(false);
                        if let Ok(mut st) = state_for_events.lock() {
                            st.set_maximized(is_max);
                            if !is_max {
                                st.update_restored_size(size.width, size.height);
                            }
                            let _ = save_window_state(&save_path, &st);
                        }
                    }
                    tauri::WindowEvent::Moved(pos) => {
                        let is_max = win_for_events.is_maximized().unwrap_or(false);
                        if let Ok(mut st) = state_for_events.lock() {
                            if !is_max {
                                st.update_restored_position(pos.x, pos.y);
                                let _ = save_window_state(&save_path, &st);
                            }
                        }
                    }
                    tauri::WindowEvent::CloseRequested { .. } | tauri::WindowEvent::Destroyed => {
                        let is_max = win_for_events.is_maximized().unwrap_or(false);
                        if let Ok(mut st) = state_for_events.lock() {
                            st.set_maximized(is_max);
                            let _ = save_window_state(&save_path, &st);
                        }
                    }
                    _ => {}
                });
            }

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
            commands::group_and_sort_files,
            commands::get_file_thumbnail,
            commands::get_media_preview,
            commands::create_backup_command,
            commands::verify_backup_command,
            commands::preview_restore_command,
            commands::restore_backup_command,
            commands::list_all_backups_command,
            commands::list_workspaces_command,
            commands::save_workspace_command,
            commands::delete_workspace_command,
            commands::export_workspaces_command,
            commands::import_workspaces_command,
            commands::set_file_attributes_command,
            commands::set_file_times_command,
            commands::request_admin_elevation,
        ])
        .run(tauri::generate_context!())
        .expect("error while running FinestFile desktop application");
}
