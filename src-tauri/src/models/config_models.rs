use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    Light,
    Dark,
    #[default]
    System,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub enum Language {
    #[default]
    #[serde(rename = "zh-CN")]
    ZhCN,
    #[serde(rename = "en-US")]
    EnUS,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Settings {
    pub theme: Theme,
    pub language: Language,
    pub show_hidden_files: bool,
    pub personal_intro: String,
    pub folder_descriptions: HashMap<String, String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub font_sans: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub font_mono: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub search_debounce_ms: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bookmark {
    pub id: String,
    pub name: String,
    pub path: String,
    pub created_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub id: String,
    pub role: String,
    pub content: String,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppConfig {
    pub settings: Settings,
    pub bookmarks: Vec<Bookmark>,
    pub chat_messages: Vec<ChatMessage>,
    pub version: u32,
}

impl AppConfig {
    pub const CURRENT_VERSION: u32 = 1;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_theme_default() {
        let theme = Theme::default();
        assert_eq!(theme, Theme::System);
    }

    #[test]
    fn test_theme_serialization() {
        let light = Theme::Light;
        let dark = Theme::Dark;
        let system = Theme::System;

        assert_eq!(serde_json::to_string(&light).unwrap(), "\"light\"");
        assert_eq!(serde_json::to_string(&dark).unwrap(), "\"dark\"");
        assert_eq!(serde_json::to_string(&system).unwrap(), "\"system\"");
    }

    #[test]
    fn test_theme_deserialization() {
        let light: Theme = serde_json::from_str("\"light\"").unwrap();
        let dark: Theme = serde_json::from_str("\"dark\"").unwrap();
        let system: Theme = serde_json::from_str("\"system\"").unwrap();

        assert_eq!(light, Theme::Light);
        assert_eq!(dark, Theme::Dark);
        assert_eq!(system, Theme::System);
    }

    #[test]
    fn test_language_default() {
        let lang = Language::default();
        assert_eq!(lang, Language::ZhCN);
    }

    #[test]
    fn test_language_serialization() {
        let zh = Language::ZhCN;
        let en = Language::EnUS;

        assert_eq!(serde_json::to_string(&zh).unwrap(), "\"zh-CN\"");
        assert_eq!(serde_json::to_string(&en).unwrap(), "\"en-US\"");
    }

    #[test]
    fn test_language_deserialization() {
        let zh: Language = serde_json::from_str("\"zh-CN\"").unwrap();
        let en: Language = serde_json::from_str("\"en-US\"").unwrap();

        assert_eq!(zh, Language::ZhCN);
        assert_eq!(en, Language::EnUS);
    }

    #[test]
    fn test_settings_default() {
        let settings = Settings::default();
        assert_eq!(settings.theme, Theme::System);
        assert_eq!(settings.language, Language::ZhCN);
        assert!(!settings.show_hidden_files);
        assert!(settings.personal_intro.is_empty());
        assert!(settings.folder_descriptions.is_empty());
    }

    #[test]
    fn test_app_config_default() {
        let config = AppConfig::default();
        assert_eq!(config.version, 0);
        assert!(config.bookmarks.is_empty());
        assert!(config.chat_messages.is_empty());
    }

    #[test]
    fn test_app_config_current_version() {
        assert_eq!(AppConfig::CURRENT_VERSION, 1);
    }

    #[test]
    fn test_bookmark_serialization() {
        let bookmark = Bookmark {
            id: "test-id".to_string(),
            name: "Test Folder".to_string(),
            path: "/path/to/folder".to_string(),
            created_at: 1234567890,
        };

        let json = serde_json::to_string(&bookmark).unwrap();
        let parsed: Bookmark = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.id, "test-id");
        assert_eq!(parsed.name, "Test Folder");
        assert_eq!(parsed.path, "/path/to/folder");
        assert_eq!(parsed.created_at, 1234567890);
    }

    #[test]
    fn test_chat_message_serialization() {
        let message = ChatMessage {
            id: "msg-1".to_string(),
            role: "user".to_string(),
            content: "Hello, world!".to_string(),
            timestamp: 1234567890,
        };

        let json = serde_json::to_string(&message).unwrap();
        let parsed: ChatMessage = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.id, "msg-1");
        assert_eq!(parsed.role, "user");
        assert_eq!(parsed.content, "Hello, world!");
    }

    #[test]
    fn test_settings_with_optional_fonts() {
        let json = r#"{
            "theme": "dark",
            "language": "en-US",
            "show_hidden_files": true,
            "personal_intro": "Test intro",
            "folder_descriptions": {},
            "font_sans": "Inter",
            "font_mono": "JetBrains Mono"
        }"#;

        let settings: Settings = serde_json::from_str(json).unwrap();
        assert_eq!(settings.theme, Theme::Dark);
        assert_eq!(settings.language, Language::EnUS);
        assert_eq!(settings.font_sans, Some("Inter".to_string()));
        assert_eq!(settings.font_mono, Some("JetBrains Mono".to_string()));
    }
}
