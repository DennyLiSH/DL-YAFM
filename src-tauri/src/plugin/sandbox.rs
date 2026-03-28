#[cfg(feature = "plugin-system")]
use wasmtime::*;

use super::error::{PluginError, Result};
use super::models::{PluginContext, PluginResult};

/// 默认燃料限制 (100万单位)
const DEFAULT_FUEL_LIMIT: u64 = 1_000_000;
/// 最大字符串长度 (1MB)
const MAX_STRING_LENGTH: usize = 1024 * 1024;
/// 最大读取迭代次数
const MAX_READ_ITERATIONS: usize = 10_000_000;

/// 简化版沙箱（不使用 WASI）
pub struct SimpleSandbox {
    store: Store<()>,
    instance: Instance,
    memory: Memory,
}

impl SimpleSandbox {
    /// 创建简化版沙箱
    pub fn new(engine: &Engine, module: &Module) -> Result<Self> {
        let mut store = Store::new(engine, ());
        store.set_fuel(DEFAULT_FUEL_LIMIT)?;

        let instance = Instance::new(&mut store, module, &[])?;

        let memory = instance
            .get_memory(&mut store, "memory")
            .ok_or_else(|| PluginError::MemoryAccessError("Memory not found".to_string()))?;

        Ok(Self {
            store,
            instance,
            memory,
        })
    }

    /// 执行插件动作
    pub fn execute_action(
        &mut self,
        action_id: &str,
        context: &PluginContext,
    ) -> Result<PluginResult> {
        let execute_func = self.instance
            .get_typed_func::<(i32, i32), i32>(&mut self.store, "execute_action")
            .map_err(|e| PluginError::FunctionCallError(format!("execute_action not found: {}", e)))?;

        let context_json = serde_json::to_string(context)?;

        let action_ptr = self.write_string(action_id)?;
        let context_ptr = self.write_string(&context_json)?;

        let result_ptr = execute_func
            .call(&mut self.store, (action_ptr, context_ptr))
            .map_err(|e: wasmtime::Error| PluginError::FunctionCallError(e.to_string()))?;

        let result_json = self.read_string(result_ptr)?;

        if result_ptr != 0 {
            self.free_string(result_ptr)?;
        }

        let result: PluginResult = serde_json::from_str(&result_json)
            .map_err(|e| PluginError::PluginExecutionError(format!("Failed to parse result: {}", e)))?;

        // Validate all actions before returning
        for action in &result.actions {
            action.validate()
                .map_err(PluginError::PermissionDenied)?;
        }

        Ok(result)
    }

    fn write_string(&mut self, s: &str) -> Result<i32> {
        let bytes = s.as_bytes();
        let len = bytes.len() + 1;

        // 安全检查：防止写入过大的字符串
        if len > MAX_STRING_LENGTH {
            return Err(PluginError::MemoryAccessError(format!(
                "String too large: {} bytes (max: {})",
                len, MAX_STRING_LENGTH
            )));
        }

        let alloc_func = self.instance
            .get_typed_func::<i32, i32>(&mut self.store, "allocate")
            .map_err(|_| PluginError::MemoryAccessError("allocate not found".to_string()))?;

        let ptr = alloc_func
            .call(&mut self.store, len as i32)
            .map_err(|e: wasmtime::Error| PluginError::MemoryAccessError(e.to_string()))?;

        let data = self.memory.data_mut(&mut self.store);
        for (i, &byte) in bytes.iter().enumerate() {
            data[ptr as usize + i] = byte;
        }
        data[ptr as usize + bytes.len()] = 0;

        Ok(ptr)
    }

    fn read_string(&mut self, ptr: i32) -> Result<String> {
        if ptr == 0 {
            return Ok(String::new());
        }

        let data = self.memory.data(&self.store);
        let mut bytes = Vec::new();
        let mut offset = ptr as usize;
        let mut iterations = 0;

        while offset < data.len() && data[offset] != 0 {
            // 安全检查：防止无限循环
            iterations += 1;
            if iterations > MAX_READ_ITERATIONS {
                return Err(PluginError::MemoryAccessError(
                    "Read string iteration limit exceeded".to_string(),
                ));
            }
            // 安全检查：防止读取过大的字符串
            if bytes.len() >= MAX_STRING_LENGTH {
                return Err(PluginError::MemoryAccessError(format!(
                    "String too large: exceeds {} bytes",
                    MAX_STRING_LENGTH
                )));
            }
            bytes.push(data[offset]);
            offset += 1;
        }

        String::from_utf8(bytes)
            .map_err(|e| PluginError::MemoryAccessError(format!("Invalid UTF-8: {}", e)))
    }

    fn free_string(&mut self, ptr: i32) -> Result<()> {
        if ptr == 0 {
            return Ok(());
        }

        let dealloc_func = self.instance
            .get_typed_func::<i32, ()>(&mut self.store, "deallocate")
            .map_err(|_| PluginError::MemoryAccessError("deallocate not found".to_string()))?;

        dealloc_func
            .call(&mut self.store, ptr)
            .map_err(|e: wasmtime::Error| PluginError::MemoryAccessError(e.to_string()))?;

        Ok(())
    }
}
