use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Clone, Serialize, Deserialize, Error)]
pub enum PluginError {
    /// 插件未找到
    #[error("Plugin not found: {0}")]
    PluginNotFound(String),

    /// 插件加载失败
    #[error("Plugin load error: {0}")]
    PluginLoadError(String),

    /// 插件执行失败
    #[error("Plugin execution error: {0}")]
    PluginExecutionError(String),

    /// 插件执行超时
    #[error("Plugin execution timeout")]
    PluginTimeout,

    /// 权限不足
    #[error("Permission denied: {0}")]
    PermissionDenied(String),

    /// Manifest 解析失败
    #[error("Manifest parse error: {0}")]
    ManifestParseError(String),

    /// WASM 模块验证失败
    #[error("WASM validation error: {0}")]
    WasmValidationError(String),

    /// WASM 实例化失败
    #[error("WASM instantiation error: {0}")]
    WasmInstantiationError(String),

    /// 函数调用失败
    #[error("Function call error: {0}")]
    FunctionCallError(String),

    /// 内存访问错误
    #[error("Memory access error: {0}")]
    MemoryAccessError(String),

    /// IO 错误
    #[error("IO error: {0}")]
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
