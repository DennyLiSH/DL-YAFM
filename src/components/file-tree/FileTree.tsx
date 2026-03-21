import { useEffect, useState, useMemo, useCallback } from 'react';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { fileService } from '@/services/fileService';
import { TreeNode } from './TreeNode';
import type { FileEntry } from '@/types/file';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { NewFolderDialog, NewFileDialog } from '@/components/dialogs';
import { FolderOpen, RefreshCw, FolderPlus, FilePlus, ClipboardPaste } from 'lucide-react';
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
    isLoading,
    error,
    clipboardEntries,
    selectedNodes,
    setRootPath,
    loadRootEntries,
    refreshNode,
    clearError,
    pasteFromClipboard,
    selectAll,
    clearSelection,
    copySelectedToClipboard,
    cutSelectedToClipboard,
    getSelectedEntries,
  } = useFileTreeStore();

  // 根目录右键菜单对话框状态
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;

      // 忽略输入框中的键盘事件
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      // 检查是否在 FileTree 组件内
      const isInFileTree = target.closest('[data-file-tree]');
      if (!isInFileTree) return;

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
    <div className="flex flex-col h-full" data-file-tree>
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
        ) : rootNode ? (
          <div className="py-1">
            <TreeNode key={rootNode.path} entry={rootNode} depth={0} columns={DEFAULT_COLUMNS} isVirtualRoot />
          </div>
        ) : null}
      </ScrollArea>
    </div>
  );
}
