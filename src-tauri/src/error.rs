use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Clone, Serialize, Deserialize, Error)]
pub enum FileExplorerError {
    #[error("Path not found: {0}")]
    PathNotFound(String),

    #[error("Permission denied: {0}")]
    PermissionDenied(String),

    #[error("Invalid path: {0}")]
    InvalidPath(String),

    #[error("IO error: {0}")]
    IoError(String),

    #[error("Already exists: {0}")]
    AlreadyExists(String),

    #[error("Directory not empty: {0}")]
    NotEmpty(String),

    #[error("Unknown error: {0}")]
    Unknown(String),

    #[error("Config error: {0}")]
    ConfigError(String),

    #[error("Trash error: {0}")]
    TrashError(String),
}

pub type Result<T> = std::result::Result<T, FileExplorerError>;

impl From<std::io::Error> for FileExplorerError {
    fn from(err: std::io::Error) -> Self {
        match err.kind() {
            std::io::ErrorKind::NotFound => FileExplorerError::PathNotFound(err.to_string()),
            std::io::ErrorKind::PermissionDenied => FileExplorerError::PermissionDenied(err.to_string()),
            std::io::ErrorKind::AlreadyExists => FileExplorerError::AlreadyExists(err.to_string()),
            _ => FileExplorerError::IoError(err.to_string()),
        }
    }
}

impl From<trash::Error> for FileExplorerError {
    fn from(err: trash::Error) -> Self {
        FileExplorerError::TrashError(err.to_string())
    }
}
