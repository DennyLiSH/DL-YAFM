//! WASM 插件系统
//!
//! 提供 WASM 插件的加载、管理和执行功能。
//!
//! ## 架构
//!
//! ```text
//! ┌─────────────────────────────────────────┐
//! │              PluginManager              │
//! │  ┌─────────────┐  ┌─────────────────┐  │
//! │  │ WASM Engine │  │ Loaded Plugins  │  │
//! │  └─────────────┘  └─────────────────┘  │
//! └─────────────────────────────────────────┘
//!         │
//!         ▼
//! ┌─────────────────────────────────────────┐
//! │             SimpleSandbox               │
//! │  ┌─────────────┐  ┌─────────────────┐  │
//! │  │  WASM Store │  │  Memory Access  │  │
//! │  └─────────────┘  └─────────────────┘  │
//! └─────────────────────────────────────────┘
//! ```
//!
//! ## 插件目录结构
//!
//! ```text
//! plugins/
//! └── com.example.my-plugin/
//!     ├── plugin.json    # Manifest
//!     ├── plugin.wasm    # WASM 二进制
//!     └── README.md
//! ```

pub mod error;
pub mod host_functions;
pub mod manager;
pub mod models;
pub mod sandbox;

pub use error::{PluginError, Result};
pub use manager::{LoadedPlugin, PluginManager, PluginManagerState};
pub use models::{
    PluginAction,
    PluginContext,
    PluginInfo,
    PluginManifest,
    PluginMenuItem,
    PluginMenuItemConfig,
    PluginResult,
};
pub use sandbox::SimpleSandbox;
