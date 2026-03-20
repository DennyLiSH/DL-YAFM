/**
 * 插件 Manifest 配置
 */
export interface PluginManifest {
  /** 插件唯一标识 (反向域名格式) */
  readonly id: string;
  /** 显示名称 */
  readonly name: string;
  /** 版本号 */
  readonly version: string;
  /** 描述 */
  readonly description?: string;
  /** 作者 */
  readonly author?: string;
  /** 最低应用版本 */
  readonly minAppVersion?: string;
  /** 所需权限列表 */
  readonly permissions?: readonly string[];
  /** 菜单项配置 */
  readonly menuItems: readonly PluginMenuItemConfig[];
}

/**
 * 菜单项配置
 */
export interface PluginMenuItemConfig {
  /** 菜单项 ID */
  readonly id: string;
  /** 显示文本 */
  readonly label: string;
  /** 图标名称 */
  readonly icon?: string;
  /** 适用的上下文 */
  readonly contexts?: readonly PluginContext[];
  /** 排序优先级 */
  readonly order?: number;
  /** 是否禁用 */
  readonly disabled?: boolean;
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
  readonly pluginId: string;
  /** 菜单项配置 */
  readonly id: string;
  readonly label: string;
  readonly icon?: string;
  readonly contexts?: readonly PluginContext[];
  readonly order?: number;
  readonly disabled?: boolean;
}

/**
 * 插件信息 (返回给前端)
 */
export interface PluginInfo {
  /** 插件 ID */
  readonly id: string;
  /** 显示名称 */
  readonly name: string;
  /** 版本号 */
  readonly version: string;
  /** 描述 */
  readonly description: string;
  /** 作者 */
  readonly author: string;
  /** 是否启用 */
  readonly enabled: boolean;
}

/**
 * 插件执行结果
 */
export interface PluginResult {
  /** 是否成功 */
  readonly success: boolean;
  /** 消息 */
  readonly message?: string;
  /** 要执行的动作列表 */
  readonly actions?: readonly PluginAction[];
}

/**
 * 插件可触发的动作
 */
export type PluginAction =
  | { type: 'ShowMessage'; level: 'info' | 'success' | 'warning' | 'error'; text: string }
  | { type: 'RefreshFileList' }
  | { type: 'CopyToClipboard'; text: string }
  | { type: 'OpenUrl'; url: string };
