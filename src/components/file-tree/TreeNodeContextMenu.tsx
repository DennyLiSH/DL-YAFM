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
  Scissors,
  X,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

interface TreeNodeContextMenuProps {
  entry: FileEntry;
  selectedCount?: number;
  children: React.ReactNode;
  onRefresh: () => void;
  onRename: () => void;
  onDelete: () => void;
  onNewFolder: () => void;
  onNewFile: () => void;
  onAddBookmark: () => void;
  onCopy: () => void;
  onCut?: () => void;
  onPaste?: () => void;
  onClearSelection?: () => void;
  hasClipboard?: boolean;
  onOpen?: () => void;
}

export function TreeNodeContextMenu({
  entry,
  selectedCount = 1,
  children,
  onRename,
  onDelete,
  onNewFolder,
  onNewFile,
  onAddBookmark,
  onCopy,
  onCut,
  onPaste,
  onClearSelection,
  hasClipboard = false,
  onOpen,
}: TreeNodeContextMenuProps) {
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
          <ContextMenuItem onClick={onCopy}>
            <Copy className="w-4 h-4 mr-2" />
            复制 {selectedCount} 个项目
          </ContextMenuItem>
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

  // 单选菜单（原有逻辑）
  return (
    <ContextMenu>
      <ContextMenuTrigger>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        {onOpen && (
          <>
            <ContextMenuItem onClick={onOpen}>
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
        {onCut && (
          <ContextMenuItem onClick={onCut}>
            <Scissors className="w-4 h-4 mr-2" />
            剪切
          </ContextMenuItem>
        )}
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
