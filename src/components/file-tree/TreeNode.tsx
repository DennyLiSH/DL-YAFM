import { useEffect, useState } from 'react';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { useBookmarkStore } from '@/stores/bookmarkStore';
import type { FileEntry } from '@/types/file';
import { formatFileSize, formatDate, getFileIcon } from '@/lib/format';
import { getErrorMessage } from '@/lib/error';
import { cn } from '@/lib/utils';
import { TreeNodeContextMenu } from './TreeNodeContextMenu';
import {
  NewFolderDialog,
  NewFileDialog,
  RenameDialog,
  DeleteConfirmDialog,
  OverwriteConfirmDialog,
} from '@/components/dialogs';
import { fileService } from '@/services/fileService';
import { toast } from 'sonner';

interface TreeNodeProps {
  entry: FileEntry;
  depth: number;
}

export function TreeNode({ entry, depth }: TreeNodeProps) {
  const {
    expandedNodes,
    selectedNode,
    nodeCache,
    rootPath,
    clipboardEntry,
    toggleNode,
    selectNode,
    loadNodeChildren,
    refreshNode,
    loadRootEntries,
    setBrowsePath,
    loadFilePreview,
    clearPreview,
    copyToClipboard,
    pasteFromClipboard,
  } = useFileTreeStore();

  const { addBookmark } = useBookmarkStore();

  const isExpanded = expandedNodes.has(entry.path);
  const isSelected = selectedNode === entry.path;
  const nodeState = nodeCache.get(entry.path);
  const children = nodeState?.children || [];
  const isLoading = nodeState?.isLoading;

  // Dialog states
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showOverwriteDialog, setShowOverwriteDialog] = useState(false);

  useEffect(() => {
    // Load children when node is expanded for the first time
    if (isExpanded && entry.is_dir && !nodeState?.isLoaded && !isLoading) {
      loadNodeChildren(entry.path);
    }
  }, [isExpanded, entry.is_dir, entry.path, nodeState?.isLoaded, isLoading, loadNodeChildren]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectNode(entry.path);

    if (entry.is_dir) {
      toggleNode(entry.path);
      // Sync browse path when clicking on a folder
      setBrowsePath(entry.path);
      // Clear preview when selecting a folder
      clearPreview();
    } else {
      // Load file preview when selecting a file
      loadFilePreview(entry);
    }
  };

  const handleRefresh = () => {
    if (entry.path === rootPath) {
      loadRootEntries();
    } else {
      refreshNode(entry.path);
    }
  };

  // 获取父路径的辅助函数
  const getParentPath = (path: string) => {
    const parts = path.split(/[\\/]/);
    parts.pop();
    return parts.join(path.includes('\\') ? '\\' : '/');
  };

  // 删除后刷新父节点（而不是被删除的节点）
  const handleRefreshAfterDelete = () => {
    const parentPath = getParentPath(entry.path);
    if (!parentPath || parentPath === rootPath) {
      loadRootEntries();
    } else {
      refreshNode(parentPath);
    }
  };

  const handleAddBookmark = () => {
    addBookmark(entry.name, entry.path);
  };

  const handleCopy = () => {
    copyToClipboard(entry);
    toast.success('已复制到剪贴板');
  };

  const handlePaste = async () => {
    if (!clipboardEntry) return;

    // 检查目标路径是否已存在
    const destPath = `${entry.path}/${clipboardEntry.sourceName}`.replace(/\\/g, '/');
    const exists = await fileService.checkPathExists(destPath);

    if (exists) {
      // 显示确认对话框
      setShowOverwriteDialog(true);
    } else {
      // 直接粘贴
      await doPaste();
    }
  };

  // 执行实际的粘贴操作
  const doPaste = async () => {
    try {
      await pasteFromClipboard(entry.path);
      toast.success('粘贴成功');
      handleRefresh();
    } catch (err) {
      toast.error(`粘贴失败: ${getErrorMessage(err)}`);
    }
  };

  // 替换：强制覆盖
  const handleReplace = async () => {
    await doPaste();
  };

  // 跳过：取消操作
  const handleSkip = () => {
    toast.info('已跳过');
  };

  const icon = getFileIcon(entry);

  // Node content to be wrapped by context menu
  const nodeContent = (
    <div
      className={cn(
        'flex items-center gap-1 px-2 py-1 cursor-pointer rounded hover:bg-accent',
        isSelected && 'bg-accent',
      )}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
      onClick={handleClick}
    >
      {/* Expand/Collapse Arrow */}
      {entry.is_dir && (
        <span className={cn('w-4 h-4 flex items-center justify-center text-xs transition-transform', isExpanded && 'rotate-90')}>
          ▶
        </span>
      )}
      {!entry.is_dir && <span className="w-4" />}

      {/* Icon */}
      <span className="text-base">{icon}</span>

      {/* Name */}
      <span className="flex-1 truncate text-sm">{entry.name}</span>

      {/* File Type */}
      <span className="text-xs text-muted-foreground w-16 text-right shrink-0">
        {entry.is_dir ? '文件夹' : entry.extension || '-'}
      </span>

      {/* Size (for files) */}
      {!entry.is_dir && (
        <span className="text-xs text-muted-foreground w-20 text-right shrink-0">
          {formatFileSize(entry.size)}
        </span>
      )}
      {entry.is_dir && <span className="w-20" />}

      {/* Modified date */}
      <span className="text-xs text-muted-foreground w-28 text-right shrink-0 hidden md:block">
        {formatDate(entry.modified_at)}
      </span>

      {/* Created date */}
      <span className="text-xs text-muted-foreground w-28 text-right shrink-0 hidden lg:block">
        {formatDate(entry.created_at)}
      </span>
    </div>
  );

  return (
    <div className="select-none">
      <TreeNodeContextMenu
        entry={entry}
        onRefresh={handleRefresh}
        onRename={() => setShowRenameDialog(true)}
        onDelete={() => setShowDeleteDialog(true)}
        onNewFolder={() => setShowNewFolderDialog(true)}
        onNewFile={() => setShowNewFileDialog(true)}
        onAddBookmark={handleAddBookmark}
        onCopy={handleCopy}
        onPaste={handlePaste}
        hasClipboard={!!clipboardEntry}
      >
        {nodeContent}
      </TreeNodeContextMenu>

      {/* Children */}
      {isExpanded && entry.is_dir && (
        <div>
          {isLoading ? (
            <div className="px-2 py-1 text-sm text-muted-foreground" style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}>
              加载中...
            </div>
          ) : (
            children.map((child) => (
              <TreeNode key={child.path} entry={child} depth={depth + 1} />
            ))
          )}
        </div>
      )}

      {/* Dialogs */}
      <NewFolderDialog
        open={showNewFolderDialog}
        onOpenChange={setShowNewFolderDialog}
        parentPath={entry.path}
        onSuccess={handleRefresh}
      />
      <NewFileDialog
        open={showNewFileDialog}
        onOpenChange={setShowNewFileDialog}
        parentPath={entry.path}
        onSuccess={handleRefresh}
      />
      <RenameDialog
        open={showRenameDialog}
        onOpenChange={setShowRenameDialog}
        entryPath={entry.path}
        currentName={entry.name}
        onSuccess={handleRefresh}
      />
      <DeleteConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        entryPath={entry.path}
        entryName={entry.name}
        isDir={entry.is_dir}
        onSuccess={handleRefreshAfterDelete}
      />
      <OverwriteConfirmDialog
        open={showOverwriteDialog}
        onOpenChange={setShowOverwriteDialog}
        fileName={clipboardEntry?.sourceName || ''}
        onReplace={handleReplace}
        onSkip={handleSkip}
      />
    </div>
  );
}
