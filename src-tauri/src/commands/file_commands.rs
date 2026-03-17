use crate::error::{FileExplorerError, Result};
use crate::models::FileEntry;
use crate::RootPathState;
use std::fs;
use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Instant;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_fs::FsExt;
use tauri_plugin_opener::OpenerExt;
use base64::{engine::general_purpose::STANDARD, Engine};

/// Copy progress information
#[derive(Debug, Clone, serde::Serialize)]
pub struct CopyProgress {
    pub task_id: String,
    pub source: String,
    pub dest: String,
    pub current_file: String,
    pub files_copied: usize,
    pub total_files: usize,
    pub bytes_copied: u64,
    pub total_bytes: u64,
    pub percentage: f64,
    pub speed_mbps: f64,
    pub is_complete: bool,
    pub error: Option<String>,
}

/// Global copy task state - simplified approach
use parking_lot::Mutex;
use once_cell::sync::Lazy;

static COPY_CANCEL_FLAGS: Lazy<Mutex<std::collections::HashMap<String, Arc<AtomicBool>>>> =
    Lazy::new(|| Mutex::new(std::collections::HashMap::new()));

#[tauri::command]
pub fn grant_directory_access(app: AppHandle, path: String) -> Result<()> {
    let dir_path = Path::new(&path);

    if !dir_path.exists() {
        return Err(FileExplorerError::PathNotFound(path));
    }

    if !dir_path.is_dir() {
        return Err(FileExplorerError::InvalidPath(format!("{} is not a directory", path)));
    }

    // Grant access to the directory and all subdirectories
    let scope = app.fs_scope();
    scope.allow_directory(&path, true).map_err(|e| {
        FileExplorerError::InvalidPath(format!("Failed to grant access: {}", e))
    })?;

    // Save the root path for security checks
    let root_path_state = app.state::<RootPathState>();
    let mut root_path = root_path_state.inner.lock();
    *root_path = Some(dir_path.canonicalize().unwrap_or_else(|_| dir_path.to_path_buf()));

    Ok(())
}

#[tauri::command]
pub fn get_directory_entries(path: String) -> Result<Vec<FileEntry>> {
    let dir_path = Path::new(&path);

    if !dir_path.exists() {
        return Err(FileExplorerError::PathNotFound(path));
    }

    if !dir_path.is_dir() {
        return Err(FileExplorerError::InvalidPath(format!("{} is not a directory", path)));
    }

    let entries: Vec<FileEntry> = fs::read_dir(dir_path)
        .map_err(FileExplorerError::from)?
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| FileEntry::from_path(&entry.path()))
        .collect();

    // Sort: directories first, then by name
    let mut entries = entries;
    entries.sort_by(|a, b| {
        if a.is_dir == b.is_dir {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        } else if a.is_dir {
            std::cmp::Ordering::Less
        } else {
            std::cmp::Ordering::Greater
        }
    });

    Ok(entries)
}

#[tauri::command]
pub fn create_directory(path: String) -> Result<()> {
    let dir_path = Path::new(&path);

    if dir_path.exists() {
        return Err(FileExplorerError::AlreadyExists(path));
    }

    fs::create_dir_all(dir_path)?;
    Ok(())
}

#[tauri::command]
pub fn delete_entry(path: String, #[allow(unused_variables)] recursive: bool) -> Result<()> {
    let entry_path = Path::new(&path);

    if !entry_path.exists() {
        return Err(FileExplorerError::PathNotFound(path));
    }

    // Note: `recursive` parameter is currently ignored because trash::delete
    // always handles both files and directories recursively.
    // This parameter is kept for API compatibility and future extensions.
    // 使用 trash crate 将文件/文件夹移动到系统回收站
    // trash::delete 会自动处理目录和文件，无需区分
    trash::delete(entry_path)?;

    Ok(())
}

#[tauri::command]
pub fn rename_entry(old_path: String, new_name: String) -> Result<()> {
    let old = Path::new(&old_path);

    if !old.exists() {
        return Err(FileExplorerError::PathNotFound(old_path));
    }

    let parent = old.parent().ok_or_else(|| {
        FileExplorerError::InvalidPath("Cannot rename root directory".to_string())
    })?;

    let new = parent.join(&new_name);

    if new.exists() {
        return Err(FileExplorerError::AlreadyExists(new_name));
    }

    fs::rename(old, new)?;
    Ok(())
}

#[tauri::command]
pub fn copy_file(source: String, dest: String) -> Result<()> {
    let src_path = Path::new(&source);
    let dest_path = Path::new(&dest);

    if !src_path.exists() {
        return Err(FileExplorerError::PathNotFound(source));
    }

    if src_path.is_dir() {
        return Err(FileExplorerError::InvalidPath("Source must be a file, not a directory".to_string()));
    }

    fs::copy(src_path, dest_path)?;
    Ok(())
}

/// Count files and total size in a directory
fn count_dir_contents(dir: &Path) -> std::io::Result<(usize, u64)> {
    let mut count = 0;
    let mut total_size = 0u64;

    fn count_recursive(path: &Path, count: &mut usize, size: &mut u64) -> std::io::Result<()> {
        for entry in fs::read_dir(path)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_dir() {
                count_recursive(&path, count, size)?;
            } else {
                *count += 1;
                *size += entry.metadata()?.len();
            }
        }
        Ok(())
    }

    count_recursive(dir, &mut count, &mut total_size)?;
    Ok((count, total_size))
}

/// Async copy with progress reporting
#[tauri::command]
pub async fn copy_entry_async(
    app: AppHandle,
    task_id: String,
    source: String,
    dest: String,
) -> Result<()> {
    let src_path = Path::new(&source).to_path_buf();
    let dest_path = Path::new(&dest).to_path_buf();

    if !src_path.exists() {
        return Err(FileExplorerError::PathNotFound(source));
    }

    // Create cancellation flag
    let cancelled = Arc::new(AtomicBool::new(false));
    COPY_CANCEL_FLAGS.lock().insert(task_id.clone(), cancelled.clone());

    let is_dir = src_path.is_dir();

    // Count total files and size for progress tracking
    let (total_files, total_bytes) = if is_dir {
        count_dir_contents(&src_path).unwrap_or((0, 0))
    } else {
        (1, fs::metadata(&src_path).map(|m| m.len()).unwrap_or(0))
    };

    // Emit initial progress
    let _ = app.emit("copy-progress", CopyProgress {
        task_id: task_id.clone(),
        source: source.clone(),
        dest: dest.clone(),
        current_file: String::new(),
        files_copied: 0,
        total_files,
        bytes_copied: 0,
        total_bytes,
        percentage: 0.0,
        speed_mbps: 0.0,
        is_complete: false,
        error: None,
    });

    let start_time = Instant::now();

    // Perform copy
    let result = if is_dir {
        copy_dir_with_progress(
            &src_path,
            &dest_path,
            cancelled.clone(),
            &app,
            &task_id,
            &source,
            &dest,
            total_files,
            total_bytes,
            start_time,
        ).await
    } else {
        // Single file copy
        if cancelled.load(Ordering::SeqCst) {
            Err(FileExplorerError::InvalidPath("Operation cancelled".to_string()))
        } else {
            let file_name = src_path.file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_else(|| "unknown".to_string());

            match tokio::fs::copy(&src_path, &dest_path).await {
                Ok(copied_bytes) => {
                    // Emit final progress for single file
                    let _ = app.emit("copy-progress", CopyProgress {
                        task_id: task_id.clone(),
                        source: source.clone(),
                        dest: dest.clone(),
                        current_file: file_name.clone(),
                        files_copied: 1,
                        total_files: 1,
                        bytes_copied: copied_bytes,
                        total_bytes: copied_bytes,
                        percentage: 100.0,
                        speed_mbps: 0.0,
                        is_complete: true,
                        error: None,
                    });
                    Ok(())
                }
                Err(e) => Err(FileExplorerError::from(e)),
            }
        }
    };

    // Clean up task
    COPY_CANCEL_FLAGS.lock().remove(&task_id);

    // Emit final progress for directory copy (single file already emits)
    if is_dir {
        match &result {
            Ok(()) => {
                let _ = app.emit("copy-progress", CopyProgress {
                    task_id,
                    source,
                    dest,
                    current_file: String::new(),
                    files_copied: total_files,
                    total_files,
                    bytes_copied: total_bytes,
                    total_bytes,
                    percentage: 100.0,
                    speed_mbps: 0.0,
                    is_complete: true,
                    error: None,
                });
            }
            Err(e) => {
                let _ = app.emit("copy-progress", CopyProgress {
                    task_id,
                    source,
                    dest,
                    current_file: String::new(),
                    files_copied: 0,
                    total_files,
                    bytes_copied: 0,
                    total_bytes,
                    percentage: 0.0,
                    speed_mbps: 0.0,
                    is_complete: true,
                    error: Some(e.to_string()),
                });
            }
        }
    }

    result
}

/// Async recursive directory copy with progress
async fn copy_dir_with_progress(
    src: &Path,
    dst: &Path,
    cancelled: Arc<AtomicBool>,
    app: &AppHandle,
    task_id: &str,
    source: &str,
    dest: &str,
    total_files: usize,
    total_bytes: u64,
    start_time: Instant,
) -> Result<()> {
    // Use shared counters for accurate progress tracking
    use std::sync::atomic::{AtomicU64, AtomicUsize};

    let files_copied = Arc::new(AtomicUsize::new(0));
    let bytes_copied = Arc::new(AtomicU64::new(0));

    copy_dir_recursive(
        src,
        dst,
        cancelled.clone(),
        app,
        task_id,
        source,
        dest,
        total_files,
        total_bytes,
        start_time,
        files_copied.clone(),
        bytes_copied.clone(),
    ).await
}

/// Recursive helper function with progress tracking
async fn copy_dir_recursive(
    src: &Path,
    dst: &Path,
    cancelled: Arc<AtomicBool>,
    app: &AppHandle,
    task_id: &str,
    source: &str,
    dest: &str,
    total_files: usize,
    total_bytes: u64,
    start_time: Instant,
    files_copied: Arc<std::sync::atomic::AtomicUsize>,
    bytes_copied: Arc<std::sync::atomic::AtomicU64>,
) -> Result<()> {
    if cancelled.load(Ordering::SeqCst) {
        return Err(FileExplorerError::InvalidPath("Operation cancelled".to_string()));
    }

    tokio::fs::create_dir_all(dst).await
        .map_err(FileExplorerError::from)?;

    let mut entries = tokio::fs::read_dir(src).await
        .map_err(FileExplorerError::from)?;

    while let Some(entry) = entries.next_entry().await.map_err(FileExplorerError::from)? {
        if cancelled.load(Ordering::SeqCst) {
            return Err(FileExplorerError::InvalidPath("Operation cancelled".to_string()));
        }

        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        let file_name = entry.file_name()
            .to_string_lossy()
            .to_string();

        if src_path.is_dir() {
            Box::pin(copy_dir_recursive(
                &src_path,
                &dst_path,
                cancelled.clone(),
                app,
                task_id,
                source,
                dest,
                total_files,
                total_bytes,
                start_time,
                files_copied.clone(),
                bytes_copied.clone(),
            )).await?;
        } else {
            let copied = tokio::fs::copy(&src_path, &dst_path).await
                .map_err(FileExplorerError::from)?;

            // Update counters
            let current_files = files_copied.fetch_add(1, Ordering::SeqCst) + 1;
            let current_bytes = bytes_copied.fetch_add(copied, Ordering::SeqCst) + copied;

            // Emit progress for each file
            let elapsed = start_time.elapsed().as_secs_f64();
            let speed = if elapsed > 0.0 {
                (current_bytes as f64) / elapsed / 1024.0 / 1024.0
            } else {
                0.0
            };

            let percentage = if total_bytes > 0 {
                (current_bytes as f64 / total_bytes as f64) * 100.0
            } else {
                0.0
            };

            let _ = app.emit("copy-progress", CopyProgress {
                task_id: task_id.to_string(),
                source: source.to_string(),
                dest: dest.to_string(),
                current_file: file_name,
                files_copied: current_files,
                total_files,
                bytes_copied: current_bytes,
                total_bytes,
                percentage,
                speed_mbps: speed,
                is_complete: false,
                error: None,
            });
        }
    }

    Ok(())
}

/// Cancel a copy task
#[tauri::command]
pub fn cancel_copy_task(task_id: String) -> bool {
    if let Some(flag) = COPY_CANCEL_FLAGS.lock().get(&task_id) {
        flag.store(true, Ordering::SeqCst);
        true
    } else {
        false
    }
}

/// Legacy sync copy (kept for backward compatibility)
#[tauri::command]
pub fn copy_entry(source: String, dest: String) -> Result<()> {
    let src_path = Path::new(&source);
    let dest_path = Path::new(&dest);

    if !src_path.exists() {
        return Err(FileExplorerError::PathNotFound(source));
    }

    if src_path.is_dir() {
        copy_dir_all(src_path, dest_path)?;
    } else {
        fs::copy(src_path, dest_path)?;
    }
    Ok(())
}

fn copy_dir_all(src: &Path, dst: &Path) -> Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        if src_path.is_dir() {
            copy_dir_all(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path)?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn read_file_as_base64(path: String) -> Result<String> {
    let file_path = Path::new(&path);

    if !file_path.exists() {
        return Err(FileExplorerError::PathNotFound(path));
    }

    if file_path.is_dir() {
        return Err(FileExplorerError::InvalidPath("Cannot read directory as base64".to_string()));
    }

    let bytes = fs::read(file_path)?;
    Ok(STANDARD.encode(&bytes))
}

#[tauri::command]
pub fn read_file_content(path: String) -> Result<String> {
    let file_path = Path::new(&path);

    if !file_path.exists() {
        return Err(FileExplorerError::PathNotFound(path));
    }

    if file_path.is_dir() {
        return Err(FileExplorerError::InvalidPath("Cannot read directory".to_string()));
    }

    let content = fs::read_to_string(file_path)?;
    Ok(content)
}

#[tauri::command]
pub fn create_file(path: String) -> Result<()> {
    let file_path = Path::new(&path);

    if file_path.exists() {
        return Err(FileExplorerError::AlreadyExists(path));
    }

    fs::File::create(file_path)?;
    Ok(())
}

#[tauri::command]
pub fn search_files(directory: String, query: String) -> Result<Vec<FileEntry>> {
    let dir_path = Path::new(&directory);

    if !dir_path.exists() {
        return Err(FileExplorerError::PathNotFound(directory));
    }

    let query_lower = query.to_lowercase();
    let mut results = Vec::new();

    fn search_recursive(dir: &Path, query: &str, results: &mut Vec<FileEntry>) {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();
                let name = path.file_name()
                    .map(|n| n.to_string_lossy().to_lowercase())
                    .unwrap_or_default();

                if name.contains(query) {
                    if let Some(file_entry) = FileEntry::from_path(&path) {
                        results.push(file_entry);
                    }
                }

                // Only search one level deep for performance
                if path.is_dir() && results.len() < 1000 {
                    search_recursive(&path, query, results);
                }
            }
        }
    }

    search_recursive(dir_path, &query_lower, &mut results);

    // Sort results
    results.sort_by(|a, b| {
        if a.is_dir == b.is_dir {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        } else if a.is_dir {
            std::cmp::Ordering::Less
        } else {
            std::cmp::Ordering::Greater
        }
    });

    Ok(results)
}

#[tauri::command]
pub fn check_path_exists(path: String) -> Result<bool> {
    Ok(Path::new(&path).exists())
}

/// Move a file or directory to a new location
#[tauri::command]
pub fn move_entry(source: String, dest: String) -> Result<()> {
    let src_path = Path::new(&source);
    let dest_path = Path::new(&dest);

    if !src_path.exists() {
        return Err(FileExplorerError::PathNotFound(source));
    }

    // Check if destination already exists
    if dest_path.exists() {
        return Err(FileExplorerError::AlreadyExists(dest));
    }

    // Ensure destination parent directory exists
    if let Some(dest_parent) = dest_path.parent() {
        if !dest_parent.exists() {
            return Err(FileExplorerError::PathNotFound(dest_parent.to_string_lossy().to_string()));
        }
    }

    // For directories, check that we're not moving a parent into its child
    if src_path.is_dir() {
        let src_canonical = src_path.canonicalize()
            .map_err(FileExplorerError::from)?;
        let dest_parent = dest_path.parent()
            .ok_or_else(|| FileExplorerError::InvalidPath("Invalid destination path".to_string()))?;

        if let Ok(dest_parent_canonical) = dest_parent.canonicalize() {
            // Check if destination parent is inside source (would create cycle)
            if dest_parent_canonical.starts_with(&src_canonical) {
                return Err(FileExplorerError::InvalidPath(
                    "Cannot move a directory into itself or its subdirectory".to_string()
                ));
            }
        }
    }

    // Perform the move using fs::rename
    // This works for both files and directories on the same filesystem
    fs::rename(src_path, dest_path)?;

    Ok(())
}

/// Open a file with system default application, with path security check
/// Only allows opening files within the user-selected root directory
#[tauri::command]
pub fn open_file_safe(app: AppHandle, path: String) -> Result<()> {
    let file_path = Path::new(&path);

    if !file_path.exists() {
        return Err(FileExplorerError::PathNotFound(path));
    }

    // Get the canonical path for comparison
    let canonical_path = file_path.canonicalize()
        .map_err(|e| FileExplorerError::InvalidPath(format!("Failed to resolve path: {}", e)))?;

    // Check if the path is within the allowed root directory
    let root_path_state = app.state::<RootPathState>();
    let root_path = root_path_state.inner.lock();

    match root_path.as_ref() {
        Some(root) => {
            // Check if the file is within the root directory
            if !canonical_path.starts_with(root) {
                return Err(FileExplorerError::InvalidPath(
                    "Access denied: path is outside the allowed directory".to_string()
                ));
            }
        }
        None => {
            return Err(FileExplorerError::InvalidPath(
                "No root directory has been selected".to_string()
            ));
        }
    }

    // Open the file with system default application
    app.opener()
        .open_path(&path, None::<&str>)
        .map_err(|e| FileExplorerError::InvalidPath(format!("Failed to open file: {}", e)))?;

    Ok(())
}
