import { create } from 'zustand';
import { fileService, type FileChangeEvent } from '@/services/fileService';
import { useCopyProgressStore } from '@/stores/copyProgressStore';
import type { FileEntry, TreeNodeState, PreviewType } from '@/types/file';

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
  rootEntries: FileEntry[];
  expandedNodes: Set<string>;
  selectedNode: string | null;
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

  // Preview state
  previewFile: FileEntry | null;
  previewContent: string;
  previewType: PreviewType;
  isLoadingPreview: boolean;
  previewError: string | null;

  // Clipboard state
  clipboardEntry: ClipboardEntry | null;

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

  // Preview actions
  loadFilePreview: (entry: FileEntry) => Promise<void>;
  clearPreview: () => void;

  // Clipboard actions
  copyToClipboard: (entry: FileEntry) => void;
  cutToClipboard: (entry: FileEntry) => void;
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
  rootEntries: [],
  expandedNodes: new Set(),
  selectedNode: null,
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

  // Preview initial state
  previewFile: null,
  previewContent: '',
  previewType: 'unsupported',
  isLoadingPreview: false,
  previewError: null,

  // Clipboard initial state
  clipboardEntry: null,

  // Watch initial state
  watchInitialized: false,

  // Actions
  setRootPath: (path) => {
    set({ rootPath: path });

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

  selectNode: (path) => set({ selectedNode: path }),

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
        error: String(err),
      });
      set({ nodeCache: errorCache, error: String(err) });
    }
  },

  loadRootEntries: async () => {
    const { rootPath, isLoading } = get();

    // 防止重复调用
    if (isLoading) return;
    if (!rootPath) return;

    set({ isLoading: true, error: null });
    try {
      const entries = await fileService.getDirectoryEntries(rootPath);
      set({ rootEntries: entries });
    } catch (err) {
      set({ error: String(err) });
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
      set({ searchResults: [], isSearching: false, error: String(err) });
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
    const { currentBrowsePath, browseHistory } = get();

    // Add current path to history if it exists and is different
    const newHistory = currentBrowsePath && currentBrowsePath !== path
      ? [...browseHistory, currentBrowsePath]
      : browseHistory;

    set({ isLoadingBrowse: true, currentBrowsePath: path, browseHistory: newHistory });

    try {
      const entries = await fileService.getDirectoryEntries(path);
      set({ browseEntries: entries, isLoadingBrowse: false });
    } catch (err) {
      set({ browseEntries: [], isLoadingBrowse: false, error: String(err) });
    }
  },

  goBack: () => {
    const { browseHistory } = get();
    if (browseHistory.length === 0) return;

    const previousPath = browseHistory[browseHistory.length - 1];
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
      set({ browseEntries: [], error: String(err) });
    } finally {
      set({ isLoadingBrowse: false });
    }
  },

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
        previewError: String(err),
      });
    }
  },

  clearPreview: () => set({
    previewFile: null,
    previewContent: '',
    previewType: 'unsupported',
    previewError: null,
  }),

  // Clipboard actions
  copyToClipboard: (entry) => set({
    clipboardEntry: {
      sourcePath: entry.path,
      sourceName: entry.name,
      isDir: entry.is_dir,
      isCut: false,
    },
  }),

  cutToClipboard: (entry) => set({
    clipboardEntry: {
      sourcePath: entry.path,
      sourceName: entry.name,
      isDir: entry.is_dir,
      isCut: true,
    },
  }),

  clearClipboard: () => set({ clipboardEntry: null }),

  pasteFromClipboard: async (targetDir) => {
    const { clipboardEntry, rootPath } = get();
    if (!clipboardEntry) return;

    const destPath = `${targetDir}/${clipboardEntry.sourceName}`;
    const taskId = `copy-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const isCut = clipboardEntry.isCut;
    const sourcePath = clipboardEntry.sourcePath;

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

      // 如果是剪切操作，复制完成后删除源文件
      if (isCut) {
        // 等待复制完成后再删除
        // 由于 copyEntryAsync 是异步的，我们需要在进度完成后再删除
        // 这里使用一个简单的延迟，实际项目中应该基于进度事件
        setTimeout(async () => {
          try {
            await fileService.deleteEntry(sourcePath, true);
            // 刷新源目录
            const sourceParent = sourcePath.substring(0, sourcePath.lastIndexOf(/[\\/]/.test(sourcePath) ? (sourcePath.includes('\\') ? '\\' : '/') : '/'));
            if (sourceParent === rootPath) {
              get().loadRootEntries();
            } else if (sourceParent) {
              get().refreshNode(sourceParent);
            }
            // 清空剪贴板
            set({ clipboardEntry: null });
          } catch (err) {
            console.error('Failed to delete source after cut:', err);
          }
        }, 1000);
      }
    } catch (err) {
      set({ error: String(err) });
      throw err;
    } finally {
      // Unsubscribe from progress events
      unlisten();
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
      (window as any).__fileChangeUnlisten = unlisten;

      set({ watchInitialized: true });
      console.log('[FileTreeStore] Watcher initialized');
    } catch (err) {
      console.error('[FileTreeStore] Failed to initialize watcher:', err);
    }
  },

  cleanupWatcher: async () => {
    try {
      const unlisten = (window as any).__fileChangeUnlisten;
      if (unlisten) {
        unlisten();
        (window as any).__fileChangeUnlisten = undefined;
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

    // Add root path if it exists
    if (rootPath) {
      pathsToWatch.push(rootPath);
    }

    // Add all expanded directory paths
    for (const path of expandedNodes) {
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
    const debounceMap = (window as any).__refreshDebounceMap || new Map();
    (window as any).__refreshDebounceMap = debounceMap;

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
