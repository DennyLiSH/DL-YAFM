use crate::error::Result;
use crate::models::AppConfig;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const CONFIG_FILE_NAME: &str = "config.json";

pub struct ConfigManager {
    config_path: PathBuf,
}

impl ConfigManager {
    pub fn new(app_handle: &AppHandle) -> Result<Self> {
        let app_data_dir = app_handle
            .path()
            .app_data_dir()
            .map_err(|e| crate::error::FileExplorerError::ConfigError(e.to_string()))?;

        // Ensure directory exists
        fs::create_dir_all(&app_data_dir)
            .map_err(|e| crate::error::FileExplorerError::IoError(e.to_string()))?;

        Ok(Self {
            config_path: app_data_dir.join(CONFIG_FILE_NAME),
        })
    }

    pub fn load(&self) -> Result<AppConfig> {
        if !self.config_path.exists() {
            return Ok(AppConfig::default());
        }

        let content = fs::read_to_string(&self.config_path)
            .map_err(|e| crate::error::FileExplorerError::IoError(e.to_string()))?;

        let config: AppConfig = serde_json::from_str(&content)
            .map_err(|e| crate::error::FileExplorerError::ConfigError(format!("Parse error: {}", e)))?;

        Ok(config)
    }

    pub fn save(&self, config: &AppConfig) -> Result<()> {
        let content = serde_json::to_string_pretty(config)
            .map_err(|e| crate::error::FileExplorerError::ConfigError(format!("Serialize error: {}", e)))?;

        // Write to temp file first, then rename atomically to prevent data loss on crash
        let temp_path = self.config_path.with_extension("tmp");

        fs::write(&temp_path, &content)
            .map_err(|e| crate::error::FileExplorerError::IoError(e.to_string()))?;

        fs::rename(&temp_path, &self.config_path)
            .map_err(|e| {
                // Clean up temp file if rename fails
                let _ = fs::remove_file(&temp_path);
                crate::error::FileExplorerError::IoError(e.to_string())
            })?;

        Ok(())
    }

}
