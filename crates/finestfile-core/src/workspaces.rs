//! Workspaces and Named Tab Groups.
//!
//! Provides persistent named workspaces, tab group organization,
//! export/import, and the "Grupla" functionality.

use crate::error::{ErrorCode, FsError, FsResult};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceTab {
    pub id: String,
    pub path: String,
    pub title: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub tabs: Vec<WorkspaceTab>,
    pub active_tab_id: String,
    pub is_dual_pane: bool,
    pub secondary_path: Option<String>,
    pub created_at_ms: i64,
    pub updated_at_ms: i64,
}

pub fn workspaces_file_path() -> PathBuf {
    #[cfg(windows)]
    {
        if let Ok(app_data) = std::env::var("APPDATA") {
            return PathBuf::from(app_data).join("FinestFile").join("workspaces.json");
        }
    }
    PathBuf::from("workspaces.json")
}

pub fn list_workspaces() -> Vec<Workspace> {
    let path = workspaces_file_path();
    if let Ok(content) = fs::read_to_string(&path) {
        if let Ok(list) = serde_json::from_str::<Vec<Workspace>>(&content) {
            return list;
        }
    }
    Vec::new()
}

pub fn save_workspace(
    name: &str,
    tabs: Vec<WorkspaceTab>,
    active_tab_id: &str,
    is_dual_pane: bool,
    secondary_path: Option<String>,
) -> FsResult<Workspace> {
    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);

    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err(FsError::new(ErrorCode::InvalidPath, "Workspace name cannot be empty"));
    }

    let mut workspaces = list_workspaces();
    let id = format!("ws_{}", now_ms);

    let ws = Workspace {
        id,
        name: trimmed.to_string(),
        tabs,
        active_tab_id: active_tab_id.to_string(),
        is_dual_pane,
        secondary_path,
        created_at_ms: now_ms,
        updated_at_ms: now_ms,
    };

    workspaces.push(ws.clone());

    let file_path = workspaces_file_path();
    if let Some(parent) = file_path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    let json = serde_json::to_string_pretty(&workspaces)
        .map_err(|e| FsError::new(ErrorCode::Io, e.to_string()))?;
    fs::write(&file_path, json).map_err(|e| FsError::io(e, &file_path))?;

    Ok(ws)
}

pub fn delete_workspace(id: &str) -> FsResult<()> {
    let mut workspaces = list_workspaces();
    workspaces.retain(|w| w.id != id);

    let file_path = workspaces_file_path();
    let json = serde_json::to_string_pretty(&workspaces)
        .map_err(|e| FsError::new(ErrorCode::Io, e.to_string()))?;
    fs::write(&file_path, json).map_err(|e| FsError::io(e, &file_path))?;

    Ok(())
}

pub fn export_workspaces(export_path: &Path) -> FsResult<()> {
    let workspaces = list_workspaces();
    let json = serde_json::to_string_pretty(&workspaces)
        .map_err(|e| FsError::new(ErrorCode::Io, e.to_string()))?;
    fs::write(export_path, json).map_err(|e| FsError::io(e, export_path))?;
    Ok(())
}

pub fn import_workspaces(import_path: &Path) -> FsResult<usize> {
    let content = fs::read_to_string(import_path).map_err(|e| FsError::io(e, import_path))?;
    let imported: Vec<Workspace> = serde_json::from_str(&content)
        .map_err(|e| FsError::new(ErrorCode::Io, format!("Invalid workspaces format: {e}")))?;

    let mut existing = list_workspaces();
    let count = imported.len();

    for item in imported {
        if !existing.iter().any(|e| e.name == item.name) {
            existing.push(item);
        }
    }

    let file_path = workspaces_file_path();
    let json = serde_json::to_string_pretty(&existing)
        .map_err(|e| FsError::new(ErrorCode::Io, e.to_string()))?;
    fs::write(&file_path, json).map_err(|e| FsError::io(e, &file_path))?;

    Ok(count)
}
