use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::sync::LazyLock;
use parking_lot::Mutex;
use std::collections::HashSet;
use std::path::Path;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

/// File change event types for frontend
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum FileChangeKind {
    Created,
    Modified,
    Deleted,
}

/// File change event payload sent to frontend
#[derive(Debug, Clone, serde::Serialize)]
pub struct FileChangeEvent {
    /// The directory path where the change occurred
    pub directory: String,
    /// Type of change
    pub kind: FileChangeKind,
    /// Affected file/directory paths
    pub paths: Vec<String>,
    /// Timestamp of the event
    pub timestamp: u64,
}

/// Global watcher state
static WATCHER_STATE: LazyLock<Arc<Mutex<WatcherState>>> = LazyLock::new(|| {
    Arc::new(Mutex::new(WatcherState {
        watcher: None,
        watched_paths: HashSet::new(),
    }))
});

struct WatcherState {
    watcher: Option<RecommendedWatcher>,
    watched_paths: HashSet<String>,
}

/// Start watching a directory (non-recursive)
pub fn watch_directory(app: AppHandle, path: &str) -> Result<(), String> {
    // Validate path
    let path_obj = Path::new(path);
    if !path_obj.exists() {
        return Err(format!("Path does not exist: {}", path));
    }
    if !path_obj.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    let mut state = WATCHER_STATE.lock();

    // Skip if already watching
    if state.watched_paths.contains(path) {
        return Ok(());
    }

    // Initialize watcher if not exists
    if state.watcher.is_none() {
        let app_clone = app.clone();
        let watcher = create_watcher(app_clone)?;
        state.watcher = Some(watcher);
    }

    // Add path to watcher
    if let Some(ref mut watcher) = state.watcher {
        watcher
            .watch(path_obj, RecursiveMode::NonRecursive)
            .map_err(|e| format!("Failed to watch path: {}", e))?;
        state.watched_paths.insert(path.to_string());
        println!("[watcher] Started watching: {}", path);
    }

    Ok(())
}

/// Stop watching a directory
pub fn unwatch_directory(path: &str) -> Result<(), String> {
    let mut state = WATCHER_STATE.lock();

    if !state.watched_paths.contains(path) {
        return Ok(());
    }

    if let Some(ref mut watcher) = state.watcher {
        let path_obj = Path::new(path);
        watcher
            .unwatch(path_obj)
            .map_err(|e| format!("Failed to unwatch path: {}", e))?;
    }

    state.watched_paths.remove(path);
    println!("[watcher] Stopped watching: {}", path);

    // If no more paths to watch, stop the watcher
    if state.watched_paths.is_empty() {
        state.watcher = None;
        println!("[watcher] No more paths to watch, watcher stopped");
    }

    Ok(())
}

/// Update watched paths - sync with frontend expanded nodes
pub fn update_watched_paths(app: AppHandle, paths: Vec<String>) -> Result<(), String> {
    let mut state = WATCHER_STATE.lock();

    let new_paths: HashSet<String> = paths.into_iter().collect();

    // Paths to remove
    let to_remove: Vec<String> = state
        .watched_paths
        .difference(&new_paths)
        .cloned()
        .collect();

    // Paths to add
    let to_add: Vec<String> = new_paths
        .difference(&state.watched_paths)
        .cloned()
        .collect();

    // Remove old paths
    for path in to_remove {
        if let Some(ref mut watcher) = state.watcher {
            let path_obj = Path::new(&path);
            let _ = watcher.unwatch(path_obj);
        }
        state.watched_paths.remove(&path);
        println!("[watcher] Removed watch: {}", path);
    }

    // Add new paths
    for path in to_add {
        let path_obj = Path::new(&path);

        // Validate path
        if !path_obj.exists() || !path_obj.is_dir() {
            println!("[watcher] Skipping invalid path: {}", path);
            continue;
        }

        // Initialize watcher if needed
        if state.watcher.is_none() {
            let app_clone = app.clone();
            let watcher = create_watcher(app_clone)?;
            state.watcher = Some(watcher);
        }

        if let Some(ref mut watcher) = state.watcher {
            if let Err(e) = watcher.watch(path_obj, RecursiveMode::NonRecursive) {
                eprintln!("[watcher] Failed to watch {}: {}", path, e);
                continue;
            }
        }
        state.watched_paths.insert(path.clone());
        println!("[watcher] Added watch: {}", path);
    }

    // Cleanup if empty
    if state.watched_paths.is_empty() {
        state.watcher = None;
        println!("[watcher] No more paths to watch, watcher stopped");
    }

    Ok(())
}

/// Stop all watching
pub fn stop_all_watching() -> Result<(), String> {
    let mut state = WATCHER_STATE.lock();
    state.watcher = None;
    state.watched_paths.clear();
    println!("[watcher] Stopped all watching");
    Ok(())
}

/// Get currently watched paths
pub fn get_watched_paths() -> Vec<String> {
    let state = WATCHER_STATE.lock();
    state.watched_paths.iter().cloned().collect()
}

/// Create a new watcher with event handler
fn create_watcher(app: AppHandle) -> Result<RecommendedWatcher, String> {
    let app_clone = app.clone();

    let watcher = RecommendedWatcher::new(
        move |result: Result<Event, notify::Error>| {
            match result {
                Ok(event) => {
                    handle_file_event(&app_clone, &event);
                }
                Err(e) => {
                    eprintln!("[watcher] Error: {}", e);
                }
            }
        },
        Config::default(),
    )
    .map_err(|e| format!("Failed to create watcher: {}", e))?;

    Ok(watcher)
}

/// Handle file system events
fn handle_file_event(app: &AppHandle, event: &Event) {
    let kind = match event.kind {
        EventKind::Create(_) => FileChangeKind::Created,
        EventKind::Modify(_) => FileChangeKind::Modified,
        EventKind::Remove(_) => FileChangeKind::Deleted,
        EventKind::Any | EventKind::Access(_) | EventKind::Other => return,
    };

    // Get the changed file paths
    let paths: Vec<String> = event
        .paths
        .iter()
        .filter_map(|p| p.to_str().map(|s| s.to_string()))
        .collect();

    if paths.is_empty() {
        return;
    }

    // Clone watched paths while holding the lock, then release before emitting
    let watched_paths: Vec<String> = {
        let state = WATCHER_STATE.lock();
        state.watched_paths.iter().cloned().collect()
    };

    // Find which watched directory this event belongs to (lock already released)
    for changed_path in &paths {
        for watched_path in &watched_paths {
            // Check if the changed path is inside the watched directory
            let changed = Path::new(changed_path);
            let watched = Path::new(watched_path);

            let is_inside = changed.starts_with(watched);
            let is_direct_child = changed
                .parent()
                .map(|p| p == watched)
                .unwrap_or(false);

            if is_inside || is_direct_child {
                let payload = FileChangeEvent {
                    directory: watched_path.clone(),
                    kind: kind.clone(),
                    paths: paths.clone(),
                    timestamp: std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .map(|d| d.as_secs())
                        .unwrap_or(0),
                };

                // Emit event to frontend (no lock held)
                if let Err(e) = app.emit("fs-change", &payload) {
                    eprintln!("[watcher] Failed to emit event: {}", e);
                } else {
                    println!(
                        "[watcher] Emitted fs-change: {:?} in {}",
                        kind, watched_path
                    );
                }

                break;
            }
        }
    }
}
