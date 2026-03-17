import { useEffect } from 'react';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { fileService } from '@/services/fileService';
import { TreeNode } from './TreeNode';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FolderOpen, RefreshCw } from 'lucide-react';

export function FileTree() {
  const {
    rootPath,
    rootEntries,
    isLoading,
    error,
    setRootPath,
    loadRootEntries,
    clearError,
  } = useFileTreeStore();

  useEffect(() => {
    if (rootPath) {
      loadRootEntries();
    }
  }, [rootPath, loadRootEntries]);

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

  if (!rootPath) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
        <FolderOpen className="w-16 h-16 opacity-50" />
        <p className="text-lg">选择一个文件夹开始浏览</p>
        <Button onClick={handleSelectFolder}>
          选择文件夹
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4" />
          <span className="text-sm font-medium truncate max-w-[200px]" title={rootPath}>
            {rootPath.split(/[\\/]/).pop() || rootPath}
          </span>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={handleSelectFolder} title="切换文件夹">
            <FolderOpen className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={loadRootEntries} title="刷新">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 text-sm text-destructive bg-destructive/10">
          {error}
        </div>
      )}

      {/* Tree Content */}
      <ScrollArea className="flex-1">
        {isLoading && rootEntries.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            加载中...
          </div>
        ) : rootEntries.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            空文件夹
          </div>
        ) : (
          <div className="py-1">
            {rootEntries.map((entry) => (
              <TreeNode key={entry.path} entry={entry} depth={0} />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
