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
} from 'lucide-react';
import { toast } from 'sonner';

interface FileBrowserContextMenuProps {
  entry: FileEntry;
  children: React.ReactNode;
  onRefresh: () => void;
  onRename: () => void;
  onDelete: () => void;
  onNewFolder: () => void;
  onOpenFolder?: () => void;
  onOpenFile?: () => void;
}

export function FileBrowserContextMenu({
  entry,
  children,
  onRename,
  onDelete,
  onNewFolder,
  onOpenFolder,
  onOpenFile,
}: FileBrowserContextMenuProps) {
  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(entry.path);
      toast.success('路径已复制');
    } catch {
      toast.error('复制失败');
    }
  };

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
