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
  FilePlus,
  Pencil,
  Trash2,
  Copy,
  ClipboardPaste,
  Star,
} from 'lucide-react';
import { toast } from 'sonner';

interface TreeNodeContextMenuProps {
  entry: FileEntry;
  children: React.ReactNode;
  onRefresh: () => void;
  onRename: () => void;
  onDelete: () => void;
  onNewFolder: () => void;
  onNewFile: () => void;
  onAddBookmark: () => void;
  onCopy: () => void;
  onPaste?: () => void;
  hasClipboard?: boolean;
}

export function TreeNodeContextMenu({
  entry,
  children,
  onRename,
  onDelete,
  onNewFolder,
  onNewFile,
  onAddBookmark,
  onCopy,
  onPaste,
  hasClipboard = false,
}: TreeNodeContextMenuProps) {
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
        {entry.is_dir && (
          <>
            <ContextMenuItem onClick={onNewFolder}>
              <FolderPlus className="w-4 h-4 mr-2" />
              新建文件夹
            </ContextMenuItem>
            <ContextMenuItem onClick={onNewFile}>
              <FilePlus className="w-4 h-4 mr-2" />
              新建文件
            </ContextMenuItem>
            <ContextMenuItem onClick={onAddBookmark}>
              <Star className="w-4 h-4 mr-2" />
              添加到收藏
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        <ContextMenuItem onClick={onRename}>
          <Pencil className="w-4 h-4 mr-2" />
          重命名
        </ContextMenuItem>
        <ContextMenuItem onClick={onCopy}>
          <Copy className="w-4 h-4 mr-2" />
          复制
        </ContextMenuItem>
        {entry.is_dir && hasClipboard && (
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
