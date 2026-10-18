//! Persistent window state and display boundary validation.

use crate::error::{ErrorCode, FsError, FsResult};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

pub const MIN_WINDOW_WIDTH: u32 = 640;
pub const MIN_WINDOW_HEIGHT: u32 = 480;
pub const DEFAULT_WINDOW_WIDTH: u32 = 1080;
pub const DEFAULT_WINDOW_HEIGHT: u32 = 720;

/// Represents a monitor's working area on the desktop.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct MonitorBounds {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WindowState {
    /// Last restored (unmaximized) width.
    pub width: u32,
    /// Last restored (unmaximized) height.
    pub height: u32,
    /// Last restored X coordinate on virtual desktop.
    pub x: Option<i32>,
    /// Last restored Y coordinate on virtual desktop.
    pub y: Option<i32>,
    /// Whether the window was left maximized.
    pub is_maximized: bool,
    /// True until the user's first launch has completed.
    pub first_launch: bool,
}

impl Default for WindowState {
    fn default() -> Self {
        Self {
            width: DEFAULT_WINDOW_WIDTH,
            height: DEFAULT_WINDOW_HEIGHT,
            x: None,
            y: None,
            is_maximized: true, // First launch requirement: open maximized
            first_launch: true,
        }
    }
}

impl WindowState {
    /// Updates restored dimensions when resizing, ignoring temporary maximized dimensions.
    pub fn update_restored_size(&mut self, width: u32, height: u32) {
        if !self.is_maximized {
            self.width = width.max(MIN_WINDOW_WIDTH);
            self.height = height.max(MIN_WINDOW_HEIGHT);
            self.first_launch = false;
        }
    }

    /// Updates restored position when moving, ignoring moves during maximization.
    pub fn update_restored_position(&mut self, x: i32, y: i32) {
        if !self.is_maximized {
            self.x = Some(x);
            self.y = Some(y);
            self.first_launch = false;
        }
    }

    /// Marks whether the window is currently maximized.
    pub fn set_maximized(&mut self, maximized: bool) {
        self.is_maximized = maximized;
        self.first_launch = false;
    }

    /// Validates window coordinates against active monitors.
    /// If coordinates are off-screen or out-of-bounds (e.g. after monitor disconnect),
    /// recovers safely by repositioning onto the primary/first monitor.
    pub fn validate_and_recover(&mut self, monitors: &[MonitorBounds]) {
        self.width = self.width.max(MIN_WINDOW_WIDTH);
        self.height = self.height.max(MIN_WINDOW_HEIGHT);

        if monitors.is_empty() {
            return;
        }

        let primary = &monitors[0];

        // Ensure window dimensions do not exceed the monitor size
        if self.width > primary.width {
            self.width = primary.width.max(MIN_WINDOW_WIDTH);
        }
        if self.height > primary.height {
            self.height = primary.height.max(MIN_WINDOW_HEIGHT);
        }

        let (wx, wy) = match (self.x, self.y) {
            (Some(x), Some(y)) => (x, y),
            _ => {
                // If not set, center on primary monitor
                self.center_on_monitor(primary);
                return;
            }
        };

        // Check if window has at least 100px overlap with ANY active monitor
        let min_visible_margin = 100i32;
        let is_visible = monitors.iter().any(|m| {
            let m_right = m.x + m.width as i32;
            let m_bottom = m.y + m.height as i32;
            let w_right = wx + self.width as i32;
            let w_bottom = wy + self.height as i32;

            wx < m_right - min_visible_margin
                && w_right > m.x + min_visible_margin
                && wy < m_bottom - min_visible_margin
                && w_bottom > m.y + min_visible_margin
        });

        if !is_visible {
            // Recover off-screen window by centering on primary monitor
            self.center_on_monitor(primary);
        }
    }

    fn center_on_monitor(&mut self, monitor: &MonitorBounds) {
        let cx = monitor.x + ((monitor.width.saturating_sub(self.width)) / 2) as i32;
        let cy = monitor.y + ((monitor.height.saturating_sub(self.height)) / 2) as i32;
        self.x = Some(cx);
        self.y = Some(cy);
    }
}

pub fn window_state_file_path() -> PathBuf {
    #[cfg(windows)]
    {
        if let Ok(app_data) = std::env::var("APPDATA") {
            return PathBuf::from(app_data)
                .join("FinestFile")
                .join("window_state.json");
        }
    }
    PathBuf::from("window_state.json")
}

pub fn load_window_state(path: &Path) -> WindowState {
    if let Ok(content) = fs::read_to_string(path) {
        if let Ok(state) = serde_json::from_str::<WindowState>(&content) {
            return state;
        }
    }
    WindowState::default()
}

pub fn save_window_state(path: &Path, state: &WindowState) -> FsResult<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| FsError::io(e, parent))?;
    }
    let data = serde_json::to_string_pretty(state)
        .map_err(|e| FsError::new(ErrorCode::Io, e.to_string()))?;
    fs::write(path, data).map_err(|e| FsError::io(e, path))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_first_launch_opens_maximized() {
        let state = WindowState::default();
        assert!(state.first_launch);
        assert!(state.is_maximized);
        assert_eq!(state.width, DEFAULT_WINDOW_WIDTH);
        assert_eq!(state.height, DEFAULT_WINDOW_HEIGHT);
    }

    #[test]
    fn test_restored_dimensions_preservation_on_maximize() {
        let mut state = WindowState::default();
        state.is_maximized = false;
        state.update_restored_size(1280, 800);
        state.update_restored_position(150, 100);

        assert_eq!(state.width, 1280);
        assert_eq!(state.height, 800);
        assert_eq!(state.x, Some(150));
        assert_eq!(state.y, Some(100));

        // Now user maximizes window
        state.set_maximized(true);
        assert!(state.is_maximized);

        // Attempting to update restored size while maximized must NOT clobber stored restored size
        state.update_restored_size(1920, 1080);
        state.update_restored_position(0, 0);

        assert_eq!(state.width, 1280);
        assert_eq!(state.height, 800);
        assert_eq!(state.x, Some(150));
        assert_eq!(state.y, Some(100));

        // User unmaximizes (restores)
        state.set_maximized(false);
        assert_eq!(state.width, 1280);
        assert_eq!(state.height, 800);
    }

    #[test]
    fn test_off_screen_and_monitor_disconnect_recovery() {
        let mut state = WindowState {
            width: 1000,
            height: 700,
            x: Some(4500), // Far away on previously connected 2nd monitor
            y: Some(300),
            is_maximized: false,
            first_launch: false,
        };

        // Only single 1920x1080 monitor currently connected
        let monitors = vec![MonitorBounds {
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
        }];

        state.validate_and_recover(&monitors);

        // Must be recovered and centered on the available monitor
        assert!(state.x.unwrap() >= 0 && state.x.unwrap() < 1920);
        assert!(state.y.unwrap() >= 0 && state.y.unwrap() < 1080);
        assert_eq!(state.width, 1000);
        assert_eq!(state.height, 700);
    }

    #[test]
    fn test_enforce_minimum_dimensions() {
        let mut state = WindowState::default();
        state.is_maximized = false;
        state.update_restored_size(200, 100);
        assert_eq!(state.width, MIN_WINDOW_WIDTH);
        assert_eq!(state.height, MIN_WINDOW_HEIGHT);
    }

    #[test]
    fn test_window_state_serialization_roundtrip() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("window_state.json");

        let mut original = WindowState::default();
        original.is_maximized = false;
        original.width = 1150;
        original.height = 760;
        original.x = Some(200);
        original.y = Some(150);
        original.first_launch = false;

        save_window_state(&path, &original).unwrap();
        let loaded = load_window_state(&path);

        assert_eq!(original, loaded);
    }
}
