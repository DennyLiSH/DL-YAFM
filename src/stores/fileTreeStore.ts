import { create } from 'zustand';
import { fileService, type FileChangeEvent } from '@/services/fileService';
import { useCopyProgressStore } from '@/stores/copyProgressStore';
import type { FileEntry, TreeNodeState, PreviewType } from '@/types/file';
import { getErrorMessage } from '@/lib/error';

/**
 * Build a chain of parent directory paths from root to the given path
 * Used to expand all ancestors in FileTree when navigating to a nested directory
 */
function buildParentChain(
  path: string,
  rootPath: string | null,
  isSystemRoot: boolean
): string[] {
  const chain: string[] = [];
  const separator = path.includes('\\') ? '\\' : '/';
  const parts = path.split(/[\\/]/).filter(Boolean);

  // Build path from root
  let currentPath = '';

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!part) continue;

    if (isSystemRoot && currentPath === '') {
      // System root mode: first part is drive letter (e.g., "C:")
      currentPath = part + '\\';
    } else {
      currentPath = currentPath ? `${currentPath}${separator}${part}` : part;
    }

    // Skip if we're still within the root path
    if (rootPath && currentPath === rootPath) continue;

    chain.push(currentPath);
  }

  return chain;
}

// Clipboard entry type for copy/paste functionality
export interface ClipboardEntry {
  sourcePath: string;
  sourceName: string;
  isDir: boolean;
  isCut?: boolean; // 是否为剪切操作
}

interface FileTreeState {
  // State
  rootPath: string | null;
  isSystemRoot: boolean;  // Whether we're browsing system root (My Computer /)
  rootEntries: FileEntry[];
  expandedNodes: Set<string>;
  selectedNodes: Set<string>;
  lastSelectedNode: string | null;
  nodeCache: Map<string, TreeNodeState>;
  searchQuery: string;
  searchResults: FileEntry[];
  isSearching: boolean;
  isLoading: boolean;
  error: string | null;

  // Browse state
  currentBrowsePath: string | null;
  browseEntries: FileEntry[];
  browseHistory: string[];
  isLoadingBrowse: boolean;
  browseViewMode: 'grid' | 'list';

  // Preview state
  previewFile: FileEntry | null;
  previewContent: string;
  previewType: PreviewType;
  isLoadingPreview: boolean;
  previewError: string | null;
  previewPanelCollapsed: boolean;

  // Clipboard state (支持多选)
  clipboardEntries: ClipboardEntry[];

  // Watch state
  watchInitialized: boolean;

  // Actions
  setRootPath: (path: string | null) => void;
  setExpanded: (path: string, expanded: boolean) => void;
  toggleNode: (path: string) => void;
  selectNode: (path: string | null) => void;
  loadNodeChildren: (path: string) => Promise<void>;
  loadRootEntries: () => Promise<void>;
  setSearchQuery: (query: string) => void;
  search: (query: string) => Promise<void>;
  refreshNode: (path: string) => Promise<void>;
  clearError: () => void;

  // Browse actions
  setBrowsePath: (path: string) => Promise<void>;
  goBack: () => void;
  goToParent: () => Promise<void>;
  refreshBrowse: () => Promise<void>;
  setBrowseViewMode: (mode: 'grid' | 'list') => void;

  // Preview actions
  loadFilePreview: (entry: FileEntry) => Promise<void>;
  clearPreview: () => void;
  togglePreviewPanel: () => void;

  // Multi-select actions
  toggleNodeSelection: (path: string, modifier: 'none' | 'ctrl' | 'shift') => void;
  clearSelection: () => void;
  selectAll: (parentPath?: string) => void;
  getSelectedEntries: () => FileEntry[];

  // Clipboard actions (支持多选)
  copyToClipboard: (entry: FileEntry) => void;
  cutToClipboard: (entry: FileEntry) => void;
  copySelectedToClipboard: (entries: FileEntry[]) => void;
  cutSelectedToClipboard: (entries: FileEntry[]) => void;
  clearClipboard: () => void;
  pasteFromClipboard: (targetDir: string) => Promise<void>;

  // Watch actions
  initializeWatcher: () => Promise<void>;
  cleanupWatcher: () => Promise<void>;
  syncWatchedPaths: () => Promise<void>;
  handleFileChange: (event: FileChangeEvent) => void;
}

export const useFileTreeStore = create<FileTreeState>((set, get) => ({
  // Initial state
  rootPath: null,
  isSystemRoot: false,
  rootEntries: [],
  expandedNodes: new Set(),
  selectedNodes: new Set(),
  lastSelectedNode: null,
  nodeCache: new Map(),
  searchQuery: '',
  searchResults: [],
  isSearching: false,
  isLoading: false,
  error: null,

  // Browse initial state
  currentBrowsePath: null,
  browseEntries: [],
  browseHistory: [],
  isLoadingBrowse: false,
  browseViewMode: 'grid',

  // Preview initial state
  previewFile: null,
  previewContent: '',
  previewType: 'unsupported',
  isLoadingPreview: false,
  previewError: null,
  previewPanelCollapsed: (() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem('preview-panel-collapsed');
    return saved === 'true';
  })(),

  // Clipboard initial state (支持多选)
  clipboardEntries: [],

  // Watch initial state
  watchInitialized: false,

  // Actions
  setRootPath: (path) => {
    const isSystemRoot = path === 'system-root';
    set({ rootPath: isSystemRoot ? null : path, isSystemRoot });

    // Initialize watcher if not done
    if (path) {
      get().initializeWatcher();
      // Sync watched paths after setting root
      setTimeout(() => get().syncWatchedPaths(), 100);
    } else {
      get().cleanupWatcher();
    }
  },

  setExpanded: (path, expanded) => {
    const { expandedNodes } = get();
    const newExpanded = new Set(expandedNodes);
    if (expanded) {
      newExpanded.add(path);
    } else {
      newExpanded.delete(path);
    }
    set({ expandedNodes: newExpanded });

    // Sync watched paths after expansion change
    get().syncWatchedPaths();
  },

  toggleNode: (path) => {
    const { expandedNodes } = get();
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    set({ expandedNodes: newExpanded });

    // Sync watched paths after toggle
    get().syncWatchedPaths();
  },

  selectNode: (path) => {
    if (path) {
      set({ selectedNodes: new Set([path]), lastSelectedNode: path });
    } else {
      set({ selectedNodes: new Set(), lastSelectedNode: null });
    }
  },

  // Multi-select actions
  toggleNodeSelection: (path, modifier) => {
    const { selectedNodes, lastSelectedNode, rootPath, nodeCache, rootEntries } = get();

    if (modifier === 'none') {
      // 普通点击：清除其他选择，只选中当前
      set({ selectedNodes: new Set([path]), lastSelectedNode: path });
    } else if (modifier === 'ctrl') {
      // Ctrl+点击：切换选中状态
      const newSelected = new Set(selectedNodes);
      if (newSelected.has(path)) {
        newSelected.delete(path);
        if (newSelected.size === 0) {
          set({ selectedNodes: newSelected, lastSelectedNode: null });
        } else {
          set({ selectedNodes: newSelected, lastSelectedNode: path });
        }
      } else {
        newSelected.add(path);
        set({ selectedNodes: newSelected, lastSelectedNode: path });
      }
    } else if (modifier === 'shift' && lastSelectedNode) {
      // Shift+点击：范围选择
      // 获取父目录
      const getParentPath = (p: string) => {
        const parts = p.split(/[\\/]/);
        parts.pop();
        return parts.join(p.includes('\\') ? '\\' : '/');
      };

      const startParent = getParentPath(lastSelectedNode);
      const endParent = getParentPath(path);

      // 只允许同目录范围选择
      if (startParent !== endParent) {
        // 跨目录则退化为单选
        set({ selectedNodes: new Set([path]), lastSelectedNode: path });
        return;
      }

      // 获取同目录的兄弟节点
      const siblings = startParent === rootPath
        ? rootEntries
        : (nodeCache.get(startParent!)?.children || []);

      if (siblings.length === 0) return;

      // 找到起始和结束索引
      const startIndex = siblings.findIndex(s => s.path === lastSelectedNode);
      const endIndex = siblings.findIndex(s => s.path === path);

      if (startIndex === -1 || endIndex === -1) return;

      // 计算范围并选中
      const [from, to] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
      const newSelection = new Set<string>();
      for (let i = from; i <= to; i++) {
        const sibling = siblings[i];
        if (sibling) {
          newSelection.add(sibling.path);
        }
      }

      set({ selectedNodes: newSelection, lastSelectedNode: path });
    }
  },

  clearSelection: () => set({ selectedNodes: new Set(), lastSelectedNode: null }),

  selectAll: (parentPath) => {
    const { rootPath, nodeCache, rootEntries, currentBrowsePath } = get();
    const targetPath = parentPath || currentBrowsePath || rootPath;

    if (!targetPath) return;

    const entries = targetPath === rootPath
      ? rootEntries
      : (nodeCache.get(targetPath)?.children || []);

    const newSelection = new Set(entries.map(e => e.path));
    set({ selectedNodes: newSelection, lastSelectedNode: null });
  },

  getSelectedEntries: () => {
    const { selectedNodes, rootPath, nodeCache, rootEntries } = get();
    const entries: FileEntry[] = [];

    selectedNodes.forEach(path => {
      // 从 rootEntries 或 nodeCache 中查找
      const parentPath = path.split(/[\\/]/).slice(0, -1).join(path.includes('\\') ? '\\' : '/');
      const siblings = parentPath === rootPath || parentPath === ''
        ? rootEntries
        : (nodeCache.get(parentPath)?.children || []);

      const entry = siblings.find(e => e.path === path);
      if (entry) {
        entries.push(entry);
      }
    });

    return entries;
  },

  loadNodeChildren: async (path) => {
    const { nodeCache } = get();
    const cached = nodeCache.get(path);

    // Skip if already loading
    if (cached?.isLoading) return;

    // Update cache to show loading state
    const newCache = new Map(nodeCache);
    newCache.set(path, {
      children: cached?.children || [],
      isLoaded: cached?.isLoaded || false,
      isLoading: true,
    });
    set({ nodeCache: newCache });

    try {
      const children = await fileService.getDirectoryEntries(path);
      const updatedCache = new Map(get().nodeCache);
      updatedCache.set(path, {
        children,
        isLoaded: true,
        isLoading: false,
      });
      set({ nodeCache: updatedCache, error: null });
    } catch (err) {
      const errorCache = new Map(get().nodeCache);
      errorCache.set(path, {
        children: [],
        isLoaded: false,
        isLoading: false,
        error: getErrorMessage(err),
      });
      set({ nodeCache: errorCache, error: getErrorMessage(err) });
    }
  },

  loadRootEntries: async () => {
    const { rootPath, isLoading, isSystemRoot } = get();

    // 防止重复调用
    if (isLoading) return;
    if (!rootPath && !isSystemRoot) return;

    set({ isLoading: true, error: null });
    try {
      let entries: FileEntry[];
      if (isSystemRoot) {
        entries = await fileService.getSystemRootEntries();
      } else if (rootPath) {
        entries = await fileService.getDirectoryEntries(rootPath);
      } else {
        entries = [];
      }
      set({ rootEntries: entries });
    } catch (err) {
      set({ error: getErrorMessage(err) });
    } finally {
      set({ isLoading: false });
    }
  },

  setSearchQuery: (query) => set({ searchQuery: query }),

  search: async (query) => {
    const { rootPath } = get();
    if (!rootPath || !query.trim()) {
      set({ searchResults: [], isSearching: false });
      return;
    }

    set({ isSearching: true, searchQuery: query });
    try {
      const results = await fileService.searchFiles(rootPath, query);
      set({ searchResults: results, isSearching: false });
    } catch (err) {
      set({ searchResults: [], isSearching: false, error: getErrorMessage(err) });
    }
  },

  refreshNode: async (path) => {
    const { rootPath, nodeCache } = get();

    // If refreshing root
    if (path === rootPath) {
      await get().loadRootEntries();
      return;
    }

    // Reset cache state to force reload (instead of deleting to avoid race condition)
    const newCache = new Map(nodeCache);
    const cached = newCache.get(path);
    newCache.set(path, {
      children: cached?.children || [],
      isLoaded: false,
      isLoading: false,
    });
    set({ nodeCache: newCache });

    await get().loadNodeChildren(path);
  },

  clearError: () => set({ error: null }),

  // Browse actions
  setBrowsePath: async (path) => {
    const { currentBrowsePath, browseHistory, rootPath, isSystemRoot, expandedNodes } = get();

    // Add current path to history if it exists and is different
    const newHistory = currentBrowsePath && currentBrowsePath !== path
      ? [...browseHistory, currentBrowsePath]
      : browseHistory;

    set({ isLoadingBrowse: true, currentBrowsePath: path, browseHistory: newHistory });

    // Expand parent chain in FileTree to reveal current path
    if (path && (rootPath || isSystemRoot)) {
      const parentChain = buildParentChain(path, rootPath, isSystemRoot);
      const newExpanded = new Set(expandedNodes);
      for (const parent of parentChain) {
        newExpanded.add(parent);
      }
      set({
        expandedNodes: newExpanded,
        selectedNodes: new Set([path]),
        lastSelectedNode: path,
      });
    }

    try {
      const entries = await fileService.getDirectoryEntries(path);
      set({ browseEntries: entries, isLoadingBrowse: false });
    } catch (err) {
      set({ browseEntries: [], isLoadingBrowse: false, error: getErrorMessage(err) });
    }
  },

  goBack: () => {
    const { browseHistory } = get();
    if (browseHistory.length === 0) return;

    const previousPath = browseHistory[browseHistory.length - 1];
    if (!previousPath) return; // undefined check for noUncheckedIndexedAccess

    const newHistory = browseHistory.slice(0, -1);

    set({
      currentBrowsePath: previousPath,
      browseHistory: newHistory,
    });

    // Load entries for previous path
    get().setBrowsePath(previousPath);
  },

  goToParent: async () => {
    const { currentBrowsePath } = get();
    if (!currentBrowsePath) return;

    // Get parent path
    const parts = currentBrowsePath.split(/[\\/]/);
    parts.pop();
    const parentPath = parts.join(currentBrowsePath.includes('\\') ? '\\' : '/');

    if (!parentPath) return;

    await get().setBrowsePath(parentPath);
  },

  refreshBrowse: async () => {
    const { currentBrowsePath, isLoadingBrowse } = get();

    if (isLoadingBrowse) return;
    if (!currentBrowsePath) return;

    set({ isLoadingBrowse: true });
    try {
      const entries = await fileService.getDirectoryEntries(currentBrowsePath);
      set({ browseEntries: entries });
    } catch (err) {
      set({ browseEntries: [], error: getErrorMessage(err) });
    } finally {
      set({ isLoadingBrowse: false });
    }
  },

  setBrowseViewMode: (mode) => set({ browseViewMode: mode }),

  // Preview actions
  loadFilePreview: async (entry) => {
    const ext = entry.extension?.toLowerCase();

    // Supported file types
    const textTypes = ['txt', 'json', 'js', 'ts', 'jsx', 'tsx', 'css', 'html', 'xml', 'yaml', 'yml', 'log', 'ini', 'conf', 'sh', 'bat'];
    const imageTypes = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'];

    set({ previewFile: entry, isLoadingPreview: true, previewError: null });

    try {
      if (ext === 'md') {
        // Markdown preview
        const content = await fileService.readFileContent(entry.path);
        set({ previewContent: content, previewType: 'markdown', isLoadingPreview: false });
      } else if (textTypes.includes(ext || '')) {
        // Text file preview
        const content = await fileService.readFileContent(entry.path);
        set({ previewContent: content, previewType: 'text', isLoadingPreview: false });
      } else if (imageTypes.includes(ext || '')) {
        // Image preview
        const base64 = await fileService.readFileAsBase64(entry.path);
        const mimeTypes: Record<string, string> = {
          png: 'image/png',
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          gif: 'image/gif',
          svg: 'image/svg+xml',
          webp: 'image/webp',
          bmp: 'image/bmp',
          ico: 'image/x-icon',
        };
        const mimeType = mimeTypes[ext || ''] || 'application/octet-stream';
        set({
          previewContent: `data:${mimeType};base64,${base64}`,
          previewType: 'image',
          isLoadingPreview: false,
        });
      } else if (ext === 'pdf') {
        // PDF preview - read as base64 and convert to Uint8Array in component
        const base64 = await fileService.readFileAsBase64(entry.path);
        set({ previewContent: base64, previewType: 'pdf', isLoadingPreview: false });
      } else {
        // Unsupported file type
        set({
          previewContent: '',
          previewType: 'unsupported',
          previewError: '暂不支持此文件类型预览',
          isLoadingPreview: false,
        });
      }
    } catch (err) {
      set({
        previewContent: '',
        previewType: 'unsupported',
        isLoadingPreview: false,
        previewError: getErrorMessage(err),
      });
    }
  },

  clearPreview: () => set({
    previewFile: null,
    previewContent: '',
    previewType: 'unsupported',
    previewError: null,
  }),

  togglePreviewPanel: () => {
    const newState = !get().previewPanelCollapsed;
    localStorage.setItem('preview-panel-collapsed', String(newState));
    set({ previewPanelCollapsed: newState });
  },

  // Clipboard actions
  copyToClipboard: (entry) => set({
    clipboardEntries: [{
      sourcePath: entry.path,
      sourceName: entry.name,
      isDir: entry.is_dir,
      isCut: false,
    }],
  }),

  cutToClipboard: (entry) => set({
    clipboardEntries: [{
      sourcePath: entry.path,
      sourceName: entry.name,
      isDir: entry.is_dir,
      isCut: true,
    }],
  }),

  copySelectedToClipboard: (entries) => set({
    clipboardEntries: entries.map(entry => ({
      sourcePath: entry.path,
      sourceName: entry.name,
      isDir: entry.is_dir,
      isCut: false,
    })),
  }),

  cutSelectedToClipboard: (entries) => set({
    clipboardEntries: entries.map(entry => ({
      sourcePath: entry.path,
      sourceName: entry.name,
      isDir: entry.is_dir,
      isCut: true,
    })),
  }),

  clearClipboard: () => set({ clipboardEntries: [] }),

  pasteFromClipboard: async (targetDir) => {
    const { clipboardEntries, rootPath } = get();
    if (clipboardEntries.length === 0) return;

    const isCut = clipboardEntries[0]?.isCut ?? false;
    const sourcePaths: string[] = [];

    // 逐个处理剪贴板条目
    for (const clipboardEntry of clipboardEntries) {
      const destPath = `${targetDir}/${clipboardEntry.sourceName}`;
      const taskId = `copy-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const sourcePath = clipboardEntry.sourcePath;
      sourcePaths.push(sourcePath);

      // Subscribe to progress events
      const unlisten = await fileService.onCopyProgress((progress) => {
        if (progress.task_id === taskId) {
          const { addTask, updateTask } = useCopyProgressStore.getState();
          if (progress.is_complete) {
            if (progress.error) {
              // Error occurred
              updateTask(taskId, progress);
            } else {
              // Success - remove task after a delay
              setTimeout(() => {
                useCopyProgressStore.getState().removeTask(taskId);
              }, 2000);
            }
          } else {
            // Update progress
            const task = useCopyProgressStore.getState().tasks.get(taskId);
            if (task) {
              updateTask(taskId, progress);
            } else {
              addTask(progress);
            }
          }
        }
      });

      try {
        await fileService.copyEntryAsync(taskId, sourcePath, destPath);
        // Refresh the target directory after copy starts (will refresh again on complete)
        get().refreshNode(targetDir);
      } catch (err) {
        console.error('Failed to copy:', sourcePath, err);
      } finally {
        // Unsubscribe from progress events
        unlisten();
      }
    }

    // 如果是剪切操作，复制完成后删除源文件
    if (isCut) {
      setTimeout(async () => {
        for (const sourcePath of sourcePaths) {
          try {
            await fileService.deleteEntry(sourcePath, true);
            // 刷新源目录
            const sourceParent = sourcePath.substring(0, sourcePath.lastIndexOf(/[\\/]/.test(sourcePath) ? (sourcePath.includes('\\') ? '\\' : '/') : '/'));
            if (sourceParent === rootPath) {
              get().loadRootEntries();
            } else if (sourceParent) {
              get().refreshNode(sourceParent);
            }
          } catch (err) {
            console.error('Failed to delete source after cut:', err);
          }
        }
        // 清空剪贴板
        set({ clipboardEntries: [] });
      }, 1000);
    }
  },

  // Watch actions
  initializeWatcher: async () => {
    const { watchInitialized } = get();
    if (watchInitialized) return;

    try {
      // Subscribe to file change events
      const unlisten = await fileService.onFileChange((event) => {
        get().handleFileChange(event);
      });

      // Store unlisten function globally for cleanup
      window.__fileChangeUnlisten = unlisten;

      set({ watchInitialized: true });
      console.log('[FileTreeStore] Watcher initialized');
    } catch (err) {
      console.error('[FileTreeStore] Failed to initialize watcher:', err);
    }
  },

  cleanupWatcher: async () => {
    try {
      const unlisten = window.__fileChangeUnlisten;
      if (unlisten) {
        unlisten();
        window.__fileChangeUnlisten = undefined;
      }
      await fileService.stopAllWatch();
      set({ watchInitialized: false });
      console.log('[FileTreeStore] Watcher cleaned up');
    } catch (err) {
      console.error('[FileTreeStore] Failed to cleanup watcher:', err);
    }
  },

  syncWatchedPaths: async () => {
    const { expandedNodes, rootPath, watchInitialized } = get();

    if (!watchInitialized) return;

    // Collect all expanded directory paths + root path
    const pathsToWatch: string[] = [];

    // Add root path if it exists (skip virtual system-root)
    if (rootPath && rootPath !== 'system-root') {
      pathsToWatch.push(rootPath);
    }

    // Add all expanded directory paths (skip virtual paths)
    for (const path of expandedNodes) {
      // Skip virtual paths like 'system-root'
      if (path === 'system-root') continue;
      if (!pathsToWatch.includes(path)) {
        pathsToWatch.push(path);
      }
    }

    try {
      await fileService.updateWatchPaths(pathsToWatch);
      console.log('[FileTreeStore] Synced watched paths:', pathsToWatch.length);
    } catch (err) {
      console.error('[FileTreeStore] Failed to sync watched paths:', err);
    }
  },

  handleFileChange: (event: FileChangeEvent) => {
    const { expandedNodes, rootPath, currentBrowsePath } = get();

    // Check if the changed directory is relevant (expanded or root)
    const isExpanded = expandedNodes.has(event.directory);
    const isRoot = event.directory === rootPath;
    const isBrowsePath = event.directory === currentBrowsePath;

    if (!isExpanded && !isRoot && !isBrowsePath) {
      return;
    }

    console.log('[FileTreeStore] File change detected:', event.kind, 'in', event.directory);

    // Debounce refresh using a map
    const debounceMap = window.__refreshDebounceMap || new Map();
    window.__refreshDebounceMap = debounceMap;

    const existing = debounceMap.get(event.directory);
    if (existing) {
      clearTimeout(existing);
    }

    debounceMap.set(event.directory, setTimeout(() => {
      debounceMap.delete(event.directory);

      // Refresh the affected directory in file tree
      get().refreshNode(event.directory);

      // Also refresh browse view if viewing the same directory
      if (event.directory === currentBrowsePath) {
        get().refreshBrowse();
      }
    }, 100)); // 100ms debounce
  },
}));
