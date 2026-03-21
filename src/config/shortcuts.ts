/**
 * 快捷键配置文件
 * 统一管理应用中的所有快捷键定义
 */

export interface ShortcutConfig {
  /** 唯一标识符 */
  id: string;
  /** 按键 */
  key: string;
  /** 是否需要 Ctrl/Cmd 键 */
  ctrl?: boolean;
  /** 是否需要 Alt 键 */
  alt?: boolean;
  /** 是否需要 Shift 键 */
  shift?: boolean;
  /** 功能描述 */
  description: string;
  /** 分类 */
  category: string;
}

/**
 * 格式化快捷键显示文本
 */
export function formatShortcut(shortcut: ShortcutConfig): string {
  const parts: string[] = [];
  if (shortcut.ctrl) parts.push('Ctrl');
  if (shortcut.alt) parts.push('Alt');
  if (shortcut.shift) parts.push('Shift');

  // 格式化按键名称
  let keyName = shortcut.key;
  if (keyName === ' ') keyName = 'Space';
  else if (keyName === 'ArrowUp') keyName = '↑';
  else if (keyName === 'ArrowDown') keyName = '↓';
  else if (keyName === 'ArrowLeft') keyName = '←';
  else if (keyName === 'ArrowRight') keyName = '→';
  else if (keyName === 'Escape') keyName = 'Esc';
  else if (keyName === 'Delete') keyName = 'Del';
  else if (keyName.length === 1) keyName = keyName.toUpperCase();

  parts.push(keyName);
  return parts.join('+');
}

/**
 * 所有快捷键配置
 */
export const SHORTCUTS: ShortcutConfig[] = [
  // 文件浏览
  { id: 'fb.rename', key: 'F2', description: '重命名', category: '文件浏览' },
  { id: 'fb.delete', key: 'Delete', description: '删除', category: '文件浏览' },
  { id: 'fb.selectAll', key: 'a', ctrl: true, description: '全选', category: '文件浏览' },
  { id: 'fb.copy', key: 'c', ctrl: true, description: '复制（到系统剪贴板）', category: '文件浏览' },
  { id: 'fb.cut', key: 'x', ctrl: true, description: '剪切', category: '文件浏览' },
  { id: 'fb.paste', key: 'v', ctrl: true, description: '粘贴（从系统剪贴板）', category: '文件浏览' },
  { id: 'fb.escape', key: 'Escape', description: '取消选择/搜索', category: '文件浏览' },

  // 搜索
  { id: 'search.selectAll', key: 'a', alt: true, description: '全选输入内容', category: '搜索' },
  { id: 'search.cancel', key: 'Escape', description: '取消搜索', category: '搜索' },
];

/**
 * 按分类分组的快捷键
 */
export const SHORTCUTS_BY_CATEGORY = SHORTCUTS.reduce((acc, shortcut) => {
  const category = shortcut.category;
  if (!acc[category]) {
    acc[category] = [];
  }
  acc[category].push(shortcut);
  return acc;
}, {} as Record<string, ShortcutConfig[]>);
