//! FinestFile core engine.
//!
//! This crate contains everything that touches the filesystem: directory listing,
//! file operations, archives, background jobs and the persistent index. It has no
//! dependency on the UI runtime so it can be tested in isolation.

pub mod archive;
pub mod error;
pub mod jobs;
pub mod listing;
pub mod model;
pub mod names;
pub mod ops;
pub mod platform;
pub mod search;
pub mod settings;
pub mod transfer;

pub mod index;

pub use error::{ErrorCode, FsError, FsResult};
