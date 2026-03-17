import { useEffect, useState, useRef } from 'react';
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

// 列配置类型
interface ColumnConfig {
  id: string;
  label: string;
  width: string;
  visible: boolean;
}

interface TreeNodeProps {
  entry: FileEntry;
  depth: number;
  columns?: ColumnConfig[];
}

// 默认列配置
const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'type', label: '类型', width: 'w-16', visible: true },
  { id: 'size', label: '大小', width: 'w-20', visible: true },
  { id: 'modified', label: '修改日期', width: 'w-28', visible: true },
  { id: 'created', label: '创建日期', width: 'w-28', visible: true },
];

export function TreeNode({ entry, depth, columns = DEFAULT_COLUMNS }: TreeNodeProps) {
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
    cutToClipboard,
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

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const handleCut = () => {
    cutToClipboard(entry);
    toast.success('已剪切到剪贴板');
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

  // ====== Drag and Drop Handlers ======

  // 拖拽开始
  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', entry.path);
    e.dataTransfer.setData('application/json', JSON.stringify({
      path: entry.path,
      name: entry.name,
      isDir: entry.is_dir
    }));
  };

  // 拖拽结束
  const handleDragEnd = () => {
    setIsDragging(false);
    setIsDragOver(false);
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current);
      dragTimeoutRef.current = null;
    }
  };

  // 拖拽经过（仅文件夹可接收）
  const handleDragOver = (e: React.DragEvent) => {
    if (!entry.is_dir) return;

    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    // 获取拖拽的数据
    const dragData = e.dataTransfer.types.includes('application/json');
    if (!dragData) return;

    setIsDragOver(true);

    // 自动展开文件夹（延迟展开）
    if (!isExpanded && !dragTimeoutRef.current) {
      dragTimeoutRef.current = setTimeout(() => {
        toggleNode(entry.path);
      }, 800);
    }
  };

  // 拖拽离开
  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!e.currentTarget.contains(relatedTarget)) {
      setIsDragOver(false);
      if (dragTimeoutRef.current) {
        clearTimeout(dragTimeoutRef.current);
        dragTimeoutRef.current = null;
      }
    }
  };

  // 拖拽放下
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current);
      dragTimeoutRef.current = null;
    }

    if (!entry.is_dir) return;

    try {
      const jsonData = e.dataTransfer.getData('application/json');
      if (!jsonData) return;

      const dragEntry = JSON.parse(jsonData);
      const sourcePath = dragEntry.path;

      // 不能拖放到自身
      if (sourcePath === entry.path) return;

      // 检查是否拖放到子文件夹
      if (dragEntry.isDir && entry.path.startsWith(sourcePath)) {
        toast.error('不能将文件夹移动到其子文件夹中');
        return;
      }

      // 构建目标路径
      const destPath = `${entry.path}/${dragEntry.name}`.replace(/\\/g, '/');

      // 检查目标是否已存在
      const exists = await fileService.checkPathExists(destPath);
      if (exists) {
        toast.error('目标位置已存在同名文件或文件夹');
        return;
      }

      // 执行移动
      await fileService.moveEntry(sourcePath, destPath);
      toast.success(`已移动 "${dragEntry.name}" 到当前文件夹`);

      // 刷新
      handleRefresh();
      // 刷新源目录
      const sourceParent = sourcePath.substring(0, sourcePath.lastIndexOf(/[\\/]/.test(sourcePath) ? (sourcePath.includes('\\') ? '\\' : '/') : '/'));
      if (sourceParent && sourceParent !== entry.path) {
        if (sourceParent === rootPath) {
          loadRootEntries();
        } else {
          refreshNode(sourceParent);
        }
      }
    } catch (err) {
      toast.error(`移动失败: ${getErrorMessage(err)}`);
    }
  };

  const icon = getFileIcon(entry);

  // 根据列配置渲染对应的单元格
  const renderColumnCell = (columnId: string) => {
    switch (columnId) {
      case 'type':
        return (
          <span key={columnId} className="text-xs text-muted-foreground w-16 text-right shrink-0">
            {entry.is_dir ? '文件夹' : entry.extension || '-'}
          </span>
        );
      case 'size':
        return !entry.is_dir ? (
          <span key={columnId} className="text-xs text-muted-foreground w-20 text-right shrink-0">
            {formatFileSize(entry.size)}
          </span>
        ) : (
          <span key={columnId} className="w-20 shrink-0" />
        );
      case 'modified':
        return (
          <span key={columnId} className="text-xs text-muted-foreground w-28 text-right shrink-0 hidden md:block">
            {formatDate(entry.modified_at)}
          </span>
        );
      case 'created':
        return (
          <span key={columnId} className="text-xs text-muted-foreground w-28 text-right shrink-0 hidden lg:block">
            {formatDate(entry.created_at)}
          </span>
        );
      default:
        return null;
    }
  };

  // Node content to be wrapped by context menu
  const nodeContent = (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={entry.is_dir ? handleDragOver : undefined}
      onDragLeave={entry.is_dir ? handleDragLeave : undefined}
      onDrop={entry.is_dir ? handleDrop : undefined}
      className={cn(
        'flex items-center gap-1 px-2 py-1 cursor-pointer rounded hover:bg-accent',
        isSelected && 'bg-accent',
        isDragging && 'opacity-50',
        isDragOver && entry.is_dir && 'bg-primary/20 ring-1 ring-primary ring-inset',
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

      {/* Dynamic columns based on configuration */}
      {columns.filter(c => c.visible).map(col => renderColumnCell(col.id))}
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
        onCut={handleCut}
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
              <TreeNode key={child.path} entry={child} depth={depth + 1} columns={columns} />
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
