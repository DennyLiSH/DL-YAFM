mod commands;
mod config;
mod error;
mod models;
mod plugin;
mod watcher;

use commands::*;
use config::ConfigManager;
use parking_lot::Mutex;
use plugin::{PluginManager, PluginManagerState};
use std::sync::Arc;
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
                .expect("Failed to initialize config manager");
            let config = manager.load().expect("Failed to load config");

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
            let plugin_dir = app.path().app_data_dir()
                .expect("Failed to get app data dir")
                .join("plugins");

            let plugin_manager = PluginManager::new(plugin_dir)
                .expect("Failed to initialize plugin manager");

            // Load plugins synchronously (in production, consider async)
            tauri::async_runtime::block_on(async {
                let _ = plugin_manager.load_all_plugins().await;
            });

            app.manage(PluginManagerState::new(plugin_manager));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // File commands
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
            get_plugins,
            get_plugin_menu_items,
            execute_plugin_action,
            reload_plugins,
            get_plugin_directory,
            open_plugin_directory,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
