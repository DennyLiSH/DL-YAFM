use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified_at: Option<u64>,
    pub created_at: Option<u64>,
    pub is_readonly: bool,
    pub is_hidden: bool,
    pub extension: Option<String>,
}

impl FileEntry {
    pub fn from_path(path: &Path) -> Option<Self> {
        let metadata = fs::metadata(path).ok()?;
        let name = path.file_name()?.to_string_lossy().to_string();
        let path_str = path.to_string_lossy().to_string();
        let is_dir = metadata.is_dir();

        let size = if is_dir { 0 } else { metadata.len() };

        let modified_at = metadata.modified().ok().and_then(|t| {
            t.duration_since(std::time::UNIX_EPOCH).ok().map(|d| d.as_secs())
        });

        let created_at = metadata.created().ok().and_then(|t| {
            t.duration_since(std::time::UNIX_EPOCH).ok().map(|d| d.as_secs())
        });

        let is_readonly = metadata.permissions().readonly();

        // Platform-specific hidden file detection
        #[cfg(windows)]
        let is_hidden = {
            use std::os::windows::fs::MetadataExt;
            const FILE_ATTRIBUTE_HIDDEN: u32 = 0x2;
            // Check Windows file attributes or name starting with '.'
            (metadata.file_attributes() & FILE_ATTRIBUTE_HIDDEN) != 0 || name.starts_with('.')
        };

        #[cfg(not(windows))]
        let is_hidden = name.starts_with('.');

        let extension = if is_dir {
            None
        } else {
            path.extension().map(|e| e.to_string_lossy().to_string())
        };

        Some(Self {
            name,
            path: path_str,
            is_dir,
            size,
            modified_at,
            created_at,
            is_readonly,
            is_hidden,
            extension,
        })
    }
}
