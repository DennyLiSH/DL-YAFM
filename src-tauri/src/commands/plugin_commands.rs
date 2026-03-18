use tauri::{Manager, State};

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
