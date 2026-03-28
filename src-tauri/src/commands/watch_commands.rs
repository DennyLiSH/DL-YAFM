use crate::error::{FileExplorerError, Result};
use crate::watcher;
use tauri::AppHandle;

/// Start watching a directory
#[tauri::command]
pub fn start_watch(app: AppHandle, path: String) -> Result<()> {
    watcher::watch_directory(app, &path)
        .map_err(FileExplorerError::WatchError)?;
    Ok(())
}

/// Stop watching a directory
#[tauri::command]
pub fn stop_watch(path: String) -> Result<()> {
    watcher::unwatch_directory(&path)
        .map_err(FileExplorerError::WatchError)?;
    Ok(())
}

/// Update all watched paths at once (sync with frontend expanded nodes)
#[tauri::command]
pub fn update_watch_paths(app: AppHandle, paths: Vec<String>) -> Result<()> {
    watcher::update_watched_paths(app, paths)
        .map_err(FileExplorerError::WatchError)?;
    Ok(())
}

/// Stop all watching
#[tauri::command]
pub fn stop_all_watch() -> Result<()> {
    watcher::stop_all_watching()
        .map_err(FileExplorerError::WatchError)?;
    Ok(())
}

/// Get currently watched paths
#[tauri::command]
pub fn get_watched_paths() -> Result<Vec<String>> {
    Ok(watcher::get_watched_paths())
}
