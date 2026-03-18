import { create } from 'zustand';
import { toast } from 'sonner';
import { pluginService } from '@/services/pluginService';
import type { FileEntry } from '@/types/file';
import type { PluginInfo, PluginMenuItem, PluginResult } from '@/types/plugin';

interface PluginState {
  /** 已加载的插件列表 */
  plugins: PluginInfo[];
  /** 所有插件菜单项 */
  menuItems: PluginMenuItem[];
  /** 是否正在加载 */
  isLoading: boolean;
  /** 是否已初始化 */
  isInitialized: boolean;
  /** 插件目录路径 */
  pluginDirectory: string | null;

  /** 初始化插件系统 */
  initialize: () => Promise<void>;
  /** 刷新插件列表 */
  refreshPlugins: () => Promise<void>;
  /** 根据上下文过滤菜单项 */
  getMenuItemsForContext: (
    entries: FileEntry[],
    context: 'FileBrowser' | 'FileTree'
  ) => PluginMenuItem[];
  /** 执行插件动作 */
  executeAction: (
    pluginId: string,
    actionId: string,
    entries: FileEntry[],
    currentDirectory: string,
    onSuccess?: () => void
  ) => Promise<void>;
}

export const usePluginStore = create<PluginState>((set, get) => ({
  plugins: [],
  menuItems: [],
  isLoading: false,
  isInitialized: false,
  pluginDirectory: null,

  initialize: async () => {
    if (get().isInitialized) return;

    set({ isLoading: true });
    try {
      const [menuItems, pluginDirectory] = await Promise.all([
        pluginService.getPluginMenuItems(),
        pluginService.getPluginDirectory(),
      ]);

      set({
        menuItems,
        pluginDirectory,
        isLoading: false,
        isInitialized: true,
      });
    } catch (error) {
      console.error('Failed to initialize plugins:', error);
      set({ isLoading: false, isInitialized: true });
    }
  },

  refreshPlugins: async () => {
    set({ isLoading: true });
    try {
      await pluginService.reloadPlugins();
      const menuItems = await pluginService.getPluginMenuItems();

      set({ menuItems, isLoading: false });
      toast.success('插件已刷新');
    } catch (error) {
      console.error('Failed to refresh plugins:', error);
      set({ isLoading: false });
      toast.error('插件刷新失败');
    }
  },

  getMenuItemsForContext: (entries, _context) => {
    const { menuItems } = get();
    const isMultiSelect = entries.length > 1;
    const hasFiles = entries.some((e) => !e.is_dir);
    const hasFolders = entries.some((e) => e.is_dir);

    return menuItems
      .filter((item) => {
        const contexts = item.contexts || ['file', 'folder'];

        // 多选模式检查
        if (isMultiSelect) {
          return contexts.includes('multi-select');
        }

        // 单选模式检查
        if (hasFiles && !contexts.includes('file')) return false;
        if (hasFolders && !contexts.includes('folder')) return false;

        return true;
      })
      .sort((a, b) => (a.order ?? 1000) - (b.order ?? 1000));
  },

  executeAction: async (pluginId, actionId, entries, currentDirectory, onSuccess) => {
    try {
      const result: PluginResult = await pluginService.executePluginAction(
        pluginId,
        actionId,
        entries,
        currentDirectory
      );

      // 处理插件返回的动作
      if (result.actions) {
        for (const action of result.actions) {
          handlePluginAction(action, onSuccess);
        }
      }

      if (result.message) {
        if (result.success) {
          toast.success(result.message);
        } else {
          toast.error(result.message);
        }
      }
    } catch (error) {
      console.error('Plugin execution failed:', error);
      toast.error(`插件执行失败: ${error}`);
    }
  },
}));

/**
 * 处理插件返回的动作
 */
function handlePluginAction(
  action: NonNullable<PluginResult['actions']>[number],
  onRefresh?: () => void
) {
  switch (action.type) {
    case 'ShowMessage':
      switch (action.level) {
        case 'success':
          toast.success(action.text);
          break;
        case 'warning':
          toast.warning(action.text);
          break;
        case 'error':
          toast.error(action.text);
          break;
        default:
          toast.info(action.text);
      }
      break;

    case 'RefreshFileList':
      onRefresh?.();
      break;

    case 'CopyToClipboard':
      navigator.clipboard.writeText(action.text).then(() => {
        toast.success('已复制到剪贴板');
      });
      break;

    case 'OpenUrl':
      window.open(action.url, '_blank');
      break;
  }
}
