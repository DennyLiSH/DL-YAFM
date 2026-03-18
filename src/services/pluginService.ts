import { invoke } from '@tauri-apps/api/core';
import type { FileEntry } from '@/types/file';
import type {
  PluginInfo,
  PluginMenuItem,
  PluginResult,
} from '@/types/plugin';

/**
 * 插件服务层
 * 封装与后端插件系统的交互
 */
export const pluginService = {
  /**
   * 获取所有已加载的插件
   */
  async getPlugins(): Promise<PluginInfo[]> {
    return invoke('get_plugins');
  },

  /**
   * 获取所有插件菜单项
   */
  async getPluginMenuItems(): Promise<PluginMenuItem[]> {
    return invoke('get_plugin_menu_items');
  },

  /**
   * 执行插件动作
   */
  async executePluginAction(
    pluginId: string,
    actionId: string,
    selectedEntries: FileEntry[],
    currentDirectory: string
  ): Promise<PluginResult> {
    return invoke('execute_plugin_action', {
      pluginId,
      actionId,
      selectedEntries,
      currentDirectory,
    });
  },

  /**
   * 重新加载所有插件
   */
  async reloadPlugins(): Promise<string[]> {
    return invoke('reload_plugins');
  },

  /**
   * 获取插件目录路径
   */
  async getPluginDirectory(): Promise<string> {
    return invoke('get_plugin_directory');
  },
};
