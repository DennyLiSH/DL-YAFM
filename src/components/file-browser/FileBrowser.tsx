import { useState, useMemo, useEffect, useRef } from 'react';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { FileBrowserContextMenu } from './FileBrowserContextMenu';
import {
  NewFolderDialog,
  RenameDialog,
  DeleteConfirmDialog,
} from '@/components/dialogs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { FolderPlus, ClipboardPaste } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatFileSize, formatDate, getFileIcon } from '@/lib/format';
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
    selectedNodes,
    clipboardEntries,
    browseViewMode,
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
  } = useFileTreeStore();

  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Dialog states
  const [selectedEntry, setSelectedEntry] = useState<FileEntry | null>(null);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // 追踪最后选中的索引用于 Shift 范围选择
  const lastSelectedIndexRef = useRef<number | null>(null);

  // 是否有多个选中项
  const hasMultiSelection = selectedNodes.size > 1;

  // Sort entries
  const sortedEntries = useMemo(() => {
    const sorted = [...browseEntries];
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
  }, [browseEntries, sortField, sortDirection]);

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

      // Ctrl/Cmd + A: 全选当前目录
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        if (currentBrowsePath && sortedEntries.length > 0) {
          selectAll(currentBrowsePath);
          lastSelectedIndexRef.current = sortedEntries.length - 1;
        }
      }

      // Escape: 清除选择
      if (e.key === 'Escape') {
        clearSelection();
        lastSelectedIndexRef.current = null;
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
  }, [currentBrowsePath, sortedEntries, selectedNodes, selectAll, clearSelection, copySelectedToClipboard, cutSelectedToClipboard, getSelectedEntries]);

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

  if (!rootPath) {
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
        <div className="px-4 py-1.5 border-b bg-muted/30 overflow-x-auto">
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
        <div className="grid grid-cols-[1fr_80px_80px_100px] gap-2 px-4 py-2 border-b bg-muted/50 text-xs font-medium text-muted-foreground">
          <button
            className="flex items-center hover:text-foreground text-left"
            onClick={() => handleSort('name')}
          >
            名称
            <SortIcon field="name" />
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
            onClick={() => handleSort('type')}
          >
            类型
            <SortIcon field="type" />
          </button>
          <button
            className="flex items-center hover:text-foreground text-right"
            onClick={() => handleSort('modified')}
          >
            修改日期
            <SortIcon field="modified" />
          </button>
        </div>
      )}

      {/* File List */}
      <ScrollArea className="flex-1">
        <ContextMenu>
          <ContextMenuTrigger className="block min-h-full">
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
                      onOpenFolder={() => handleOpenFolder(entry)}
                      onOpenFile={() => handleOpenFile(entry)}
                      onCopy={() => handleCopy(entry)}
                      onCut={() => handleCut(entry)}
                      onClearSelection={clearSelection}
                      hasClipboard={clipboardEntries.length > 0}
                      onPaste={() => handlePaste(entry)}
                    >
                      <div
                        className={cn(
                          'flex flex-col items-center justify-center p-3 rounded-lg cursor-pointer transition-colors',
                          'hover:bg-accent',
                          isSelected && 'bg-primary/20 ring-1 ring-primary/50',
                          isSelected && hasMultiSelection && 'bg-primary/30'
                        )}
                        onClick={(e) => handleRowClick(e, entry, index)}
                        onDoubleClick={() => handleDoubleClick(entry)}
                      >
                        <span className="text-3xl mb-2">{getFileIcon(entry)}</span>
                        <span className="text-xs text-center truncate w-full" title={entry.name}>
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
                      onOpenFolder={() => handleOpenFolder(entry)}
                      onOpenFile={() => handleOpenFile(entry)}
                      onCopy={() => handleCopy(entry)}
                      onCut={() => handleCut(entry)}
                      onClearSelection={clearSelection}
                      hasClipboard={clipboardEntries.length > 0}
                      onPaste={() => handlePaste(entry)}
                    >
                      <div
                        className={cn(
                          'grid grid-cols-[1fr_80px_80px_100px] gap-2 px-4 py-1.5 text-sm hover:bg-accent cursor-pointer items-center',
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
                        {/* Size */}
                        <span className="text-xs text-muted-foreground text-right">
                          {entry.is_dir ? '-' : formatFileSize(entry.size)}
                        </span>
                        {/* Type */}
                        <span className="text-xs text-muted-foreground text-right truncate">
                          {entry.is_dir ? '文件夹' : entry.name.split('.').pop() || '-'}
                        </span>
                        {/* Modified */}
                        <span className="text-xs text-muted-foreground text-right">
                          {formatDate(entry.modified_at)}
                        </span>
                      </div>
                    </FileBrowserContextMenu>
                  );
                })}
              </div>
            )}
          </ContextMenuTrigger>
          <ContextMenuContent className="w-48">
            <ContextMenuItem onClick={handleNewFolderInCurrentPath}>
              <FolderPlus className="w-4 h-4 mr-2" />
              新建文件夹
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
        <NewFolderDialog
          open={showNewFolderDialog && !selectedEntry}
          onOpenChange={(open) => {
            setShowNewFolderDialog(open);
            if (!open) setSelectedEntry(null);
          }}
          parentPath={currentBrowsePath}
          onSuccess={handleRefreshAfterAction}
        />
      )}
    </div>
  );
}
