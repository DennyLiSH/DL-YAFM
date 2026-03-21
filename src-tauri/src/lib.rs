mod commands;
mod config;
mod error;
mod models;
#[cfg(feature = "plugin-system")]
mod plugin;
mod watcher;

use commands::*;
use config::ConfigManager;
use parking_lot::Mutex;
#[cfg(feature = "plugin-system")]
use plugin::{PluginManager, PluginManagerState};
use tauri::Manager;
use std::path::PathBuf;

/// Global state for the root path selected by user
pub struct RootPathState {
    pub inner: Mutex<Option<PathBuf>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Initialize config manager
            let manager = ConfigManager::new(app.handle())
                .map_err(|e| format!("Failed to initialize config manager: {}", e))?;
            let config = manager.load()
                .map_err(|e| format!("Failed to load config: {}", e))?;

            // Setup global state
            app.manage(AppConfigState {
                inner: Mutex::new(config),
                manager,
            });

            // Setup root path state
            app.manage(RootPathState {
                inner: Mutex::new(None),
            });

            // Initialize plugin manager
            #[cfg(feature = "plugin-system")]
            {
                let plugin_dir = app.path().app_data_dir()
                    .map_err(|e| format!("Failed to get app data dir: {}", e))?
                    .join("plugins");

                let plugin_manager = PluginManager::new(plugin_dir)
                    .map_err(|e| format!("Failed to initialize plugin manager: {}", e))?;

                // Clone for async loading (shares internal Arc state)
                let plugin_manager_for_async = plugin_manager.clone();

                app.manage(PluginManagerState::new(plugin_manager));

                // Load plugins asynchronously without blocking startup
                tauri::async_runtime::spawn(async move {
                    let _ = plugin_manager_for_async.load_all_plugins().await;
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // File commands
            get_system_root_entries,
            grant_directory_access,
            get_directory_entries,
            create_directory,
            delete_entry,
            rename_entry,
            copy_file,
            copy_entry,
            copy_entry_async,
            cancel_copy_task,
            move_entry,
            search_files,
            search_files_async,
            cancel_search,
            read_file_content,
            read_file_as_base64,
            create_file,
            check_path_exists,
            open_file_safe,
            detect_editors,
            open_with_editor,
            // Config commands
            get_settings,
            update_settings,
            get_bookmarks,
            add_bookmark,
            remove_bookmark,
            get_chat_messages,
            add_chat_message,
            clear_chat_messages,
            migrate_from_local_storage,
            // Watch commands
            start_watch,
            stop_watch,
            update_watch_paths,
            stop_all_watch,
            get_watched_paths,
            // Plugin commands
            #[cfg(feature = "plugin-system")]
            get_plugins,
            #[cfg(feature = "plugin-system")]
            get_plugin_menu_items,
            #[cfg(feature = "plugin-system")]
            execute_plugin_action,
            #[cfg(feature = "plugin-system")]
            reload_plugins,
            #[cfg(feature = "plugin-system")]
            get_plugin_directory,
            #[cfg(feature = "plugin-system")]
            open_plugin_directory,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
