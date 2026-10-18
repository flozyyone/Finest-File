use serde::Serialize;
use std::io;
use std::path::Path;

/// Stable, machine-readable error codes shared with the frontend.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ErrorCode {
    NotFound,
    PermissionDenied,
    AlreadyExists,
    InvalidName,
    InvalidPath,
    NotADirectory,
    IsADirectory,
    DirectoryNotEmpty,
    DestinationInsideSource,
    SameLocation,
    CrossDevice,
    UnsafeArchivePath,
    UnsupportedFormat,
    ArchiveCorrupt,
    LimitExceeded,
    Cancelled,
    Busy,
    DeviceNotReady,
    Database,
    Io,
    Unsupported,
}

#[derive(Debug, Clone, Serialize, thiserror::Error)]
#[error("{message}")]
pub struct FsError {
    pub code: ErrorCode,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
}

pub type FsResult<T> = Result<T, FsError>;

impl FsError {
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self { code, message: message.into(), path: None }
    }

    pub fn with_path(mut self, path: &Path) -> Self {
        self.path = Some(path.to_string_lossy().into_owned());
        self
    }

    pub fn cancelled() -> Self {
        Self::new(ErrorCode::Cancelled, "The operation was cancelled.")
    }

    /// Converts an `io::Error` into a user-presentable error associated with `path`.
    pub fn io(err: io::Error, path: &Path) -> Self {
        let code = classify_io(&err);
        let shown = path.display();
        let message = match code {
            ErrorCode::NotFound => format!("\"{shown}\" no longer exists or cannot be found."),
            ErrorCode::PermissionDenied => {
                format!("Access to \"{shown}\" was denied. It may be in use or require administrator rights.")
            }
            ErrorCode::AlreadyExists => format!("\"{shown}\" already exists."),
            ErrorCode::DirectoryNotEmpty => format!("The folder \"{shown}\" is not empty."),
            ErrorCode::NotADirectory => format!("\"{shown}\" is not a folder."),
            ErrorCode::DeviceNotReady => format!("The device for \"{shown}\" is not ready or was disconnected."),
            ErrorCode::InvalidName => format!("\"{shown}\" is not a valid name or path."),
            ErrorCode::CrossDevice => format!("\"{shown}\" is on a different drive."),
            _ => format!("{err} ({shown})"),
        };
        Self { code, message, path: Some(path.to_string_lossy().into_owned()) }
    }
}

fn classify_io(err: &io::Error) -> ErrorCode {
    // Windows-specific raw error codes first; they are more precise than ErrorKind.
    if let Some(raw) = err.raw_os_error() {
        match raw {
            2 | 3 | 161 => return ErrorCode::NotFound,            // FILE/PATH_NOT_FOUND, BAD_PATHNAME
            5 | 32 | 33 => return ErrorCode::PermissionDenied,    // ACCESS_DENIED, SHARING/LOCK_VIOLATION
            17 => return ErrorCode::CrossDevice,                  // NOT_SAME_DEVICE
            21 | 1167 => return ErrorCode::DeviceNotReady,        // NOT_READY, DEVICE_NOT_CONNECTED
            80 | 183 => return ErrorCode::AlreadyExists,          // FILE_EXISTS, ALREADY_EXISTS
            123 => return ErrorCode::InvalidName,                 // INVALID_NAME
            145 => return ErrorCode::DirectoryNotEmpty,           // DIR_NOT_EMPTY
            267 => return ErrorCode::NotADirectory,               // DIRECTORY
            _ => {}
        }
    }
    match err.kind() {
        io::ErrorKind::NotFound => ErrorCode::NotFound,
        io::ErrorKind::PermissionDenied => ErrorCode::PermissionDenied,
        io::ErrorKind::AlreadyExists => ErrorCode::AlreadyExists,
        io::ErrorKind::DirectoryNotEmpty => ErrorCode::DirectoryNotEmpty,
        io::ErrorKind::NotADirectory => ErrorCode::NotADirectory,
        io::ErrorKind::IsADirectory => ErrorCode::IsADirectory,
        io::ErrorKind::InvalidFilename | io::ErrorKind::InvalidInput => ErrorCode::InvalidName,
        io::ErrorKind::CrossesDevices => ErrorCode::CrossDevice,
        _ => ErrorCode::Io,
    }
}

impl From<rusqlite::Error> for FsError {
    fn from(e: rusqlite::Error) -> Self {
        FsError::new(ErrorCode::Database, format!("Index database error: {e}"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_windows_codes() {
        let e = FsError::io(io::Error::from_raw_os_error(5), Path::new("C:\\x"));
        assert_eq!(e.code, ErrorCode::PermissionDenied);
        let e = FsError::io(io::Error::from_raw_os_error(2), Path::new("C:\\x"));
        assert_eq!(e.code, ErrorCode::NotFound);
        assert_eq!(e.path.as_deref(), Some("C:\\x"));
    }
}
