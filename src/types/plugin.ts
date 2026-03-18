/**
 * 插件 Manifest 配置
 */
export interface PluginManifest {
  /** 插件唯一标识 (反向域名格式) */
  id: string;
  /** 显示名称 */
  name: string;
  /** 版本号 */
  version: string;
  /** 描述 */
  description?: string;
  /** 作者 */
  author?: string;
  /** 最低应用版本 */
  minAppVersion?: string;
  /** 所需权限列表 */
  permissions?: string[];
  /** 菜单项配置 */
  menuItems: PluginMenuItemConfig[];
}

/**
 * 菜单项配置
 */
export interface PluginMenuItemConfig {
  /** 菜单项 ID */
  id: string;
  /** 显示文本 */
  label: string;
  /** 图标名称 */
  icon?: string;
  /** 适用的上下文 */
  contexts?: PluginContext[];
  /** 排序优先级 */
  order?: number;
  /** 是否禁用 */
  disabled?: boolean;
}

/**
 * 菜单上下文类型
 */
export type PluginContext = 'file' | 'folder' | 'multi-select';

/**
 * 带插件 ID 的菜单项
 */
export interface PluginMenuItem {
  /** 所属插件 ID */
  pluginId: string;
  /** 菜单项配置 */
  id: string;
  label: string;
  icon?: string;
  contexts?: PluginContext[];
  order?: number;
  disabled?: boolean;
}

/**
 * 插件信息 (返回给前端)
 */
export interface PluginInfo {
  /** 插件 ID */
  id: string;
  /** 显示名称 */
  name: string;
  /** 版本号 */
  version: string;
  /** 描述 */
  description: string;
  /** 作者 */
  author: string;
  /** 是否启用 */
  enabled: boolean;
}

/**
 * 插件执行结果
 */
export interface PluginResult {
  /** 是否成功 */
  success: boolean;
  /** 消息 */
  message?: string;
  /** 要执行的动作列表 */
  actions?: PluginAction[];
}

/**
 * 插件可触发的动作
 */
export type PluginAction =
  | { type: 'ShowMessage'; level: 'info' | 'success' | 'warning' | 'error'; text: string }
  | { type: 'RefreshFileList' }
  | { type: 'CopyToClipboard'; text: string }
  | { type: 'OpenUrl'; url: string };
