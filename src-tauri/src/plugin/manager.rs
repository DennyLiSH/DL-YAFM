use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use parking_lot::{Mutex, RwLock};
#[cfg(feature = "plugin-system")]
use wasmtime::{Config, Engine, Module};
use tokio::fs;

use super::error::{PluginError, Result};
use super::models::{PluginInfo, PluginManifest, PluginMenuItem, PluginContext, PluginResult};
use super::sandbox::SimpleSandbox;

/// 加载的插件实例
pub struct LoadedPlugin {
    /// 插件 Manifest
    pub manifest: PluginManifest,
    /// WASM 模块
    pub module: Module,
}

/// 插件管理器
#[derive(Clone)]
pub struct PluginManager {
    /// wasmtime 引擎 (shared)
    engine: Arc<Engine>,
    /// 已加载的插件
    plugins: Arc<RwLock<HashMap<String, LoadedPlugin>>>,
    /// 插件目录
    plugin_directory: PathBuf,
}

impl PluginManager {
    /// 创建新的插件管理器
    pub fn new(plugin_dir: PathBuf) -> Result<Self> {
        // 配置 wasmtime 引擎
        let mut config = Config::new();
        config.wasm_backtrace(true);
        config.consume_fuel(true);

        let engine = Engine::new(&config)?;

        Ok(Self {
            engine: Arc::new(engine),
            plugins: Arc::new(RwLock::new(HashMap::new())),
            plugin_directory: plugin_dir,
        })
    }

    /// 扫描并加载所有插件
    pub async fn load_all_plugins(&self) -> Result<Vec<String>> {
        let mut loaded = Vec::new();

        // 确保插件目录存在
        if !self.plugin_directory.exists() {
            fs::create_dir_all(&self.plugin_directory).await?;
            return Ok(loaded);
        }

        // 读取插件目录
        let mut entries = fs::read_dir(&self.plugin_directory).await?;

        while let Some(entry) = entries.next_entry().await? {
            let path = entry.path();
            if path.is_dir() {
                match self.load_plugin(&path).await {
                    Ok(plugin_id) => {
                        loaded.push(plugin_id);
                    }
                    Err(e) => {
                        eprintln!("Failed to load plugin from {:?}: {}", path, e);
                    }
                }
            }
        }

        Ok(loaded)
    }

    /// 加载单个插件
    async fn load_plugin(&self, plugin_path: &Path) -> Result<String> {
        // 1. 读取 manifest
        let manifest_path = plugin_path.join("plugin.json");
        let manifest_content = fs::read_to_string(&manifest_path).await
            .map_err(|e| PluginError::PluginLoadError(format!("Failed to read manifest: {}", e)))?;

        let manifest: PluginManifest = serde_json::from_str(&manifest_content)
            .map_err(|e| PluginError::ManifestParseError(e.to_string()))?;

        // 2. 加载 WASM 模块
        let wasm_path = plugin_path.join("plugin.wasm");
        if !wasm_path.exists() {
            return Err(PluginError::PluginLoadError(format!(
                "plugin.wasm not found in {:?}",
                plugin_path
            )));
        }

        let wasm_bytes = fs::read(&wasm_path).await?;

        // 3. 验证并编译 WASM 模块
        let module = Module::from_binary(&self.engine, &wasm_bytes)
            .map_err(|e| PluginError::WasmValidationError(e.to_string()))?;

        // 4. 存储到缓存
        let plugin_id = manifest.id.clone();
        let loaded_plugin = LoadedPlugin {
            manifest,
            module,
        };

        self.plugins.write().insert(plugin_id.clone(), loaded_plugin);

        Ok(plugin_id)
    }

    /// 获取所有已加载的插件信息
    pub fn get_all_plugins(&self) -> Vec<PluginInfo> {
        self.plugins
            .read()
            .values()
            .map(|p| PluginInfo {
                id: p.manifest.id.clone(),
                name: p.manifest.name.clone(),
                version: p.manifest.version.clone(),
                description: p.manifest.description.clone(),
                author: p.manifest.author.clone(),
                enabled: true,
            })
            .collect()
    }

    /// 获取所有插件的菜单项
    pub fn get_all_menu_items(&self) -> Vec<PluginMenuItem> {
        self.plugins
            .read()
            .values()
            .flat_map(|p| {
                p.manifest.menu_items.iter().map(|item| PluginMenuItem {
                    plugin_id: p.manifest.id.clone(),
                    item: item.clone(),
                })
            })
            .collect()
    }

    /// 执行插件动作
    pub fn execute_action(
        &self,
        plugin_id: &str,
        action_id: &str,
        context: PluginContext,
    ) -> Result<PluginResult> {
        let plugins = self.plugins.read();
        let plugin = plugins
            .get(plugin_id)
            .ok_or_else(|| PluginError::PluginNotFound(plugin_id.to_string()))?;

        // 创建沙箱并执行
        let mut sandbox = SimpleSandbox::new(&self.engine, &plugin.module)?;

        sandbox.execute_action(action_id, &context)
    }

    /// 重新加载所有插件
    pub async fn reload_plugins(&self) -> Result<Vec<String>> {
        // 清空现有插件
        self.plugins.write().clear();

        // 重新加载
        self.load_all_plugins().await
    }

    /// 获取插件目录路径
    pub fn get_plugin_directory(&self) -> &Path {
        &self.plugin_directory
    }
}

/// 插件管理器全局状态
pub struct PluginManagerState {
    pub inner: Arc<Mutex<PluginManager>>,
}

impl PluginManagerState {
    pub fn new(manager: PluginManager) -> Self {
        Self {
            inner: Arc::new(Mutex::new(manager)),
        }
    }
}
