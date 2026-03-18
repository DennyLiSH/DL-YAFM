use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PluginError {
    /// 插件未找到
    PluginNotFound(String),
    /// 插件加载失败
    PluginLoadError(String),
    /// 插件执行失败
    PluginExecutionError(String),
    /// 插件执行超时
    PluginTimeout,
    /// 权限不足
    PermissionDenied(String),
    /// Manifest 解析失败
    ManifestParseError(String),
    /// WASM 模块验证失败
    WasmValidationError(String),
    /// WASM 实例化失败
    WasmInstantiationError(String),
    /// 函数调用失败
    FunctionCallError(String),
    /// 内存访问错误
    MemoryAccessError(String),
    /// IO 错误
    IoError(String),
}

pub type Result<T> = std::result::Result<T, PluginError>;

impl From<std::io::Error> for PluginError {
    fn from(err: std::io::Error) -> Self {
        PluginError::IoError(err.to_string())
    }
}

impl From<wasmtime::Error> for PluginError {
    fn from(err: wasmtime::Error) -> Self {
        PluginError::WasmInstantiationError(err.to_string())
    }
}

impl From<serde_json::Error> for PluginError {
    fn from(err: serde_json::Error) -> Self {
        PluginError::PluginExecutionError(format!("JSON error: {}", err))
    }
}

impl std::fmt::Display for PluginError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PluginError::PluginNotFound(id) => write!(f, "Plugin not found: {}", id),
            PluginError::PluginLoadError(msg) => write!(f, "Plugin load error: {}", msg),
            PluginError::PluginExecutionError(msg) => write!(f, "Plugin execution error: {}", msg),
            PluginError::PluginTimeout => write!(f, "Plugin execution timeout"),
            PluginError::PermissionDenied(perm) => write!(f, "Permission denied: {}", perm),
            PluginError::ManifestParseError(msg) => write!(f, "Manifest parse error: {}", msg),
            PluginError::WasmValidationError(msg) => write!(f, "WASM validation error: {}", msg),
            PluginError::WasmInstantiationError(msg) => write!(f, "WASM instantiation error: {}", msg),
            PluginError::FunctionCallError(msg) => write!(f, "Function call error: {}", msg),
            PluginError::MemoryAccessError(msg) => write!(f, "Memory access error: {}", msg),
            PluginError::IoError(msg) => write!(f, "IO error: {}", msg),
        }
    }
}

impl std::error::Error for PluginError {}
