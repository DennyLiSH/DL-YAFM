import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from '@/components/ui/context-menu';
import type { FileEntry } from '@/types/file';
import type { EditorInfo } from '@/services/fileService';
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
  Puzzle,
  MessageCircle,
  FilePlus,
  Star,
  Code2,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePluginStore } from '@/stores/pluginStore';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { useBookmarkStore } from '@/stores/bookmarkStore';

// 图标映射
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'message-circle': MessageCircle,
  hash: Puzzle,
  default: Puzzle,
};

function getPluginIcon(iconName?: string) {
  const IconComponent = iconMap[iconName || 'default'] || Puzzle;
  return <IconComponent className="w-4 h-4 mr-2" />;
}

interface FileBrowserContextMenuProps {
  entry: FileEntry;
  selectedCount?: number;
  children: React.ReactNode;
  onRefresh: () => void;
  onRename: () => void;
  onDelete: () => void;
  onNewFolder: () => void;
  onNewFile?: () => void;
  onOpenFolder?: () => void;
  onOpenFile?: () => void;
  onCopy?: () => void;
  onCut?: () => void;
  onClearSelection?: () => void;
  hasClipboard?: boolean;
  onPaste?: () => void;
  availableEditors?: EditorInfo[];
  onOpenWithEditor?: (path: string, editorId: string) => void;
}

export function FileBrowserContextMenu({
  entry,
  selectedCount = 1,
  children,
  onRefresh,
  onRename,
  onDelete,
  onNewFolder,
  onNewFile,
  onOpenFolder,
  onOpenFile,
  onCopy,
  onCut,
  onClearSelection,
  hasClipboard = false,
  onPaste,
  availableEditors,
  onOpenWithEditor,
}: FileBrowserContextMenuProps) {
  const isMultiSelect = selectedCount > 1;

  // 插件系统
  const { getMenuItemsForContext, executeAction } = usePluginStore();
  const getSelectedEntriesFromStore = useFileTreeStore((state) => state.getSelectedEntries);
  const selectedNodes = useFileTreeStore((state) => state.selectedNodes);

  // 收藏夹
  const { addBookmark, removeBookmark, isBookmarked, bookmarks } = useBookmarkStore();
  const entryIsBookmarked = isBookmarked(entry.path);

  const handleToggleBookmark = async () => {
    if (entryIsBookmarked) {
      const bookmark = bookmarks.find((b) => b.path === entry.path);
      if (bookmark) {
        await removeBookmark(bookmark.id);
        toast.success('已取消收藏');
      }
    } else {
      await addBookmark(entry.name, entry.path);
      toast.success('已添加到收藏夹');
    }
  };

  // 获取当前选中的条目
  const getSelectedEntries = (): FileEntry[] => {
    if (selectedNodes.size > 1) {
      return getSelectedEntriesFromStore();
    }
    return [entry];
  };

  const selectedEntries = getSelectedEntries();
  const pluginMenuItems = getMenuItemsForContext(selectedEntries, 'FileBrowser');

  const handlePluginAction = (pluginId: string, actionId: string) => {
    executeAction(pluginId, actionId, selectedEntries, entry.path, onRefresh);
  };

  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(entry.path);
      toast.success('路径已复制');
    } catch {
      toast.error('复制失败');
    }
  };

  // 渲染插件菜单项
  const renderPluginMenuItems = () => {
    if (pluginMenuItems.length === 0) return null;

    return (
      <>
        <ContextMenuSeparator />
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
          插件
        </div>
        {pluginMenuItems.map((item) => (
          <ContextMenuItem
            key={`${item.pluginId}-${item.id}`}
            onClick={() => handlePluginAction(item.pluginId, item.id)}
            disabled={item.disabled}
          >
            {getPluginIcon(item.icon)}
            {item.label}
          </ContextMenuItem>
        ))}
      </>
    );
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
        {/* 用编辑器打开 */}
        {availableEditors && availableEditors.length > 0 && onOpenWithEditor && (
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <Code2 className="w-4 h-4 mr-2" />
              用编辑器打开
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {availableEditors.map(editor => (
                <ContextMenuItem
                  key={editor.id}
                  onClick={() => onOpenWithEditor(entry.path, editor.id)}
                >
                  {editor.name}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}
        {entry.is_dir && (
          <>
            <ContextMenuItem onClick={onNewFolder}>
              <FolderPlus className="w-4 h-4 mr-2" />
              新建文件夹
            </ContextMenuItem>
            {onNewFile && (
              <ContextMenuItem onClick={onNewFile}>
                <FilePlus className="w-4 h-4 mr-2" />
                新建文件
              </ContextMenuItem>
            )}
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
        <ContextMenuItem onClick={handleToggleBookmark}>
          <Star className={`w-4 h-4 mr-2 ${entryIsBookmarked ? 'fill-yellow-400 text-yellow-400' : ''}`} />
          {entryIsBookmarked ? '取消收藏' : '添加到收藏夹'}
        </ContextMenuItem>
        {renderPluginMenuItems()}
      </ContextMenuContent>
    </ContextMenu>
  );
}
