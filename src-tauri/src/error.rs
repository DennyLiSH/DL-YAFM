use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FileExplorerError {
    PathNotFound(String),
    PermissionDenied(String),
    InvalidPath(String),
    IoError(String),
    AlreadyExists(String),
    NotEmpty(String),
    Unknown(String),
    ConfigError(String),
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

impl std::fmt::Display for FileExplorerError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            FileExplorerError::PathNotFound(msg) => write!(f, "Path not found: {}", msg),
            FileExplorerError::PermissionDenied(msg) => write!(f, "Permission denied: {}", msg),
            FileExplorerError::InvalidPath(msg) => write!(f, "Invalid path: {}", msg),
            FileExplorerError::IoError(msg) => write!(f, "IO error: {}", msg),
            FileExplorerError::AlreadyExists(msg) => write!(f, "Already exists: {}", msg),
            FileExplorerError::NotEmpty(msg) => write!(f, "Directory not empty: {}", msg),
            FileExplorerError::Unknown(msg) => write!(f, "Unknown error: {}", msg),
            FileExplorerError::ConfigError(msg) => write!(f, "Config error: {}", msg),
            FileExplorerError::TrashError(msg) => write!(f, "Trash error: {}", msg),
        }
    }
}
