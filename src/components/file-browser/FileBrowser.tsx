import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { useEditorStore } from '@/stores/editorStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { FileBrowserContextMenu } from './FileBrowserContextMenu';
import {
  NewFolderDialog,
  NewFileDialog,
  RenameDialog,
  DeleteConfirmDialog,
} from '@/components/dialogs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMarqueeSelection } from '@/hooks/useMarqueeSelection';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import { FolderPlus, ClipboardPaste, FilePlus, Code2, Search, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDate, formatFileSize, getFileIcon } from '@/lib/format';
import { getErrorMessage } from '@/lib/error';
import { cn } from '@/lib/utils';
import {
  ChevronRight,
  ArrowUp,
  FolderOpen,
  RefreshCw,
  ArrowUpNarrowWide,
  ArrowDownWideNarrow,
  LayoutGrid,
  List,
} from 'lucide-react';
import type { FileEntry } from '@/types/file';
import { fileService } from '@/services/fileService';
import { toast } from 'sonner';

type SortField = 'name' | 'size' | 'type' | 'modified';
type SortDirection = 'asc' | 'desc';

export function FileBrowser() {
  const {
    currentBrowsePath,
    browseEntries,
    browseHistory,
    isLoadingBrowse,
    rootPath,
    isSystemRoot,
    selectedNodes,
    clipboardEntries,
    browseViewMode,
    searchResults,
    isSearching,
    setBrowsePath,
    goBack,
    goToParent,
    refreshBrowse,
    loadFilePreview,
    toggleNodeSelection,
    clearSelection,
    selectAll,
    getSelectedEntries,
    copySelectedToClipboard,
    cutSelectedToClipboard,
    pasteFromClipboard,
    setBrowseViewMode,
    search,
  } = useFileTreeStore();

  const { searchDebounceMs } = useSettingsStore();

  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Dialog states
  const [selectedEntry, setSelectedEntry] = useState<FileEntry | null>(null);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Editor state from global store (singleton cache)
  const availableEditors = useEditorStore((state) => state.editors);

  // 防抖搜索
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);

    // 清除之前的定时器
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // 如果搜索词为空，不执行搜索
    if (!value.trim()) {
      return;
    }

    // 使用设置的防抖时间
    searchTimeoutRef.current = setTimeout(() => {
      search(value);
    }, searchDebounceMs);
  }, [search, searchDebounceMs]);

  // 清空搜索
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
  }, []);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // 追踪最后选中的索引用于 Shift 范围选择
  const lastSelectedIndexRef = useRef<number | null>(null);

  // 框选相关 refs
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefsRef = useRef<Map<string, HTMLElement | null>>(new Map());

  // 注册文件项的 ref
  const registerItemRef = useCallback((path: string, el: HTMLElement | null) => {
    if (el) {
      itemRefsRef.current.set(path, el);
    } else {
      itemRefsRef.current.delete(path);
    }
  }, []);

  // 是否有多个选中项
  const hasMultiSelection = selectedNodes.size > 1;

  // 显示的条目：搜索结果或当前目录
  const displayEntries = useMemo(() => {
    if (searchQuery.trim() && searchResults.length > 0) {
      return searchResults;
    }
    if (searchQuery.trim() && !isSearching) {
      return []; // 无结果
    }
    return browseEntries;
  }, [searchQuery, searchResults, isSearching, browseEntries]);

  // Sort entries
  const sortedEntries = useMemo(() => {
    const sorted = [...displayEntries];
    sorted.sort((a, b) => {
      // Always put folders first
      if (a.is_dir !== b.is_dir) {
        return a.is_dir ? -1 : 1;
      }

      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name, 'zh-CN');
          break;
        case 'size':
          comparison = (a.size || 0) - (b.size || 0);
          break;
        case 'type':
          comparison = (a.is_dir ? '文件夹' : a.name.split('.').pop() || '').localeCompare(
            b.is_dir ? '文件夹' : b.name.split('.').pop() || ''
          );
          break;
        case 'modified':
          comparison = new Date(a.modified_at || 0).getTime() - new Date(b.modified_at || 0).getTime();
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [displayEntries, sortField, sortDirection]);

  // 获取当前选中项的索引
  const getCurrentSelectedIndex = useCallback((): number => {
    if (selectedNodes.size === 0) return -1;
    const firstSelected = Array.from(selectedNodes)[0];
    return sortedEntries.findIndex(e => e.path === firstSelected);
  }, [selectedNodes, sortedEntries]);

  // 单选某个条目并滚动到可见区域
  const selectSingleItem = useCallback((entry: FileEntry, index: number) => {
    useFileTreeStore.setState({ selectedNodes: new Set([entry.path]) });
    lastSelectedIndexRef.current = index;
    if (!entry.is_dir) {
      loadFilePreview(entry);
    }
    // 滚动到可见区域
    const element = itemRefsRef.current.get(entry.path);
    element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [loadFilePreview]);

  // 处理框选变化
  const handleMarqueeSelectionChange = useCallback((selectedPaths: string[], isAppend: boolean) => {
    if (isAppend) {
      // Ctrl 模式：追加选择
      const newSelection = new Set(selectedNodes);
      selectedPaths.forEach(path => {
        if (newSelection.has(path)) {
          newSelection.delete(path);
        } else {
          newSelection.add(path);
        }
      });
      useFileTreeStore.setState({ selectedNodes: newSelection });
    } else {
      // 替换选择
      useFileTreeStore.setState({ selectedNodes: new Set(selectedPaths) });
    }
  }, [selectedNodes]);

  // 使用框选 Hook
  const { isSelecting, marqueeRect, handleMouseDown } = useMarqueeSelection({
    containerRef,
    itemRefs: itemRefsRef.current,
    items: sortedEntries,
    getItemId: (entry) => entry.path,
    onSelectionChange: handleMarqueeSelectionChange,
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInBrowser = target.closest('[data-file-browser]');
      if (!isInBrowser) return;

      // 忽略输入框中的键盘事件
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      // 方向键: 移动选择
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const currentIndex = getCurrentSelectedIndex();
        const newIndex = e.key === 'ArrowDown'
          ? Math.min(currentIndex + 1, sortedEntries.length - 1)
          : Math.max(currentIndex - 1, 0);

        if (sortedEntries.length > 0 && (currentIndex === -1 || newIndex !== currentIndex)) {
          const entry = sortedEntries[newIndex];
          if (entry) selectSingleItem(entry, newIndex);
        }
      }

      // Grid 视图左右移动
      if (browseViewMode === 'grid' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        const currentIndex = getCurrentSelectedIndex();

        const newIndex = e.key === 'ArrowRight'
          ? Math.min(currentIndex + 1, sortedEntries.length - 1)
          : Math.max(currentIndex - 1, 0);

        if (sortedEntries.length > 0 && (currentIndex === -1 || newIndex !== currentIndex)) {
          const entry = sortedEntries[newIndex];
          if (entry) selectSingleItem(entry, newIndex);
        }
      }

      // HOME: 跳转到第一个
      if (e.key === 'Home') {
        e.preventDefault();
        const entry = sortedEntries[0];
        if (entry) selectSingleItem(entry, 0);
      }

      // END: 跳转到最后一个
      if (e.key === 'End') {
        e.preventDefault();
        const lastIndex = sortedEntries.length - 1;
        const entry = sortedEntries[lastIndex];
        if (entry) selectSingleItem(entry, lastIndex);
      }

      // DELETE: 删除选中项
      if (e.key === 'Delete' && selectedNodes.size > 0) {
        e.preventDefault();
        const entries = getSelectedEntries();
        const firstEntry = entries[0];
        if (firstEntry) {
          setSelectedEntry(firstEntry);
          setShowDeleteDialog(true);
        }
      }

      // F2: 重命名
      if (e.key === 'F2' && selectedNodes.size === 1) {
        e.preventDefault();
        const entries = getSelectedEntries();
        const firstEntry = entries[0];
        if (firstEntry) {
          setSelectedEntry(firstEntry);
          setShowRenameDialog(true);
        }
      }

      // Ctrl/Cmd + A: 全选当前目录
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        if (currentBrowsePath && sortedEntries.length > 0) {
          selectAll(currentBrowsePath);
          lastSelectedIndexRef.current = sortedEntries.length - 1;
        }
      }

      // Escape: 清除搜索或选择
      if (e.key === 'Escape') {
        if (searchQuery) {
          handleClearSearch();
        } else {
          clearSelection();
          lastSelectedIndexRef.current = null;
        }
      }

      // Ctrl/Cmd + C: 复制选中项
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedNodes.size > 0) {
        const entries = getSelectedEntries();
        if (entries.length > 0) {
          copySelectedToClipboard(entries);
          toast.success(`已复制 ${entries.length} 个项目到剪贴板`);
        }
      }

      // Ctrl/Cmd + X: 剪切选中项
      if ((e.ctrlKey || e.metaKey) && e.key === 'x' && selectedNodes.size > 0) {
        const entries = getSelectedEntries();
        if (entries.length > 0) {
          cutSelectedToClipboard(entries);
          toast.success(`已剪切 ${entries.length} 个项目到剪贴板`);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentBrowsePath, sortedEntries, selectedNodes, selectAll, clearSelection, copySelectedToClipboard, cutSelectedToClipboard, getSelectedEntries, getCurrentSelectedIndex, selectSingleItem, browseViewMode, searchQuery, handleClearSearch]);

  // 切换目录时清除选择
  useEffect(() => {
    clearSelection();
    lastSelectedIndexRef.current = null;
  }, [currentBrowsePath]);

  // 行点击处理
  const handleRowClick = (e: React.MouseEvent, entry: FileEntry, index: number) => {
    e.stopPropagation();

    const isCtrlPressed = e.ctrlKey || e.metaKey;
    const isShiftPressed = e.shiftKey;

    if (isShiftPressed && lastSelectedIndexRef.current !== null) {
      // Shift+点击：范围选择（同目录）
      const [from, to] = lastSelectedIndexRef.current < index
        ? [lastSelectedIndexRef.current, index]
        : [index, lastSelectedIndexRef.current];

      const newSelection = new Set<string>();
      for (let i = from; i <= to; i++) {
        const sibling = sortedEntries[i];
        if (sibling) {
          newSelection.add(sibling.path);
        }
      }
      useFileTreeStore.setState({ selectedNodes: newSelection, lastSelectedNode: entry.path });
      lastSelectedIndexRef.current = index;
    } else if (isCtrlPressed) {
      // Ctrl+点击：切换选择
      toggleNodeSelection(entry.path, 'ctrl');
      lastSelectedIndexRef.current = index;
    } else {
      // 普通点击：单选
      toggleNodeSelection(entry.path, 'none');
      lastSelectedIndexRef.current = index;

      // 加载文件预览（仅单选时）
      if (!entry.is_dir) {
        loadFilePreview(entry);
      }
    }
  };

  const handleDoubleClick = async (entry: FileEntry) => {
    if (entry.is_dir) {
      setBrowsePath(entry.path);
    } else {
      // 文件：用系统默认程序打开
      try {
        await fileService.openWithSystemApp(entry.path);
      } catch (err) {
        toast.error(`打开失败: ${getErrorMessage(err)}`);
      }
    }
  };

  const handleOpenFolder = (entry: FileEntry) => {
    if (entry.is_dir) {
      setBrowsePath(entry.path);
    }
  };

  const handleOpenFile = async (entry: FileEntry) => {
    try {
      await fileService.openWithSystemApp(entry.path);
    } catch (err) {
      toast.error(`打开失败: ${getErrorMessage(err)}`);
    }
  };

  // Open with specific editor
  const handleOpenWithEditor = async (path: string, editorId: string) => {
    try {
      await fileService.openWithEditor(path, editorId);
    } catch (err) {
      toast.error(`打开失败: ${getErrorMessage(err)}`);
    }
  };

  const handleRefresh = () => {
    refreshBrowse();
  };

  const handleRefreshAfterAction = () => {
    refreshBrowse();
    setSelectedEntry(null);
  };

  // 复制处理
  const handleCopy = (entry: FileEntry) => {
    if (hasMultiSelection && selectedNodes.has(entry.path)) {
      const entries = getSelectedEntries();
      copySelectedToClipboard(entries);
      toast.success(`已复制 ${entries.length} 个项目到剪贴板`);
    } else {
      copySelectedToClipboard([entry]);
      toast.success('已复制到剪贴板');
    }
  };

  // 剪切处理
  const handleCut = (entry: FileEntry) => {
    if (hasMultiSelection && selectedNodes.has(entry.path)) {
      const entries = getSelectedEntries();
      cutSelectedToClipboard(entries);
      toast.success(`已剪切 ${entries.length} 个项目到剪贴板`);
    } else {
      cutSelectedToClipboard([entry]);
      toast.success('已剪切到剪贴板');
    }
  };

  // 粘贴处理
  const handlePaste = async (entry: FileEntry) => {
    if (entry.is_dir && clipboardEntries.length > 0) {
      try {
        await pasteFromClipboard(entry.path);
        toast.success('粘贴完成');
        refreshBrowse();
      } catch (err) {
        toast.error(`粘贴失败: ${getErrorMessage(err)}`);
      }
    }
  };

  // 粘贴到当前文件夹
  const handlePasteToCurrentFolder = async () => {
    if (currentBrowsePath && clipboardEntries.length > 0) {
      try {
        await pasteFromClipboard(currentBrowsePath);
        toast.success('粘贴完成');
        refreshBrowse();
      } catch (err) {
        toast.error(`粘贴失败: ${getErrorMessage(err)}`);
      }
    }
  };

  // 在空白处新建文件夹
  const handleNewFolderInCurrentPath = () => {
    setSelectedEntry(null);
    setShowNewFolderDialog(true);
  };

  // 在空白处新建文件
  const handleNewFileInCurrentPath = () => {
    setSelectedEntry(null);
    setShowNewFileDialog(true);
  };

  // Breadcrumb segments
  const pathSegments = useMemo(() => {
    if (!currentBrowsePath) return [];
    const parts = currentBrowsePath.split(/[\\/]/).filter(Boolean);
    let currentPath = currentBrowsePath.includes('\\') ? '' : '/';

    return parts.map((part, index) => {
      if (currentBrowsePath.includes('\\')) {
        currentPath = index === 0 ? part : `${currentPath}\\${part}`;
      } else {
        currentPath = `${currentPath}${part}`;
      }
      return { name: part, path: currentPath };
    });
  }, [currentBrowsePath]);

  // Render Sort Icon
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ArrowUpNarrowWide className="w-3 h-3 ml-1" />
    ) : (
      <ArrowDownWideNarrow className="w-3 h-3 ml-1" />
    );
  };

  if (!rootPath && !isSystemRoot) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-2 border-b">
          <h2 className="text-sm font-medium">文件浏览</h2>
        </div>
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          请先选择文件夹
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-file-browser>
      {/* Header */}
      <div className="px-4 py-2 border-b flex items-center justify-between">
        <h2 className="text-sm font-medium">文件浏览</h2>
        <div className="flex gap-1 items-center">
          {hasMultiSelection && (
            <span className="text-xs text-muted-foreground mr-2">
              已选择 {selectedNodes.size} 个项目
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={goBack}
            disabled={browseHistory.length === 0}
            title="返回"
          >
            <ArrowUp className="w-4 h-4 rotate-[-90deg]" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={goToParent}
            disabled={!currentBrowsePath || currentBrowsePath === rootPath}
            title="上级目录"
          >
            <ArrowUp className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoadingBrowse}
            title="刷新"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingBrowse ? 'animate-spin' : ''}`} />
          </Button>
          {/* Search Box */}
          <div className="relative w-40">
            {isSearching ? (
              <Loader2 className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground animate-spin" />
            ) : (
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            )}
            <Input
              placeholder="搜索当前目录..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-6 pr-6 h-7 text-xs"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0 top-1/2 -translate-y-1/2 w-6 h-6"
                onClick={handleClearSearch}
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
          {/* 视图切换 */}
          <div className="flex border-l pl-1 ml-1">
            <Button
              variant={browseViewMode === 'grid' ? 'outline' : 'ghost'}
              size="icon"
              onClick={() => setBrowseViewMode('grid')}
              title="图标视图"
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button
              variant={browseViewMode === 'list' ? 'outline' : 'ghost'}
              size="icon"
              onClick={() => setBrowseViewMode('list')}
              title="列表视图"
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Breadcrumb */}
      {currentBrowsePath && (
        <div className="px-4 min-h-[36px] flex items-center border-b bg-muted/30 overflow-x-auto">
          <div className="flex items-center gap-1 text-xs whitespace-nowrap">
            {pathSegments.map((segment, index) => (
              <span key={segment.path} className="flex items-center">
                {index > 0 && <ChevronRight className="w-3 h-3 mx-1 text-muted-foreground" />}
                <button
                  className="hover:underline truncate max-w-[100px]"
                  onClick={() => setBrowsePath(segment.path)}
                  title={segment.path}
                >
                  {segment.name}
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Table Header - 仅列表视图显示 */}
      {browseViewMode === 'list' && (
        <div className="grid grid-cols-[1fr_60px_70px_100px_100px] gap-2 px-4 py-2 border-b bg-muted/50 text-xs font-medium text-muted-foreground">
          <button
            className="flex items-center hover:text-foreground text-left"
            onClick={() => handleSort('name')}
          >
            名称
            <SortIcon field="name" />
          </button>
          <button
            className="flex items-center hover:text-foreground text-left"
            onClick={() => handleSort('type')}
          >
            类型
            <SortIcon field="type" />
          </button>
          <button
            className="flex items-center hover:text-foreground text-right"
            onClick={() => handleSort('size')}
          >
            大小
            <SortIcon field="size" />
          </button>
          <button
            className="flex items-center hover:text-foreground text-right"
            onClick={() => handleSort('modified')}
          >
            修改日期
            <SortIcon field="modified" />
          </button>
          <span className="text-right">创建日期</span>
        </div>
      )}

      {/* File List */}
      <ScrollArea className="flex-1">
        <ContextMenu>
          <ContextMenuTrigger className="block min-h-full" onMouseDown={handleMouseDown}>
            <div
              ref={containerRef}
              className="relative h-full min-h-full"
            >
              {isLoadingBrowse && browseEntries.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                加载中...
              </div>
            ) : !currentBrowsePath ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <FolderOpen className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-sm">点击文件树中的文件夹开始浏览</p>
              </div>
            ) : browseEntries.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                空文件夹
              </div>
            ) : browseViewMode === 'grid' ? (
              /* Grid 视图 */
              <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2 p-2">
                {sortedEntries.map((entry, index) => {
                  const isSelected = selectedNodes.has(entry.path);
                  const selectedCount = hasMultiSelection && isSelected ? selectedNodes.size : 1;

                  return (
                    <FileBrowserContextMenu
                      key={entry.path}
                      entry={entry}
                      selectedCount={selectedCount}
                      onRefresh={handleRefreshAfterAction}
                      onRename={() => {
                        setSelectedEntry(entry);
                        setShowRenameDialog(true);
                      }}
                      onDelete={() => {
                        setSelectedEntry(entry);
                        setShowDeleteDialog(true);
                      }}
                      onNewFolder={() => {
                        setSelectedEntry(entry);
                        setShowNewFolderDialog(true);
                      }}
                      onNewFile={() => {
                        setSelectedEntry(entry);
                        setShowNewFileDialog(true);
                      }}
                      onOpenFolder={() => handleOpenFolder(entry)}
                      onOpenFile={() => handleOpenFile(entry)}
                      onCopy={() => handleCopy(entry)}
                      onCut={() => handleCut(entry)}
                      onClearSelection={clearSelection}
                      hasClipboard={clipboardEntries.length > 0}
                      onPaste={() => handlePaste(entry)}
                      availableEditors={availableEditors}
                      onOpenWithEditor={handleOpenWithEditor}
                    >
                      <div
                        ref={(el) => registerItemRef(entry.path, el)}
                        data-file-item
                        className={cn(
                          'flex flex-col items-center justify-center p-3 rounded-lg cursor-pointer transition-colors min-h-[110px]',
                          'hover:bg-accent',
                          isSelected && 'bg-primary/20 ring-1 ring-primary/50',
                          isSelected && hasMultiSelection && 'bg-primary/30'
                        )}
                        onClick={(e) => handleRowClick(e, entry, index)}
                        onDoubleClick={() => handleDoubleClick(entry)}
                      >
                        <span className="text-3xl mb-2">{getFileIcon(entry)}</span>
                        <span className="text-xs text-center line-clamp-3 w-full" title={entry.name}>
                          {entry.name}
                        </span>
                      </div>
                    </FileBrowserContextMenu>
                  );
                })}
              </div>
            ) : (
              /* List 视图 */
              <div className="divide-y">
                {sortedEntries.map((entry, index) => {
                  const isSelected = selectedNodes.has(entry.path);
                  const selectedCount = hasMultiSelection && isSelected ? selectedNodes.size : 1;

                  return (
                    <FileBrowserContextMenu
                      key={entry.path}
                      entry={entry}
                      selectedCount={selectedCount}
                      onRefresh={handleRefreshAfterAction}
                      onRename={() => {
                        setSelectedEntry(entry);
                        setShowRenameDialog(true);
                      }}
                      onDelete={() => {
                        setSelectedEntry(entry);
                        setShowDeleteDialog(true);
                      }}
                      onNewFolder={() => {
                        setSelectedEntry(entry);
                        setShowNewFolderDialog(true);
                      }}
                      onNewFile={() => {
                        setSelectedEntry(entry);
                        setShowNewFileDialog(true);
                      }}
                      onOpenFolder={() => handleOpenFolder(entry)}
                      onOpenFile={() => handleOpenFile(entry)}
                      onCopy={() => handleCopy(entry)}
                      onCut={() => handleCut(entry)}
                      onClearSelection={clearSelection}
                      hasClipboard={clipboardEntries.length > 0}
                      onPaste={() => handlePaste(entry)}
                      availableEditors={availableEditors}
                      onOpenWithEditor={handleOpenWithEditor}
                    >
                      <div
                        ref={(el) => registerItemRef(entry.path, el)}
                        data-file-item
                        className={cn(
                          'grid grid-cols-[1fr_60px_70px_100px_100px] gap-2 px-4 py-1.5 text-sm hover:bg-accent cursor-pointer items-center',
                          isSelected && 'bg-primary/20 ring-1 ring-primary/50',
                          isSelected && hasMultiSelection && 'bg-primary/30'
                        )}
                        onClick={(e) => handleRowClick(e, entry, index)}
                        onDoubleClick={() => handleDoubleClick(entry)}
                      >
                        {/* Name */}
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-base flex-shrink-0">{getFileIcon(entry)}</span>
                          <span className="truncate">{entry.name}</span>
                        </div>
                        {/* Type */}
                        <span className="text-xs text-muted-foreground text-left">
                          {entry.is_dir ? '' : (entry.extension || '-')}
                        </span>
                        {/* Size */}
                        <span className="text-xs text-muted-foreground text-right">
                          {entry.is_dir ? '' : formatFileSize(entry.size)}
                        </span>
                        {/* Modified */}
                        <span className="text-xs text-muted-foreground text-right">
                          {formatDate(entry.modified_at)}
                        </span>
                        {/* Created */}
                        <span className="text-xs text-muted-foreground text-right">
                          {formatDate(entry.created_at)}
                        </span>
                      </div>
                    </FileBrowserContextMenu>
                  );
                })}
              </div>
            )}

              {/* 框选矩形 */}
              {isSelecting && marqueeRect && (
                <div
                  className="absolute pointer-events-none border border-primary/50 bg-primary/10"
                  style={{
                    left: marqueeRect.left,
                    top: marqueeRect.top,
                    width: marqueeRect.width,
                    height: marqueeRect.height,
                  }}
                />
              )}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-48">
            {availableEditors.length > 0 && (
              <>
                <ContextMenuSub>
                  <ContextMenuSubTrigger>
                    <Code2 className="w-4 h-4 mr-2" />
                    用编辑器打开
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent>
                    {availableEditors.map(editor => (
                      <ContextMenuItem
                        key={editor.id}
                        onClick={() => handleOpenWithEditor(currentBrowsePath || '', editor.id)}
                      >
                        {editor.name}
                      </ContextMenuItem>
                    ))}
                  </ContextMenuSubContent>
                </ContextMenuSub>
                <ContextMenuSeparator />
              </>
            )}
            <ContextMenuItem onClick={handleNewFolderInCurrentPath}>
              <FolderPlus className="w-4 h-4 mr-2" />
              新建文件夹
            </ContextMenuItem>
            <ContextMenuItem onClick={handleNewFileInCurrentPath}>
              <FilePlus className="w-4 h-4 mr-2" />
              新建文件
            </ContextMenuItem>
            {clipboardEntries.length > 0 && (
              <ContextMenuItem onClick={handlePasteToCurrentFolder}>
                <ClipboardPaste className="w-4 h-4 mr-2" />
                粘贴
              </ContextMenuItem>
            )}
          </ContextMenuContent>
        </ContextMenu>
      </ScrollArea>

      {/* Dialogs */}
      {selectedEntry && (
        <>
          <NewFolderDialog
            open={showNewFolderDialog}
            onOpenChange={setShowNewFolderDialog}
            parentPath={selectedEntry.is_dir ? selectedEntry.path : currentBrowsePath || selectedEntry.path}
            onSuccess={handleRefreshAfterAction}
          />
          <NewFileDialog
            open={showNewFileDialog}
            onOpenChange={setShowNewFileDialog}
            parentPath={selectedEntry.is_dir ? selectedEntry.path : currentBrowsePath || selectedEntry.path}
            onSuccess={handleRefreshAfterAction}
          />
          <RenameDialog
            open={showRenameDialog}
            onOpenChange={setShowRenameDialog}
            entryPath={selectedEntry.path}
            currentName={selectedEntry.name}
            onSuccess={handleRefreshAfterAction}
          />
          <DeleteConfirmDialog
            open={showDeleteDialog}
            onOpenChange={setShowDeleteDialog}
            entries={hasMultiSelection && selectedNodes.has(selectedEntry.path)
              ? getSelectedEntries()
              : [selectedEntry]}
            onSuccess={() => {
              handleRefreshAfterAction();
              clearSelection();
            }}
          />
        </>
      )}

      {/* New folder dialog for empty area context menu */}
      {currentBrowsePath && (
        <>
          <NewFolderDialog
            open={showNewFolderDialog && !selectedEntry}
            onOpenChange={(open) => {
              setShowNewFolderDialog(open);
              if (!open) setSelectedEntry(null);
            }}
            parentPath={currentBrowsePath}
            onSuccess={handleRefreshAfterAction}
          />
          <NewFileDialog
            open={showNewFileDialog && !selectedEntry}
            onOpenChange={(open) => {
              setShowNewFileDialog(open);
              if (!open) setSelectedEntry(null);
            }}
            parentPath={currentBrowsePath}
            onSuccess={handleRefreshAfterAction}
          />
        </>
      )}
    </div>
  );
}
