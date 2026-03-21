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

// Re-export types used by other modules
pub use manager::{PluginManager, PluginManagerState};
pub use models::{PluginContext, PluginInfo, PluginMenuItem, PluginResult};
