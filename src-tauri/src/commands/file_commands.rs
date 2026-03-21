use crate::error::{FileExplorerError, Result};
use crate::models::FileEntry;
use crate::RootPathState;
use std::fs;
use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering};
use std::time::Instant;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_fs::FsExt;
use tauri_plugin_opener::OpenerExt;
use base64::{engine::general_purpose::STANDARD, Engine};

/// Sort file entries: directories first, then by name (case-insensitive)
fn sort_entries(entries: &mut [FileEntry]) {
    entries.sort_by(|a, b| {
        if a.is_dir == b.is_dir {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        } else if a.is_dir {
            std::cmp::Ordering::Less
        } else {
            std::cmp::Ordering::Greater
        }
    });
}

/// Verify that a path is within the allowed root directory
/// Returns the canonical path if verification passes
fn verify_path_within_root(app: &AppHandle, path: &Path) -> Result<std::path::PathBuf> {
    let canonical_path = path.canonicalize()
        .map_err(|e| FileExplorerError::InvalidPath(format!("Failed to resolve path: {}", e)))?;

    let root_path_state = app.state::<RootPathState>();
    let root_path = root_path_state.inner.lock();

    match root_path.as_ref() {
        Some(root) => {
            if !canonical_path.starts_with(root) {
                return Err(FileExplorerError::InvalidPath(
                    "Access denied: path is outside the allowed directory".to_string()
                ));
            }
            Ok(canonical_path)
        }
        None => {
            Err(FileExplorerError::InvalidPath(
                "No root directory has been selected".to_string()
            ))
        }
    }
}

// Windows-specific: hide console window when spawning external commands
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Special path marker for system root
pub const SYSTEM_ROOT_PATH: &str = "system-root";

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

/// Internal: Copy operation context (immutable references)
struct CopyCtx<'a> {
    src: &'a Path,
    dst: &'a Path,
    app: &'a AppHandle,
    task_id: &'a str,
    source: &'a str,
    dest: &'a str,
}

/// Internal: Copy operation stats (read-only)
struct CopyStats {
    total_files: usize,
    total_bytes: u64,
    start_time: Instant,
}

/// Internal: Copy operation state (shared mutable)
struct CopyState {
    cancelled: Arc<AtomicBool>,
    files_copied: Arc<AtomicUsize>,
    bytes_copied: Arc<AtomicU64>,
}

/// Global copy task state - simplified approach
use parking_lot::Mutex;
use std::sync::LazyLock;

static COPY_CANCEL_FLAGS: LazyLock<Mutex<std::collections::HashMap<String, Arc<AtomicBool>>>> =
    LazyLock::new(|| Mutex::new(std::collections::HashMap::new()));

/// Global search task state for cancellation
static SEARCH_CANCEL_FLAGS: LazyLock<Mutex<std::collections::HashMap<String, Arc<AtomicBool>>>> =
    LazyLock::new(|| Mutex::new(std::collections::HashMap::new()));

/// Get system root entries (drives on Windows, "/" on Unix)
#[tauri::command]
pub fn get_system_root_entries() -> Result<Vec<FileEntry>> {
    #[cfg(target_os = "windows")]
    {
        get_windows_drives()
    }

    #[cfg(not(target_os = "windows"))]
    {
        get_unix_root_entries()
    }
}

/// Get Windows drive letters as FileEntries
#[cfg(target_os = "windows")]
fn get_windows_drives() -> Result<Vec<FileEntry>> {
    // Pre-allocate for max 26 drives (A-Z)
    let mut entries = Vec::with_capacity(26);

    for letter in b'A'..=b'Z' {
        let drive = format!("{}:\\", letter as char);
        let path = Path::new(&drive);
        if path.exists() {
            // Get drive label if possible
            let label = get_drive_label(&drive);
            let name = if label.is_empty() {
                format!("本地磁盘 (:{})", letter as char)
            } else {
                format!("{} (:{})", label, letter as char)
            };

            entries.push(FileEntry {
                name,
                path: drive.clone(),
                is_dir: true,
                size: 0,
                modified_at: None,
                created_at: None,
                is_readonly: false,
                is_hidden: false,
                extension: None,
            });
        }
    }

    Ok(entries)
}

/// Get drive label on Windows using Win32 API (fast, no external process)
#[cfg(target_os = "windows")]
fn get_drive_label(drive: &str) -> String {
    use std::ffi::OsString;
    use std::os::windows::ffi::{OsStrExt, OsStringExt};
    use windows_sys::Win32::Storage::FileSystem::GetVolumeInformationW;
    use std::ptr::null_mut;

    // Convert drive path to wide string (null-terminated)
    let wide_path: Vec<u16> = std::ffi::OsStr::new(drive)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let mut volume_name = [0u16; 256];

    let result = unsafe {
        GetVolumeInformationW(
            wide_path.as_ptr(),
            volume_name.as_mut_ptr(),
            volume_name.len() as u32,
            null_mut(),
            null_mut(),
            null_mut(),
            null_mut(),
            0,
        )
    };

    if result != 0 {
        // Find the null terminator
        let len = volume_name.iter().position(|&c| c == 0).unwrap_or(0);
        if len > 0 {
            let label = OsString::from_wide(&volume_name[..len]);
            if let Ok(s) = label.into_string() {
                return s;
            }
        }
    }

    String::new()
}

/// Get Unix root directory entries
#[cfg(not(target_os = "windows"))]
fn get_unix_root_entries() -> Result<Vec<FileEntry>> {
    let root = Path::new("/");

    let entries: Vec<FileEntry> = fs::read_dir(root)
        .map_err(FileExplorerError::from)?
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| {
            let path = entry.path();
            FileEntry::from_path(&path)
        })
        .collect();

    sort_entries(&mut entries);

    Ok(entries)
}

#[tauri::command]
pub fn grant_directory_access(app: AppHandle, path: String) -> Result<()> {
    // Handle system root access
    if path == SYSTEM_ROOT_PATH {
        #[cfg(target_os = "windows")]
        {
            let scope = app.fs_scope();
            for letter in b'A'..=b'Z' {
                let drive = format!("{}:\\", letter as char);
                if Path::new(&drive).exists() {
                    let _ = scope.allow_directory(&drive, true);
                }
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            let scope = app.fs_scope();
            scope.allow_directory("/", true).map_err(|e| {
                FileExplorerError::InvalidPath(format!("Failed to grant root access: {}", e))
            })?;
        }

        // Set root path state to None (system root mode)
        let root_path_state = app.state::<RootPathState>();
        let mut root_path = root_path_state.inner.lock();
        *root_path = None;

        return Ok(());
    }

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
    *root_path = Some(dir_path.canonicalize().inspect_err(|e| {
        eprintln!("[WARN] Failed to canonicalize path '{}': {}", dir_path.display(), e);
    }).unwrap_or_else(|_| dir_path.to_path_buf()));

    Ok(())
}

#[tauri::command]
pub fn get_directory_entries(path: String) -> Result<Vec<FileEntry>> {
    // Handle system root
    if path == SYSTEM_ROOT_PATH {
        return get_system_root_entries();
    }

    let dir_path = Path::new(&path);

    if !dir_path.exists() {
        return Err(FileExplorerError::PathNotFound(path));
    }

    if !dir_path.is_dir() {
        return Err(FileExplorerError::InvalidPath(format!("{} is not a directory", path)));
    }

    let mut entries: Vec<FileEntry> = fs::read_dir(dir_path)
        .map_err(FileExplorerError::from)?
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| FileEntry::from_path(&entry.path()))
        .collect();

    sort_entries(&mut entries);

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
        count_dir_contents(&src_path).inspect_err(|e| {
            eprintln!("[WARN] Failed to count directory contents '{}': {}", src_path.display(), e);
        }).unwrap_or((0, 0))
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

    // Create context and stats structs
    let ctx = CopyCtx {
        src: &src_path,
        dst: &dest_path,
        app: &app,
        task_id: &task_id,
        source: &source,
        dest: &dest,
    };
    let stats = CopyStats {
        total_files,
        total_bytes,
        start_time,
    };
    let state = CopyState {
        cancelled: cancelled.clone(),
        files_copied: Arc::new(AtomicUsize::new(0)),
        bytes_copied: Arc::new(AtomicU64::new(0)),
    };

    // Perform copy
    let result = if is_dir {
        copy_dir_with_progress(&ctx, &stats, &state).await
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
    ctx: &CopyCtx<'_>,
    stats: &CopyStats,
    state: &CopyState,
) -> Result<()> {
    copy_dir_recursive(ctx, stats, state).await
}

/// Recursive helper function with progress tracking
async fn copy_dir_recursive(
    ctx: &CopyCtx<'_>,
    stats: &CopyStats,
    state: &CopyState,
) -> Result<()> {
    if state.cancelled.load(Ordering::SeqCst) {
        return Err(FileExplorerError::InvalidPath("Operation cancelled".to_string()));
    }

    tokio::fs::create_dir_all(ctx.dst).await
        .map_err(FileExplorerError::from)?;

    let mut entries = tokio::fs::read_dir(ctx.src).await
        .map_err(FileExplorerError::from)?;

    while let Some(entry) = entries.next_entry().await.map_err(FileExplorerError::from)? {
        if state.cancelled.load(Ordering::SeqCst) {
            return Err(FileExplorerError::InvalidPath("Operation cancelled".to_string()));
        }

        let src_path = entry.path();
        let dst_path = ctx.dst.join(entry.file_name());
        let file_name = entry.file_name()
            .to_string_lossy()
            .to_string();

        if src_path.is_dir() {
            let child_ctx = CopyCtx {
                src: &src_path,
                dst: &dst_path,
                app: ctx.app,
                task_id: ctx.task_id,
                source: ctx.source,
                dest: ctx.dest,
            };
            Box::pin(copy_dir_recursive(&child_ctx, stats, state)).await?;
        } else {
            let copied = tokio::fs::copy(&src_path, &dst_path).await
                .map_err(FileExplorerError::from)?;

            // Update counters
            let current_files = state.files_copied.fetch_add(1, Ordering::SeqCst) + 1;
            let current_bytes = state.bytes_copied.fetch_add(copied, Ordering::SeqCst) + copied;

            // Emit progress for each file
            let elapsed = stats.start_time.elapsed().as_secs_f64();
            let speed = if elapsed > 0.0 {
                (current_bytes as f64) / elapsed / 1024.0 / 1024.0
            } else {
                0.0
            };

            let percentage = if stats.total_bytes > 0 {
                (current_bytes as f64 / stats.total_bytes as f64) * 100.0
            } else {
                0.0
            };

            let _ = ctx.app.emit("copy-progress", CopyProgress {
                task_id: ctx.task_id.to_string(),
                source: ctx.source.to_string(),
                dest: ctx.dest.to_string(),
                current_file: file_name,
                files_copied: current_files,
                total_files: stats.total_files,
                bytes_copied: current_bytes,
                total_bytes: stats.total_bytes,
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
    // Pre-allocate for typical search results
    let mut results = Vec::with_capacity(64);

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

    sort_entries(&mut results);

    Ok(results)
}

/// Async search with cancellation support
#[tauri::command]
pub async fn search_files_async(
    search_id: String,
    directory: String,
    query: String,
) -> Result<Vec<FileEntry>> {
    let dir_path = Path::new(&directory).to_path_buf();

    if !dir_path.exists() {
        return Err(FileExplorerError::PathNotFound(directory));
    }

    // Create cancellation flag
    let cancelled = Arc::new(AtomicBool::new(false));
    SEARCH_CANCEL_FLAGS.lock().insert(search_id.clone(), cancelled.clone());

    let query_lower = query.to_lowercase();
    let mut results = Vec::with_capacity(64);

    // Recursive search with cancellation check
    fn search_recursive_cancelable(
        dir: &Path,
        query: &str,
        results: &mut Vec<FileEntry>,
        cancelled: &Arc<AtomicBool>,
    ) -> bool {
        // Check cancellation at the start of each directory
        if cancelled.load(Ordering::SeqCst) {
            return false; // Cancelled
        }

        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.filter_map(|e| e.ok()) {
                // Check cancellation periodically
                if cancelled.load(Ordering::SeqCst) {
                    return false;
                }

                let path = entry.path();
                let name = path.file_name()
                    .map(|n| n.to_string_lossy().to_lowercase())
                    .unwrap_or_default();

                if name.contains(query) {
                    if let Some(file_entry) = FileEntry::from_path(&path) {
                        results.push(file_entry);
                    }
                }

                // Continue searching subdirectories if results < 1000
                if path.is_dir() && results.len() < 1000 {
                    if !search_recursive_cancelable(&path, query, results, cancelled) {
                        return false; // Propagate cancellation
                    }
                }
            }
        }
        true // Completed normally
    }

    let completed = search_recursive_cancelable(&dir_path, &query_lower, &mut results, &cancelled);

    // Remove from cancellation map
    SEARCH_CANCEL_FLAGS.lock().remove(&search_id);

    if !completed {
        return Err(FileExplorerError::InvalidPath("Search cancelled".to_string()));
    }

    sort_entries(&mut results);

    Ok(results)
}

/// Cancel an active search
#[tauri::command]
pub fn cancel_search(search_id: String) -> bool {
    if let Some(flag) = SEARCH_CANCEL_FLAGS.lock().get(&search_id) {
        flag.store(true, Ordering::SeqCst);
        true
    } else {
        false
    }
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

    // Verify path is within allowed root directory
    verify_path_within_root(&app, file_path)?;

    // Open the file with system default application
    app.opener()
        .open_path(&path, None::<&str>)
        .map_err(|e| FileExplorerError::InvalidPath(format!("Failed to open file: {}", e)))?;

    Ok(())
}

/// Editor information for "Open with" feature
#[derive(Debug, Clone, serde::Serialize)]
pub struct EditorInfo {
    pub id: String,
    pub name: String,
    pub available: bool,
}

/// Check if a command is available in the system PATH
fn is_command_available(cmd: &str) -> bool {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("where")
            .arg(cmd)
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }

    #[cfg(not(target_os = "windows"))]
    {
        std::process::Command::new("which")
            .arg(cmd)
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }
}

/// Get the command to launch an editor by its ID
fn get_editor_command(editor_id: &str) -> Option<&'static str> {
    match editor_id {
        "vscode" => Some("code"),
        "vscodium" => Some("codium"),
        "cursor" => Some("cursor"),
        "sublime" => {
            #[cfg(target_os = "windows")]
            { Some("sublime_text") }
            #[cfg(not(target_os = "windows"))]
            { Some("subl") }
        }
        "notepad++" => {
            #[cfg(target_os = "windows")]
            { Some("notepad++") }
            #[cfg(not(target_os = "windows"))]
            { None }
        }
        _ => None,
    }
}

/// Detect available editors on the system
#[tauri::command]
pub fn detect_editors() -> Vec<EditorInfo> {
    let editors = vec![
        ("vscode", "VS Code", "code"),
        ("vscodium", "VSCodium", "codium"),
        ("cursor", "Cursor", "cursor"),
        ("sublime", "Sublime Text", {
            #[cfg(target_os = "windows")]
            { "sublime_text" }
            #[cfg(not(target_os = "windows"))]
            { "subl" }
        }),
    ];

    let mut result: Vec<EditorInfo> = editors
        .into_iter()
        .map(|(id, name, cmd)| EditorInfo {
            id: id.to_string(),
            name: name.to_string(),
            available: is_command_available(cmd),
        })
        .collect();

    // Add Notepad++ only on Windows
    #[cfg(target_os = "windows")]
    {
        result.push(EditorInfo {
            id: "notepad++".to_string(),
            name: "Notepad++".to_string(),
            available: is_command_available("notepad++"),
        });
    }

    // Only return available editors
    result.into_iter().filter(|e| e.available).collect()
}

/// Open a path with a specified editor (with security check)
#[tauri::command]
pub fn open_with_editor(app: AppHandle, path: String, editor_id: String) -> Result<()> {
    let file_path = Path::new(&path);

    if !file_path.exists() {
        return Err(FileExplorerError::PathNotFound(path));
    }

    // Verify path is within allowed root directory
    verify_path_within_root(&app, file_path)?;

    // Get the editor command
    let editor_cmd = get_editor_command(&editor_id)
        .ok_or_else(|| FileExplorerError::InvalidPath(format!("Unknown editor: {}", editor_id)))?;

    // Launch the editor
    std::process::Command::new(editor_cmd)
        .arg(&path)
        .spawn()
        .map_err(|e| FileExplorerError::InvalidPath(format!("Failed to launch editor: {}", e)))?;

    Ok(())
}
