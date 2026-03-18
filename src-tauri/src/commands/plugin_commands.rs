use tauri::{AppHandle, State};
use tauri_plugin_opener::OpenerExt;

use crate::models::FileEntry;
use crate::plugin::{
    PluginContext, PluginInfo, PluginManagerState, PluginMenuItem, PluginResult,
};

/// 获取所有已加载的插件列表
#[tauri::command]
pub fn get_plugins(state: State<'_, PluginManagerState>) -> Result<Vec<PluginInfo>, String> {
    let manager = state.inner.lock();
    Ok(manager.get_all_plugins())
}

/// 获取所有插件菜单项
#[tauri::command]
pub fn get_plugin_menu_items(
    state: State<'_, PluginManagerState>,
) -> Result<Vec<PluginMenuItem>, String> {
    let manager = state.inner.lock();
    Ok(manager.get_all_menu_items())
}

/// 执行插件动作
#[tauri::command]
pub fn execute_plugin_action(
    plugin_id: String,
    action_id: String,
    selected_entries: Vec<FileEntry>,
    current_directory: String,
    state: State<'_, PluginManagerState>,
) -> Result<PluginResult, String> {
    let manager = state.inner.lock();

    let context = PluginContext {
        selected_entries,
        current_directory,
    };

    manager
        .execute_action(&plugin_id, &action_id, context)
        .map_err(|e| e.to_string())
}

/// 重新加载所有插件
#[tauri::command]
pub async fn reload_plugins(
    state: State<'_, PluginManagerState>,
) -> Result<Vec<String>, String> {
    // 克隆管理器以避免长时间持有锁
    let manager = {
        let guard = state.inner.lock();
        guard.clone()
    };

    manager
        .reload_plugins()
        .await
        .map_err(|e| e.to_string())
}

/// 获取插件目录路径
#[tauri::command]
pub fn get_plugin_directory(
    state: State<'_, PluginManagerState>,
) -> Result<String, String> {
    let manager = state.inner.lock();
    Ok(manager.get_plugin_directory().to_string_lossy().to_string())
}

/// 在文件管理器中打开插件目录
#[tauri::command]
pub fn open_plugin_directory(
    app: AppHandle,
    state: State<'_, PluginManagerState>,
) -> Result<(), String> {
    let manager = state.inner.lock();
    let plugin_dir = manager.get_plugin_directory().to_path_buf();
    drop(manager); // 释放锁

    // 确保目录存在
    if !plugin_dir.exists() {
        std::fs::create_dir_all(&plugin_dir)
            .map_err(|e| format!("Failed to create plugin directory: {}", e))?;
    }

    // 使用 opener 插件打开目录
    app.opener()
        .open_path(plugin_dir.to_string_lossy().to_string(), None::<&str>)
        .map_err(|e| format!("Failed to open plugin directory: {}", e))?;

    Ok(())
}
