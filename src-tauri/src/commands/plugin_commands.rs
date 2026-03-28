use tauri::{AppHandle, State};
use tauri_plugin_opener::OpenerExt;

use crate::error::Result;
use crate::models::FileEntry;
use crate::plugin::{
    PluginContext, PluginInfo, PluginManagerState, PluginMenuItem, PluginResult,
};

/// Get all loaded plugins
#[tauri::command]
pub fn get_plugins(state: State<'_, PluginManagerState>) -> Result<Vec<PluginInfo>> {
    let manager = state.inner.lock();
    Ok(manager.get_all_plugins())
}

/// Get all plugin menu items
#[tauri::command]
pub fn get_plugin_menu_items(
    state: State<'_, PluginManagerState>,
) -> Result<Vec<PluginMenuItem>> {
    let manager = state.inner.lock();
    Ok(manager.get_all_menu_items())
}

/// Execute a plugin action
#[tauri::command]
pub fn execute_plugin_action(
    plugin_id: String,
    action_id: String,
    selected_entries: Vec<FileEntry>,
    current_directory: String,
    state: State<'_, PluginManagerState>,
) -> Result<PluginResult> {
    let manager = state.inner.lock();

    let context = PluginContext {
        selected_entries,
        current_directory,
    };

    manager
        .execute_action(&plugin_id, &action_id, context)
        .map_err(|e| crate::error::FileExplorerError::PluginError(e.to_string()))
}

/// Reload all plugins
#[tauri::command]
pub async fn reload_plugins(
    state: State<'_, PluginManagerState>,
) -> Result<Vec<String>> {
    let manager = {
        let guard = state.inner.lock();
        guard.clone()
    };

    manager
        .reload_plugins()
        .await
        .map_err(|e| crate::error::FileExplorerError::PluginError(e.to_string()))
}

/// Get the plugin directory path
#[tauri::command]
pub fn get_plugin_directory(
    state: State<'_, PluginManagerState>,
) -> Result<String> {
    let manager = state.inner.lock();
    Ok(manager.get_plugin_directory().to_string_lossy().to_string())
}

/// Open the plugin directory in file manager
#[tauri::command]
pub fn open_plugin_directory(
    app: AppHandle,
    state: State<'_, PluginManagerState>,
) -> Result<()> {
    let manager = state.inner.lock();
    let plugin_dir = manager.get_plugin_directory().to_path_buf();
    drop(manager); // Release lock before I/O

    if !plugin_dir.exists() {
        std::fs::create_dir_all(&plugin_dir)?;
    }

    app.opener()
        .open_path(plugin_dir.to_string_lossy().to_string(), None::<&str>)
        .map_err(|e| crate::error::FileExplorerError::PluginError(format!("Failed to open plugin directory: {}", e)))?;

    Ok(())
}
