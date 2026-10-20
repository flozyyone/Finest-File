//! User settings and persistence.

use crate::error::{FsError, FsResult};
use crate::index::IndexSettings;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

use crate::sorting::ViewPreferences;

fn default_language() -> String {
    #[cfg(windows)]
    {
        if let Ok(lang) = std::env::var("LANG") {
            let l = lang.to_lowercase();
            for prefix in &["tr", "ur", "fr", "de", "ar", "ru", "es"] {
                if l.starts_with(prefix) {
                    return (*prefix).to_string();
                }
            }
        }
    }
    "en".into()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub theme: String, // "system", "light", "dark"
    pub accent_color: String, // "blue", "teal", "purple", "amber", "emerald", "slate"
    pub font_family: String, // "system", "segoe", "cascadia", "aptos", "consolas"
    pub font_size: String, // "small", "medium", "large"
    #[serde(default = "default_language")]
    pub language: String, // "tr", "en", "ur", "fr", "de", "ar", "ru", "es"
    pub show_hidden_files: bool,
    pub show_file_extensions: bool,
    pub default_view_mode: String, // "details", "grid"
    pub dual_pane_enabled: bool,
    pub confirm_delete: bool,
    pub view_preferences: ViewPreferences,
    #[serde(default)]
    pub custom_shortcuts: std::collections::HashMap<String, String>,
    #[serde(default = "default_grid_pixel_size")]
    pub grid_pixel_size: u32,
    #[serde(default)]
    pub preview_pane_open: bool,
    #[serde(default)]
    pub windows_explorer_mode: bool,
    pub index: IndexSettings,
}

fn default_grid_pixel_size() -> u32 {
    96
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "system".into(),
            accent_color: "blue".into(),
            font_family: "system".into(),
            font_size: "medium".into(),
            language: default_language(),
            show_hidden_files: false,
            show_file_extensions: true,
            default_view_mode: "details".into(),
            dual_pane_enabled: false,
            confirm_delete: true,
            view_preferences: ViewPreferences::default(),
            custom_shortcuts: std::collections::HashMap::new(),
            grid_pixel_size: 96,
            preview_pane_open: false,
            windows_explorer_mode: false,
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
