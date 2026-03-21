import { useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { fileService } from '@/services/fileService';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/error';
import { useArrowKeyNavigation } from '@/hooks/useArrowKeyNavigation';
import type { FileEntry } from '@/types/file';

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries?: FileEntry[];  // 多选模式
  entryPath?: string;     // 单选模式（兼容）
  entryName?: string;     // 单选模式（兼容）
  isDir?: boolean;        // 单选模式（兼容）
  onSuccess: () => void;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  entries,
  entryPath,
  entryName,
  isDir,
  onSuccess,
}: DeleteConfirmDialogProps) {
  const buttonsRef = useRef<HTMLDivElement>(null);
  useArrowKeyNavigation(open, buttonsRef);

  // 确定删除模式：多选或单选

  // 获取要删除的项目列表
  const getItemsToDelete = (): { path: string; isDir: boolean; name: string }[] => {
    if (entries && entries.length > 0) {
      return entries.map(e => ({ path: e.path, isDir: e.is_dir, name: e.name }));
    }
    if (entryPath && entryName !== undefined && isDir !== undefined) {
      return [{ path: entryPath, isDir, name: entryName }];
    }
    return [];
  };

  const itemsToDelete = getItemsToDelete();
  const count = itemsToDelete.length;

  // 检查是否包含文件夹
  const hasDirectory = itemsToDelete.some(item => item.isDir);

  const handleDelete = async () => {
    try {
      // 逐个删除
      for (const item of itemsToDelete) {
        await fileService.deleteEntry(item.path, item.isDir);
      }
      toast.success(count > 1 ? `已将 ${count} 个项目移至回收站` : '已移至回收站');
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      console.error('Delete error:', err);
      toast.error(`删除失败: ${getErrorMessage(err)}`);
    }
  };

  // 生成描述文本
  const getDescription = () => {
    if (count === 0) return '';

    if (count === 1) {
      const item = itemsToDelete[0];
      return (
        <>
          确定要将 "{item?.name}" 移至回收站吗？
          {item?.isDir && ' 文件夹内所有内容也将被移至回收站。'}
          您可以从回收站恢复此项目。
        </>
      );
    }

    return (
      <>
        确定要将 <strong>{count} 个项目</strong> 移至回收站吗？
        {hasDirectory && ' 包含的文件夹及其内容也将被移至回收站。'}
        您可以从回收站恢复这些项目。
      </>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>移至回收站</DialogTitle>
          <DialogDescription>
            {getDescription()}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter ref={buttonsRef}>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button type="button" variant="destructive" onClick={handleDelete}>
            移至回收站
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
