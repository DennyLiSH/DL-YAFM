import { useState, useMemo } from 'react';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { FileBrowserContextMenu } from './FileBrowserContextMenu';
import {
  NewFolderDialog,
  RenameDialog,
  DeleteConfirmDialog,
} from '@/components/dialogs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { formatFileSize, formatDate, getFileIcon } from '@/lib/format';
import {
  ChevronRight,
  ArrowUp,
  FolderOpen,
  RefreshCw,
  ArrowUpNarrowWide,
  ArrowDownWideNarrow,
} from 'lucide-react';
import type { FileEntry } from '@/types/file';

type SortField = 'name' | 'size' | 'type' | 'modified';
type SortDirection = 'asc' | 'desc';

export function FileBrowser() {
  const {
    currentBrowsePath,
    browseEntries,
    browseHistory,
    isLoadingBrowse,
    rootPath,
    setBrowsePath,
    goBack,
    goToParent,
    refreshBrowse,
  } = useFileTreeStore();

  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Dialog states
  const [selectedEntry, setSelectedEntry] = useState<FileEntry | null>(null);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Sort entries
  const sortedEntries = useMemo(() => {
    const sorted = [...browseEntries];
    sorted.sort((a, b) => {
      // Always put folders first
      if (a.is_dir !== b.is_dir) {
        return a.is_dir ? -1 : 1;
      }

      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name, 'zh-CN');
          break;
        case 'size':
          comparison = (a.size || 0) - (b.size || 0);
          break;
        case 'type':
          comparison = (a.is_dir ? '文件夹' : a.name.split('.').pop() || '').localeCompare(
            b.is_dir ? '文件夹' : b.name.split('.').pop() || ''
          );
          break;
        case 'modified':
          comparison = new Date(a.modified_at || 0).getTime() - new Date(b.modified_at || 0).getTime();
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [browseEntries, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleDoubleClick = (entry: FileEntry) => {
    if (entry.is_dir) {
      setBrowsePath(entry.path);
    }
  };

  const handleOpenFolder = (entry: FileEntry) => {
    if (entry.is_dir) {
      setBrowsePath(entry.path);
    }
  };

  const handleRefresh = () => {
    refreshBrowse();
  };

  const handleRefreshAfterAction = () => {
    refreshBrowse();
    setSelectedEntry(null);
  };

  // Breadcrumb segments
  const pathSegments = useMemo(() => {
    if (!currentBrowsePath) return [];
    const parts = currentBrowsePath.split(/[\\/]/).filter(Boolean);
    let currentPath = currentBrowsePath.includes('\\') ? '' : '/';

    return parts.map((part, index) => {
      if (currentBrowsePath.includes('\\')) {
        currentPath = index === 0 ? part : `${currentPath}\\${part}`;
      } else {
        currentPath = `${currentPath}${part}`;
      }
      return { name: part, path: currentPath };
    });
  }, [currentBrowsePath]);

  // Render Sort Icon
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ArrowUpNarrowWide className="w-3 h-3 ml-1" />
    ) : (
      <ArrowDownWideNarrow className="w-3 h-3 ml-1" />
    );
  };

  if (!rootPath) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-2 border-b">
          <h2 className="text-sm font-medium">文件浏览</h2>
        </div>
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          请先选择文件夹
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-2 border-b flex items-center justify-between">
        <h2 className="text-sm font-medium">文件浏览</h2>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={goBack}
            disabled={browseHistory.length === 0}
            title="返回"
          >
            <ArrowUp className="w-4 h-4 rotate-[-90deg]" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={goToParent}
            disabled={!currentBrowsePath || currentBrowsePath === rootPath}
            title="上级目录"
          >
            <ArrowUp className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoadingBrowse}
            title="刷新"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingBrowse ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Breadcrumb */}
      {currentBrowsePath && (
        <div className="px-4 py-1.5 border-b bg-muted/30 overflow-x-auto">
          <div className="flex items-center gap-1 text-xs whitespace-nowrap">
            {pathSegments.map((segment, index) => (
              <span key={segment.path} className="flex items-center">
                {index > 0 && <ChevronRight className="w-3 h-3 mx-1 text-muted-foreground" />}
                <button
                  className="hover:underline truncate max-w-[100px]"
                  onClick={() => setBrowsePath(segment.path)}
                  title={segment.path}
                >
                  {segment.name}
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Table Header */}
      <div className="grid grid-cols-[1fr_80px_80px_100px] gap-2 px-4 py-2 border-b bg-muted/50 text-xs font-medium text-muted-foreground">
        <button
          className="flex items-center hover:text-foreground text-left"
          onClick={() => handleSort('name')}
        >
          名称
          <SortIcon field="name" />
        </button>
        <button
          className="flex items-center hover:text-foreground text-right"
          onClick={() => handleSort('size')}
        >
          大小
          <SortIcon field="size" />
        </button>
        <button
          className="flex items-center hover:text-foreground text-right"
          onClick={() => handleSort('type')}
        >
          类型
          <SortIcon field="type" />
        </button>
        <button
          className="flex items-center hover:text-foreground text-right"
          onClick={() => handleSort('modified')}
        >
          修改日期
          <SortIcon field="modified" />
        </button>
      </div>

      {/* File List */}
      <ScrollArea className="flex-1">
        {isLoadingBrowse && browseEntries.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
            加载中...
          </div>
        ) : !currentBrowsePath ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <FolderOpen className="w-10 h-10 mb-2 opacity-50" />
            <p className="text-sm">点击文件树中的文件夹开始浏览</p>
          </div>
        ) : browseEntries.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
            空文件夹
          </div>
        ) : (
          <div className="divide-y">
            {sortedEntries.map((entry) => (
              <FileBrowserContextMenu
                key={entry.path}
                entry={entry}
                onRefresh={handleRefreshAfterAction}
                onRename={() => {
                  setSelectedEntry(entry);
                  setShowRenameDialog(true);
                }}
                onDelete={() => {
                  setSelectedEntry(entry);
                  setShowDeleteDialog(true);
                }}
                onNewFolder={() => {
                  setSelectedEntry(entry);
                  setShowNewFolderDialog(true);
                }}
                onOpenFolder={() => handleOpenFolder(entry)}
              >
                <div
                  className="grid grid-cols-[1fr_80px_80px_100px] gap-2 px-4 py-1.5 text-sm hover:bg-accent cursor-pointer items-center"
                  onDoubleClick={() => handleDoubleClick(entry)}
                >
                  {/* Name */}
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-base flex-shrink-0">{getFileIcon(entry)}</span>
                    <span className="truncate">{entry.name}</span>
                  </div>
                  {/* Size */}
                  <span className="text-xs text-muted-foreground text-right">
                    {entry.is_dir ? '-' : formatFileSize(entry.size)}
                  </span>
                  {/* Type */}
                  <span className="text-xs text-muted-foreground text-right truncate">
                    {entry.is_dir ? '文件夹' : entry.name.split('.').pop() || '-'}
                  </span>
                  {/* Modified */}
                  <span className="text-xs text-muted-foreground text-right">
                    {formatDate(entry.modified_at)}
                  </span>
                </div>
              </FileBrowserContextMenu>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Dialogs */}
      {selectedEntry && (
        <>
          <NewFolderDialog
            open={showNewFolderDialog}
            onOpenChange={setShowNewFolderDialog}
            parentPath={selectedEntry.is_dir ? selectedEntry.path : currentBrowsePath || selectedEntry.path}
            onSuccess={handleRefreshAfterAction}
          />
          <RenameDialog
            open={showRenameDialog}
            onOpenChange={setShowRenameDialog}
            entryPath={selectedEntry.path}
            currentName={selectedEntry.name}
            onSuccess={handleRefreshAfterAction}
          />
          <DeleteConfirmDialog
            open={showDeleteDialog}
            onOpenChange={setShowDeleteDialog}
            entryPath={selectedEntry.path}
            entryName={selectedEntry.name}
            isDir={selectedEntry.is_dir}
            onSuccess={handleRefreshAfterAction}
          />
        </>
      )}

      {/* New folder dialog for empty area context menu */}
      {currentBrowsePath && (
        <NewFolderDialog
          open={showNewFolderDialog && !selectedEntry}
          onOpenChange={(open) => {
            setShowNewFolderDialog(open);
            if (!open) setSelectedEntry(null);
          }}
          parentPath={currentBrowsePath}
          onSuccess={handleRefreshAfterAction}
        />
      )}
    </div>
  );
}
