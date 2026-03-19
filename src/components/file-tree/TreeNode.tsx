import { useEffect, useState, useRef } from 'react';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { useBookmarkStore } from '@/stores/bookmarkStore';
import { useEditorStore } from '@/stores/editorStore';
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
  isVirtualRoot?: boolean; // 虚拟根节点标记
}

// 默认列配置
const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'type', label: '类型', width: 'w-16', visible: true },
  { id: 'size', label: '大小', width: 'w-20', visible: true },
  { id: 'modified', label: '修改日期', width: 'w-28', visible: true },
  { id: 'created', label: '创建日期', width: 'w-28', visible: true },
];

export function TreeNode({ entry, depth, columns = DEFAULT_COLUMNS, isVirtualRoot = false }: TreeNodeProps) {
  const {
    expandedNodes,
    selectedNodes,
    nodeCache,
    rootPath,
    clipboardEntries,
    toggleNode,
    toggleNodeSelection,
    clearSelection,
    loadNodeChildren,
    refreshNode,
    loadRootEntries,
    setBrowsePath,
    loadFilePreview,
    clearPreview,
    copyToClipboard,
    cutToClipboard,
    copySelectedToClipboard,
    cutSelectedToClipboard,
    pasteFromClipboard,
    getSelectedEntries,
  } = useFileTreeStore();

  const { addBookmark } = useBookmarkStore();

  const isExpanded = expandedNodes.has(entry.path);
  const isSelected = selectedNodes.has(entry.path);
  const hasMultiSelection = selectedNodes.size > 1;
  const nodeState = nodeCache.get(entry.path);
  const children = nodeState?.children || [];
  const isLoading = nodeState?.isLoading;

  // Dialog states
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showOverwriteDialog, setShowOverwriteDialog] = useState(false);

  // Editor state from global store (singleton cache)
  const availableEditors = useEditorStore((state) => state.editors);

  // Open with specific editor
  const handleOpenWithEditor = async (path: string, editorId: string) => {
    try {
      await fileService.openWithEditor(path, editorId);
    } catch (err) {
      toast.error(`打开失败: ${getErrorMessage(err)}`);
    }
  };

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 使用 ref 追踪是否正在加载，避免 useEffect 无限循环
  const loadingRef = useRef(false);

  // 虚拟根节点初始化展开标记，确保只展开一次
  const virtualRootInitializedRef = useRef(false);

  // 虚拟根节点自动展开（只执行一次）
  useEffect(() => {
    if (isVirtualRoot && entry.is_dir && !virtualRootInitializedRef.current) {
      virtualRootInitializedRef.current = true;
      if (!isExpanded) {
        toggleNode(entry.path);
      }
    }
  }, [isVirtualRoot, entry.is_dir, entry.path, isExpanded, toggleNode]);

  useEffect(() => {
    // Load children when node is expanded
    if (isExpanded && entry.is_dir && !loadingRef.current) {
      loadingRef.current = true;
      loadNodeChildren(entry.path).finally(() => {
        loadingRef.current = false;
      });
    }
  }, [isExpanded, entry.is_dir, entry.path, loadNodeChildren]);

  // 箭头点击处理：只展开/收起节点，不影响 FileBrowser
  const handleArrowClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleNode(entry.path);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    const isCtrlPressed = e.ctrlKey || e.metaKey;
    const isShiftPressed = e.shiftKey;

    if (isShiftPressed && selectedNodes.size > 0) {
      // Shift+点击：范围选择
      toggleNodeSelection(entry.path, 'shift');
    } else if (isCtrlPressed) {
      // Ctrl+点击：切换选择
      toggleNodeSelection(entry.path, 'ctrl');
    } else {
      // 普通点击：单选
      toggleNodeSelection(entry.path, 'none');
    }

    // 处理文件夹：只更新 FileBrowser 显示内容，不展开节点
    if (!isCtrlPressed && !isShiftPressed && entry.is_dir) {
      setBrowsePath(entry.path);
      clearPreview();
    }

    // 加载文件预览（仅单选时）
    if (selectedNodes.size <= 1 && !entry.is_dir && !isCtrlPressed && !isShiftPressed) {
      loadFilePreview(entry);
    }
  };

  const handleDoubleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!entry.is_dir) {
      // 文件：用系统默认程序打开
      try {
        await fileService.openWithSystemApp(entry.path);
      } catch (err) {
        toast.error(`打开失败: ${getErrorMessage(err)}`);
      }
    }
    // 文件夹双击保持原有展开/收起行为（由 handleClick 处理）
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

  const handleOpen = async () => {
    try {
      await fileService.openWithSystemApp(entry.path);
    } catch (err) {
      toast.error(`打开失败: ${getErrorMessage(err)}`);
    }
  };

  const handleCopy = () => {
    if (hasMultiSelection && isSelected) {
      // 多选复制
      const selectedEntries = getSelectedEntries();
      copySelectedToClipboard(selectedEntries);
      toast.success(`已复制 ${selectedEntries.length} 个项目到剪贴板`);
    } else {
      // 单选复制
      copyToClipboard(entry);
      toast.success('已复制到剪贴板');
    }
  };

  const handleCut = () => {
    if (hasMultiSelection && isSelected) {
      // 多选剪切
      const selectedEntries = getSelectedEntries();
      cutSelectedToClipboard(selectedEntries);
      toast.success(`已剪切 ${selectedEntries.length} 个项目到剪贴板`);
    } else {
      // 单选剪切
      cutToClipboard(entry);
      toast.success('已剪切到剪贴板');
    }
  };

  const handlePaste = async () => {
    if (clipboardEntries.length === 0) return;

    // 检查是否有目标路径已存在
    let hasConflict = false;
    for (const clipboardEntry of clipboardEntries) {
      const destPath = `${entry.path}/${clipboardEntry.sourceName}`.replace(/\\/g, '/');
      const exists = await fileService.checkPathExists(destPath);
      if (exists) {
        hasConflict = true;
        break;
      }
    }

    if (hasConflict) {
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

    // 获取要拖拽的条目
    let entriesToDrag: FileEntry[];
    if (isSelected && hasMultiSelection) {
      // 如果当前节点在选中集合中，拖拽所有选中项
      entriesToDrag = getSelectedEntries();
    } else {
      // 否则只拖拽当前节点
      entriesToDrag = [entry];
    }

    // 设置拖拽数据
    e.dataTransfer.setData('text/plain', entriesToDrag.map(e => e.path).join('\n'));
    e.dataTransfer.setData('application/json', JSON.stringify({
      entries: entriesToDrag.map(e => ({
        path: e.path,
        name: e.name,
        isDir: e.is_dir
      })),
      isMultiSelect: entriesToDrag.length > 1
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

      const dragData = JSON.parse(jsonData);
      const entries = dragData.entries || [dragData]; // 兼容旧格式

      // 过滤掉不能移动的条目（自身和子文件夹）
      const validEntries = entries.filter((dragEntry: { path: string; name: string; isDir: boolean }) => {
        // 不能拖放到自身
        if (dragEntry.path === entry.path) return false;
        // 检查是否拖放到子文件夹
        if (dragEntry.isDir && entry.path.startsWith(dragEntry.path)) return false;
        return true;
      });

      if (validEntries.length === 0) {
        toast.error('无法移动选中的项目');
        return;
      }

      // 检查目标是否已存在
      let hasConflict = false;
      for (const dragEntry of validEntries) {
        const destPath = `${entry.path}/${dragEntry.name}`.replace(/\\/g, '/');
        const exists = await fileService.checkPathExists(destPath);
        if (exists) {
          hasConflict = true;
          break;
        }
      }

      if (hasConflict) {
        toast.error('目标位置已存在同名文件或文件夹');
        return;
      }

      // 批量移动
      let successCount = 0;
      for (const dragEntry of validEntries) {
        try {
          const destPath = `${entry.path}/${dragEntry.name}`.replace(/\\/g, '/');
          await fileService.moveEntry(dragEntry.path, destPath);
          successCount++;
        } catch (err) {
          console.error('Failed to move:', dragEntry.path, err);
        }
      }

      if (successCount > 0) {
        toast.success(`已移动 ${successCount} 个项目到当前文件夹`);
        // 清除选择
        clearSelection();
        // 刷新
        handleRefresh();
        // 刷新源目录
        for (const dragEntry of validEntries) {
          const sourceParent = dragEntry.path.substring(0, dragEntry.path.lastIndexOf(/[\\/]/.test(dragEntry.path) ? (dragEntry.path.includes('\\') ? '\\' : '/') : '/'));
          if (sourceParent && sourceParent !== entry.path) {
            if (sourceParent === rootPath) {
              loadRootEntries();
            } else {
              refreshNode(sourceParent);
            }
          }
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
        isSelected && 'bg-primary/20 ring-1 ring-primary/50',
        isSelected && hasMultiSelection && 'bg-primary/30',
        isDragging && 'opacity-50',
        isDragOver && entry.is_dir && 'bg-primary/20 ring-1 ring-primary ring-inset',
      )}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {/* Expand/Collapse Arrow */}
      {entry.is_dir && (
        <span
          className={cn('w-4 h-4 flex items-center justify-center text-xs transition-transform cursor-pointer hover:bg-accent rounded', isExpanded && 'rotate-90')}
          onClick={handleArrowClick}
        >
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
        selectedCount={hasMultiSelection && isSelected ? selectedNodes.size : 1}
        onRefresh={handleRefresh}
        onRename={() => setShowRenameDialog(true)}
        onDelete={() => setShowDeleteDialog(true)}
        onNewFolder={() => setShowNewFolderDialog(true)}
        onNewFile={() => setShowNewFileDialog(true)}
        onAddBookmark={handleAddBookmark}
        onCopy={handleCopy}
        onCut={handleCut}
        onPaste={handlePaste}
        onClearSelection={clearSelection}
        hasClipboard={clipboardEntries.length > 0}
        onOpen={handleOpen}
        availableEditors={availableEditors}
        onOpenWithEditor={handleOpenWithEditor}
      >
        {nodeContent}
      </TreeNodeContextMenu>

      {/* Children - 只显示文件夹 */}
      {isExpanded && entry.is_dir && (
        <div>
          {isLoading ? (
            <div className="px-2 py-1 text-sm text-muted-foreground" style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}>
              加载中...
            </div>
          ) : (
            children.filter(child => child.is_dir).map((child) => (
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
        entries={hasMultiSelection && isSelected ? getSelectedEntries() : [entry]}
        onSuccess={() => {
          handleRefreshAfterDelete();
          clearSelection();
        }}
      />
      <OverwriteConfirmDialog
        open={showOverwriteDialog}
        onOpenChange={setShowOverwriteDialog}
        fileName={clipboardEntries.length > 1 ? `${clipboardEntries.length} 个项目` : (clipboardEntries[0]?.sourceName || '')}
        onReplace={handleReplace}
        onSkip={handleSkip}
      />
    </div>
  );
}
