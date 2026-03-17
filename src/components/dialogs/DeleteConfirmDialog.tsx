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

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entryPath: string;
  entryName: string;
  isDir: boolean;
  onSuccess: () => void;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  entryPath,
  entryName,
  isDir,
  onSuccess,
}: DeleteConfirmDialogProps) {
  const handleDelete = async () => {
    try {
      await fileService.deleteEntry(entryPath, isDir);
      toast.success('已移至回收站');
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      console.error('Delete error:', err);
      toast.error(`删除失败: ${getErrorMessage(err)}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>移至回收站</DialogTitle>
          <DialogDescription>
            确定要将 "{entryName}" 移至回收站吗？
            {isDir && ' 文件夹内所有内容也将被移至回收站。'}
            您可以从回收站恢复此项目。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
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
