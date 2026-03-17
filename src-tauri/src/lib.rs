mod commands;
mod config;
mod error;
mod models;
mod watcher;

use commands::*;
use config::ConfigManager;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Initialize config manager
            let manager = ConfigManager::new(&app.handle())
                .expect("Failed to initialize config manager");
            let config = manager.load().expect("Failed to load config");

            // Setup global state
            app.manage(AppConfigState {
                inner: std::sync::Mutex::new(config),
                manager,
            });

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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
