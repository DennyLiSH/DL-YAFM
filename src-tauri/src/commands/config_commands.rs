use crate::config::ConfigManager;
use crate::error::{FileExplorerError, Result};
use crate::models::{AppConfig, Bookmark, ChatMessage, Settings};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;
use uuid::Uuid;

pub struct AppConfigState {
    pub inner: Mutex<AppConfig>,
    pub manager: ConfigManager,
}

// ==================== Settings Commands ====================

#[tauri::command]
pub fn get_settings(state: State<AppConfigState>) -> Result<Settings> {
    let config = state
        .inner
        .lock()
        .map_err(|_| FileExplorerError::ConfigError("Lock error".to_string()))?;
    Ok(config.settings.clone())
}

#[tauri::command]
pub fn update_settings(state: State<AppConfigState>, settings: Settings) -> Result<()> {
    let mut config = state
        .inner
        .lock()
        .map_err(|_| FileExplorerError::ConfigError("Lock error".to_string()))?;

    config.settings = settings;
    config.version = AppConfig::CURRENT_VERSION;

    state.manager.save(&config)?;
    Ok(())
}

// ==================== Bookmark Commands ====================

#[tauri::command]
pub fn get_bookmarks(state: State<AppConfigState>) -> Result<Vec<Bookmark>> {
    let config = state
        .inner
        .lock()
        .map_err(|_| FileExplorerError::ConfigError("Lock error".to_string()))?;
    Ok(config.bookmarks.clone())
}

#[tauri::command]
pub fn add_bookmark(state: State<AppConfigState>, name: String, path: String) -> Result<Bookmark> {
    let mut config = state
        .inner
        .lock()
        .map_err(|_| FileExplorerError::ConfigError("Lock error".to_string()))?;

    // Check for duplicate path
    if config.bookmarks.iter().any(|b| b.path == path) {
        return Err(FileExplorerError::AlreadyExists(format!(
            "Bookmark for path: {}",
            path
        )));
    }

    let bookmark = Bookmark {
        id: Uuid::new_v4().to_string(),
        name,
        path,
        created_at: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs(),
    };

    config.bookmarks.push(bookmark.clone());
    state.manager.save(&config)?;

    Ok(bookmark)
}

#[tauri::command]
pub fn remove_bookmark(state: State<AppConfigState>, id: String) -> Result<()> {
    let mut config = state
        .inner
        .lock()
        .map_err(|_| FileExplorerError::ConfigError("Lock error".to_string()))?;

    let initial_len = config.bookmarks.len();
    config.bookmarks.retain(|b| b.id != id);

    if config.bookmarks.len() == initial_len {
        return Err(FileExplorerError::PathNotFound(format!(
            "Bookmark with id: {}",
            id
        )));
    }

    state.manager.save(&config)?;
    Ok(())
}

// ==================== Chat Commands ====================

#[tauri::command]
pub fn get_chat_messages(state: State<AppConfigState>) -> Result<Vec<ChatMessage>> {
    let config = state
        .inner
        .lock()
        .map_err(|_| FileExplorerError::ConfigError("Lock error".to_string()))?;
    Ok(config.chat_messages.clone())
}

#[tauri::command]
pub fn add_chat_message(
    state: State<AppConfigState>,
    role: String,
    content: String,
) -> Result<ChatMessage> {
    let mut config = state
        .inner
        .lock()
        .map_err(|_| FileExplorerError::ConfigError("Lock error".to_string()))?;

    let message = ChatMessage {
        id: Uuid::new_v4().to_string(),
        role,
        content,
        timestamp: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs(),
    };

    config.chat_messages.push(message.clone());
    state.manager.save(&config)?;

    Ok(message)
}

#[tauri::command]
pub fn clear_chat_messages(state: State<AppConfigState>) -> Result<()> {
    let mut config = state
        .inner
        .lock()
        .map_err(|_| FileExplorerError::ConfigError("Lock error".to_string()))?;

    config.chat_messages.clear();
    state.manager.save(&config)?;

    Ok(())
}

// ==================== Migration Command ====================

#[tauri::command]
pub fn migrate_from_local_storage(
    state: State<AppConfigState>,
    settings_json: Option<String>,
    bookmarks_json: Option<String>,
    chat_json: Option<String>,
) -> Result<()> {
    let mut config = state
        .inner
        .lock()
        .map_err(|_| FileExplorerError::ConfigError("Lock error".to_string()))?;

    // Only migrate if config is empty (version == 0)
    if config.version > 0 {
        return Ok(());
    }

    // Migrate settings
    if let Some(json) = settings_json {
        if let Ok(settings) = serde_json::from_str::<Settings>(&json) {
            config.settings = settings;
        }
    }

    // Migrate bookmarks
    if let Some(json) = bookmarks_json {
        if let Ok(bookmarks) = serde_json::from_str::<Vec<Bookmark>>(&json) {
            config.bookmarks = bookmarks;
        }
    }

    // Migrate chat messages
    if let Some(json) = chat_json {
        if let Ok(messages) = serde_json::from_str::<Vec<ChatMessage>>(&json) {
            config.chat_messages = messages;
        }
    }

    config.version = AppConfig::CURRENT_VERSION;
    state.manager.save(&config)?;

    Ok(())
}
