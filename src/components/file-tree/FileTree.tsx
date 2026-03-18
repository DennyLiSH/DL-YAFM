import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { fileService } from '@/services/fileService';
import { TreeNode } from './TreeNode';
import type { FileEntry } from '@/types/file';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { NewFolderDialog, NewFileDialog } from '@/components/dialogs';
import { FolderOpen, RefreshCw, Search, X, GripVertical, Loader2, FolderPlus, FilePlus, ClipboardPaste } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// 列配置类型
interface ColumnConfig {
  id: string;
  label: string;
  width: string;
  visible: boolean;
}

// 默认列配置
const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'type', label: '类型', width: 'w-16', visible: true },
  { id: 'size', label: '大小', width: 'w-20', visible: true },
  { id: 'modified', label: '修改日期', width: 'w-28', visible: true },
  { id: 'created', label: '创建日期', width: 'w-28', visible: true },
];

export function FileTree() {
  const {
    rootPath,
    rootEntries,
    isLoading,
    error,
    searchResults,
    isSearching,
    clipboardEntries,
    selectedNodes,
    setRootPath,
    loadRootEntries,
    refreshNode,
    clearError,
    search,
    pasteFromClipboard,
    selectAll,
    clearSelection,
    copySelectedToClipboard,
    cutSelectedToClipboard,
    getSelectedEntries,
  } = useFileTreeStore();

  // 搜索状态
  const [searchQuery, setSearchQuery] = useState('');
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 列顺序配置
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  // 拖拽状态
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  // 根目录右键菜单对话框状态
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + A: 全选
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        if (rootPath) {
          selectAll(rootPath);
        }
      }

      // Escape: 清除选择
      if (e.key === 'Escape') {
        clearSelection();
      }

      // Delete: 删除选中项
      if (e.key === 'Delete' && selectedNodes.size > 0) {
        // 这个需要在 TreeNode 中处理，因为有对话框
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
  }, [rootPath, selectedNodes, selectAll, clearSelection, copySelectedToClipboard, cutSelectedToClipboard, getSelectedEntries]);

  useEffect(() => {
    if (rootPath) {
      loadRootEntries();
    }
  }, [rootPath, loadRootEntries]);

  const handleSelectFolder = async () => {
    try {
      const path = await fileService.selectAndGrantDirectory();
      if (path) {
        setRootPath(path);
        clearError();
      }
    } catch (err) {
      console.error('Failed to select folder:', err);
    }
  };

  // 刷新当前选中目录，如果没有选中则刷新根目录
  const handleRefresh = useCallback(() => {
    const firstSelected = selectedNodes.size > 0 ? Array.from(selectedNodes)[0] : null;
    if (firstSelected && firstSelected !== rootPath) {
      // 刷新选中的节点
      refreshNode(firstSelected);
    } else {
      // 刷新根目录
      loadRootEntries();
    }
  }, [selectedNodes, rootPath, refreshNode, loadRootEntries]);

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

    // 300ms 防抖
    searchTimeoutRef.current = setTimeout(() => {
      search(value);
    }, 300);
  }, [search]);

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

  // 显示的条目：搜索结果或根目录条目
  const displayEntries = useMemo(() => {
    if (searchQuery.trim() && searchResults.length > 0) {
      return searchResults;
    }
    if (searchQuery.trim() && !isSearching) {
      return []; // 搜索完成但无结果
    }
    return rootEntries;
  }, [searchQuery, searchResults, isSearching, rootEntries]);

  // 虚拟根节点：代表 rootPath 本身作为第一个可操作节点
  const rootNode: FileEntry | null = useMemo(() => {
    if (!rootPath) return null;
    return {
      path: rootPath,
      name: rootPath.split(/[\\/]/).pop() || rootPath,
      is_dir: true,
      size: 0,
      modified_at: null,
      created_at: null,
      is_readonly: false,
      is_hidden: false,
      extension: null,
    };
  }, [rootPath]);

  // 拖拽开始
  const handleDragStart = (e: React.DragEvent, columnId: string) => {
    e.stopPropagation();
    setDraggedColumn(columnId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', columnId);
  };

  // 拖拽经过
  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (draggedColumn && draggedColumn !== columnId) {
      setDragOverColumn(columnId);
    }
  };

  // 拖拽离开
  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    // 只有离开整个列头时才清除高亮
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!e.currentTarget.contains(relatedTarget)) {
      setDragOverColumn(null);
    }
  };

  // 拖拽结束
  const handleDragEnd = () => {
    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  // 拖拽放下
  const handleDrop = (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedColumn || draggedColumn === targetColumnId) {
      setDraggedColumn(null);
      setDragOverColumn(null);
      return;
    }

    // 重新排列列顺序
    setColumns((prev) => {
      const newColumns = [...prev];
      const draggedIndex = newColumns.findIndex((c) => c.id === draggedColumn);
      const targetIndex = newColumns.findIndex((c) => c.id === targetColumnId);

      if (draggedIndex !== -1 && targetIndex !== -1) {
        const [removed] = newColumns.splice(draggedIndex, 1);
        if (removed) {
          newColumns.splice(targetIndex, 0, removed);
        }
      }

      return newColumns;
    });

    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  // 渲染列表头
  const renderColumnHeader = (column: ColumnConfig) => (
    <div
      key={column.id}
      draggable
      onDragStart={(e) => handleDragStart(e, column.id)}
      onDragOver={(e) => handleDragOver(e, column.id)}
      onDragLeave={handleDragLeave}
      onDrop={(e) => handleDrop(e, column.id)}
      onDragEnd={handleDragEnd}
      className={cn(
        'text-xs text-muted-foreground font-medium text-right shrink-0 cursor-grab active:cursor-grabbing select-none',
        'hover:text-foreground transition-colors px-1 py-0.5 rounded',
        column.width,
        draggedColumn === column.id && 'opacity-50 cursor-grabbing',
        dragOverColumn === column.id && 'bg-accent ring-1 ring-primary'
      )}
    >
      <div className="flex items-center justify-end gap-1 pointer-events-none">
        <GripVertical className="w-3 h-3 opacity-50" />
        <span>{column.label}</span>
      </div>
    </div>
  );

  if (!rootPath) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
        <FolderOpen className="w-16 h-16 opacity-50" />
        <p className="text-lg">选择一个文件夹开始浏览</p>
        <Button onClick={handleSelectFolder}>
          选择文件夹
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with Search and Context Menu */}
      <ContextMenu>
        <ContextMenuTrigger className="flex items-center gap-2 px-3 py-2 border-b cursor-context-menu w-full">
          <FolderOpen className="w-4 h-4 shrink-0" />
          <span className="text-sm font-medium truncate max-w-[120px]" title={rootPath || ''}>
            {rootPath?.split(/[\\/]/).pop() || rootPath}
          </span>
          <div className="flex gap-1 ml-auto">
            <Button variant="ghost" size="icon" onClick={handleSelectFolder} title="切换文件夹">
              <FolderOpen className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleRefresh} title="刷新">
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          {/* Search Box */}
          <div className="relative w-40">
            {isSearching ? (
              <Loader2 className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground animate-spin" />
            ) : (
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            )}
            <Input
              placeholder="搜索..."
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
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            刷新
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => setShowNewFolderDialog(true)}>
            <FolderPlus className="w-4 h-4 mr-2" />
            新建文件夹
          </ContextMenuItem>
          <ContextMenuItem onClick={() => setShowNewFileDialog(true)}>
            <FilePlus className="w-4 h-4 mr-2" />
            新建文件
          </ContextMenuItem>
          {clipboardEntries.length > 0 && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={async () => {
                if (!rootPath) return;
                try {
                  await pasteFromClipboard(rootPath);
                  toast.success('粘贴成功');
                  loadRootEntries();
                } catch (err) {
                  toast.error(`粘贴失败: ${err}`);
                }
              }}>
                <ClipboardPaste className="w-4 h-4 mr-2" />
                粘贴 {clipboardEntries.length > 1 ? `${clipboardEntries.length} 个项目` : ''}
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {/* Root Dialogs */}
      <NewFolderDialog
        open={showNewFolderDialog}
        onOpenChange={setShowNewFolderDialog}
        parentPath={rootPath || ''}
        onSuccess={loadRootEntries}
      />
      <NewFileDialog
        open={showNewFileDialog}
        onOpenChange={setShowNewFileDialog}
        parentPath={rootPath || ''}
        onSuccess={loadRootEntries}
      />

      {/* Error */}
      {error && (
        <div className="px-4 py-2 text-sm text-destructive bg-destructive/10">
          {error}
        </div>
      )}

      {/* Column Headers */}
      <div className="flex items-center gap-1 px-2 py-1 border-b bg-muted/30">
        <span className="flex-1 text-xs text-muted-foreground font-medium">
          {selectedNodes.size > 0 ? (
            <span className="text-primary">
              已选择 {selectedNodes.size} 个项目
            </span>
          ) : (
            '名称'
          )}
        </span>
        {columns.filter(c => c.visible).map(renderColumnHeader)}
      </div>

      {/* Tree Content */}
      <ScrollArea className="flex-1">
        {isLoading && !rootNode ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            加载中...
          </div>
        ) : isSearching && displayEntries.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            搜索中...
          </div>
        ) : searchQuery && displayEntries.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            未找到匹配的文件
          </div>
        ) : searchQuery ? (
          // 搜索结果模式：显示为平铺列表（包含文件和文件夹）
          <div className="py-1">
            <div className="px-2 py-1 text-xs text-muted-foreground border-b mb-1">
              搜索结果 ({displayEntries.length} 项)
            </div>
            {displayEntries.map((entry) => (
              <TreeNode key={entry.path} entry={entry} depth={0} columns={columns} />
            ))}
          </div>
        ) : rootNode ? (
          // 正常模式：显示虚拟根节点（只显示文件夹）
          <div className="py-1">
            <TreeNode key={rootNode.path} entry={rootNode} depth={0} columns={columns} isVirtualRoot />
          </div>
        ) : null}
      </ScrollArea>
    </div>
  );
}
