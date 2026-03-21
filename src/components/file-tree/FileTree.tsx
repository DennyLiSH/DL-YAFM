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
import { FolderOpen, RefreshCw, Search, X, Loader2, FolderPlus, FilePlus, ClipboardPaste } from 'lucide-react';
import { toast } from 'sonner';

// 列配置类型
interface ColumnConfig {
  id: string;
  label: string;
  width: string;
  visible: boolean;
}

// 默认列配置（空数组 = 只显示名称列）
const DEFAULT_COLUMNS: ColumnConfig[] = [];

export function FileTree() {
  const {
    rootPath,
    isSystemRoot,
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
  // 根目录右键菜单对话框状态
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + A: 全选
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        if (rootPath || isSystemRoot) {
          selectAll(rootPath || 'system-root');
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
  }, [rootPath, isSystemRoot, selectedNodes, selectAll, clearSelection, copySelectedToClipboard, cutSelectedToClipboard, getSelectedEntries]);

  useEffect(() => {
    if (rootPath || isSystemRoot) {
      loadRootEntries();
    }
  }, [rootPath, isSystemRoot, loadRootEntries]);

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
    if (firstSelected && firstSelected !== rootPath && firstSelected !== 'system-root') {
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
    // System root mode (My Computer on Windows)
    if (isSystemRoot) {
      return {
        path: 'system-root',
        name: '我的电脑',
        is_dir: true,
        size: 0,
        modified_at: null,
        created_at: null,
        is_readonly: false,
        is_hidden: false,
        extension: null,
      };
    }

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
  }, [rootPath, isSystemRoot]);

  // We always have a root now (system root or selected folder)
  return (
    <div className="flex flex-col h-full">
      {/* Header with Search and Context Menu */}
      <ContextMenu>
        <ContextMenuTrigger className="flex items-center gap-2 px-3 py-2 border-b cursor-context-menu w-full">
          <FolderOpen className="w-4 h-4 shrink-0" />
          <span className="text-sm font-medium truncate max-w-[120px]" title={isSystemRoot ? '我的电脑' : (rootPath || '')}>
            {isSystemRoot ? '我的电脑' : (rootPath?.split(/[\\/]/).pop() || rootPath)}
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
          {!isSystemRoot && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => setShowNewFolderDialog(true)}>
                <FolderPlus className="w-4 h-4 mr-2" />
                新建文件夹
              </ContextMenuItem>
              <ContextMenuItem onClick={() => setShowNewFileDialog(true)}>
                <FilePlus className="w-4 h-4 mr-2" />
                新建文件
              </ContextMenuItem>
            </>
          )}
          {clipboardEntries.length > 0 && !isSystemRoot && (
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

      {/* Column Headers - 只显示名称/选择状态 */}
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
              <TreeNode key={entry.path} entry={entry} depth={0} columns={DEFAULT_COLUMNS} />
            ))}
          </div>
        ) : rootNode ? (
          // 正常模式：显示虚拟根节点（只显示文件夹）
          <div className="py-1">
            <TreeNode key={rootNode.path} entry={rootNode} depth={0} columns={DEFAULT_COLUMNS} isVirtualRoot />
          </div>
        ) : null}
      </ScrollArea>
    </div>
  );
}
