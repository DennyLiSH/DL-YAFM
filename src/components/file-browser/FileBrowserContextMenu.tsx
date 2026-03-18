import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import type { FileEntry } from '@/types/file';
import {
  FolderPlus,
  Pencil,
  Trash2,
  Copy,
  FolderOpen,
  ExternalLink,
  Scissors,
  X,
  ClipboardPaste,
} from 'lucide-react';
import { toast } from 'sonner';

interface FileBrowserContextMenuProps {
  entry: FileEntry;
  selectedCount?: number;
  children: React.ReactNode;
  onRefresh: () => void;
  onRename: () => void;
  onDelete: () => void;
  onNewFolder: () => void;
  onOpenFolder?: () => void;
  onOpenFile?: () => void;
  onCopy?: () => void;
  onCut?: () => void;
  onClearSelection?: () => void;
  hasClipboard?: boolean;
  onPaste?: () => void;
}

export function FileBrowserContextMenu({
  entry,
  selectedCount = 1,
  children,
  onRename,
  onDelete,
  onNewFolder,
  onOpenFolder,
  onOpenFile,
  onCopy,
  onCut,
  onClearSelection,
  hasClipboard = false,
  onPaste,
}: FileBrowserContextMenuProps) {
  const isMultiSelect = selectedCount > 1;

  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(entry.path);
      toast.success('路径已复制');
    } catch {
      toast.error('复制失败');
    }
  };

  // 多选菜单
  if (isMultiSelect) {
    return (
      <ContextMenu>
        <ContextMenuTrigger>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
            已选择 {selectedCount} 个项目
          </div>
          <ContextMenuSeparator />
          {onCopy && (
            <ContextMenuItem onClick={onCopy}>
              <Copy className="w-4 h-4 mr-2" />
              复制 {selectedCount} 个项目
            </ContextMenuItem>
          )}
          {onCut && (
            <ContextMenuItem onClick={onCut}>
              <Scissors className="w-4 h-4 mr-2" />
              剪切 {selectedCount} 个项目
            </ContextMenuItem>
          )}
          <ContextMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
            <Trash2 className="w-4 h-4 mr-2" />
            删除 {selectedCount} 个项目
          </ContextMenuItem>
          <ContextMenuSeparator />
          {onClearSelection && (
            <ContextMenuItem onClick={onClearSelection}>
              <X className="w-4 h-4 mr-2" />
              取消选择
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>
    );
  }

  // 单选菜单
  return (
    <ContextMenu>
      <ContextMenuTrigger>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        {entry.is_dir && onOpenFolder && (
          <>
            <ContextMenuItem onClick={onOpenFolder}>
              <FolderOpen className="w-4 h-4 mr-2" />
              打开文件夹
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        {!entry.is_dir && onOpenFile && (
          <>
            <ContextMenuItem onClick={onOpenFile}>
              <ExternalLink className="w-4 h-4 mr-2" />
              打开
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        {entry.is_dir && (
          <>
            <ContextMenuItem onClick={onNewFolder}>
              <FolderPlus className="w-4 h-4 mr-2" />
              新建文件夹
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        <ContextMenuItem onClick={onRename}>
          <Pencil className="w-4 h-4 mr-2" />
          重命名
        </ContextMenuItem>
        {onCopy && (
          <ContextMenuItem onClick={onCopy}>
            <Copy className="w-4 h-4 mr-2" />
            复制
          </ContextMenuItem>
        )}
        {onCut && (
          <ContextMenuItem onClick={onCut}>
            <Scissors className="w-4 h-4 mr-2" />
            剪切
          </ContextMenuItem>
        )}
        {entry.is_dir && hasClipboard && onPaste && (
          <ContextMenuItem onClick={onPaste}>
            <ClipboardPaste className="w-4 h-4 mr-2" />
            粘贴
          </ContextMenuItem>
        )}
        <ContextMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
          <Trash2 className="w-4 h-4 mr-2" />
          删除
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleCopyPath}>
          <Copy className="w-4 h-4 mr-2" />
          复制路径
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
