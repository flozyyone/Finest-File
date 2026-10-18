//! User settings and persistence.

use crate::error::{FsError, FsResult};
use crate::index::IndexSettings;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

use crate::sorting::ViewPreferences;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub theme: String, // "system", "light", "dark"
    pub show_hidden_files: bool,
    pub show_file_extensions: bool,
    pub default_view_mode: String, // "details", "grid"
    pub dual_pane_enabled: bool,
    pub confirm_delete: bool,
    pub view_preferences: ViewPreferences,
    pub index: IndexSettings,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "system".into(),
            show_hidden_files: false,
            show_file_extensions: true,
            default_view_mode: "details".into(),
            dual_pane_enabled: false,
            confirm_delete: true,
            view_preferences: ViewPreferences::default(),
            index: IndexSettings::default(),
        }
    }
}

pub fn settings_file_path() -> PathBuf {
    #[cfg(windows)]
    {
        if let Ok(app_data) = std::env::var("APPDATA") {
            return PathBuf::from(app_data).join("FinestFile").join("settings.json");
        }
    }
    PathBuf::from("settings.json")
}

pub fn load_settings(path: &Path) -> AppSettings {
    if let Ok(content) = fs::read_to_string(path) {
        if let Ok(settings) = serde_json::from_str::<AppSettings>(&content) {
            return settings;
        }
    }
    AppSettings::default()
}

pub fn save_settings(path: &Path, settings: &AppSettings) -> FsResult<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| FsError::io(e, parent))?;
    }
    let data = serde_json::to_string_pretty(settings)
        .map_err(|e| FsError::new(crate::error::ErrorCode::Io, e.to_string()))?;
    fs::write(path, data).map_err(|e| FsError::io(e, path))?;
    Ok(())
}
