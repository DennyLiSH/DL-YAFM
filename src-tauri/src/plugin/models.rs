use serde::{Deserialize, Serialize};
use crate::models::FileEntry;

/// 插件 Manifest 配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginManifest {
    /// 插件唯一标识 (反向域名格式)
    pub id: String,
    /// 显示名称
    pub name: String,
    /// 版本号
    pub version: String,
    /// 描述
    #[serde(default)]
    pub description: String,
    /// 作者
    #[serde(default)]
    pub author: String,
    /// 最低应用版本
    #[serde(default = "default_min_app_version")]
    pub min_app_version: String,
    /// 所需权限列表
    #[serde(default)]
    pub permissions: Vec<String>,
    /// 菜单项配置
    #[serde(default)]
    pub menu_items: Vec<PluginMenuItemConfig>,
}

fn default_min_app_version() -> String {
    "0.1.0".to_string()
}

/// 菜单项配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginMenuItemConfig {
    /// 菜单项 ID
    pub id: String,
    /// 显示文本
    pub label: String,
    /// 图标名称
    #[serde(default)]
    pub icon: Option<String>,
    /// 适用的上下文: "file", "folder", "multi-select"
    #[serde(default)]
    pub contexts: Vec<String>,
    /// 排序优先级 (数字越小越靠前)
    #[serde(default = "default_order")]
    pub order: i32,
    /// 是否禁用
    #[serde(default)]
    pub disabled: bool,
}

fn default_order() -> i32 {
    1000
}

/// 带插件 ID 的菜单项
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginMenuItem {
    /// 所属插件 ID
    pub plugin_id: String,
    /// 菜单项配置
    #[serde(flatten)]
    pub item: PluginMenuItemConfig,
}

/// 插件信息 (返回给前端)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginInfo {
    /// 插件 ID
    pub id: String,
    /// 显示名称
    pub name: String,
    /// 版本号
    pub version: String,
    /// 描述
    pub description: String,
    /// 作者
    pub author: String,
    /// 是否启用
    pub enabled: bool,
}

/// 插件执行上下文
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginContext {
    /// 当前选中的文件/目录列表
    pub selected_entries: Vec<FileEntry>,
    /// 当前浏览的目录路径
    pub current_directory: String,
}

/// 插件执行结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginResult {
    /// 是否成功
    pub success: bool,
    /// 消息
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    /// 要执行的动作列表
    #[serde(default)]
    pub actions: Vec<PluginAction>,
}

/// 插件可触发的动作
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum PluginAction {
    /// 显示消息
    ShowMessage { level: String, text: String },
    /// 刷新文件列表
    RefreshFileList,
    /// 复制到剪贴板
    CopyToClipboard { text: String },
    /// 打开 URL (仅允许 http/https)
    OpenUrl { url: String },
}

impl PluginAction {
    /// Validate that the action is safe to execute
    pub fn validate(&self) -> Result<(), String> {
        match self {
            Self::OpenUrl { url } => {
                let allowed = url.starts_with("http://") || url.starts_with("https://");
                if !allowed {
                    return Err(format!("URL scheme not allowed: {}", url));
                }
                Ok(())
            }
            _ => Ok(()),
        }
    }
}
