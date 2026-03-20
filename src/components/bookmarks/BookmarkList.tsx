import { useBookmarkStore } from '@/stores/bookmarkStore';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { fileService } from '@/services/fileService';
import { Star, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/error';

export function BookmarkList() {
  const { bookmarks, removeBookmark } = useBookmarkStore();
  const { setBrowsePath, rootPath } = useFileTreeStore();

  const handleBookmarkClick = async (path: string) => {
    try {
      // Grant access and navigate
      await fileService.grantDirectoryAccess(path);
      // ✅ 只更新浏览路径，不影响 FileTree 根节点
      // setBrowsePath 会自动展开 FileTree 并选中目标节点
      await setBrowsePath(path);
    } catch (err) {
      toast.error(`无法访问: ${getErrorMessage(err)}`);
    }
  };

  const handleRemove = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    removeBookmark(id);
    toast.success('已移除收藏');
  };

  if (bookmarks.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground text-center">
        <Star className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>暂无收藏</p>
        <p className="text-xs mt-1">右键文件夹添加收藏</p>
      </div>
    );
  }

  return (
    <div className="py-2">
      {bookmarks.map((bookmark) => (
        <div
          key={bookmark.id}
          className={cn(
            'flex items-center gap-2 px-3 py-2 cursor-pointer rounded hover:bg-accent group',
          )}
          onClick={() => handleBookmarkClick(bookmark.path)}
        >
          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
          <span className="flex-1 truncate text-sm">{bookmark.name}</span>
          <button
            onClick={(e) => handleRemove(e, bookmark.id)}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/20 rounded transition-opacity"
            title="移除收藏"
          >
            <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
          </button>
        </div>
      ))}
    </div>
  );
}
