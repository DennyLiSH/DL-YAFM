import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fileService } from '@/services/fileService';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/error';

interface RenameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entryPath: string;
  currentName: string;
  onSuccess: () => void;
}

export function RenameDialog({
  open,
  onOpenChange,
  entryPath,
  currentName,
  onSuccess,
}: RenameDialogProps) {
  const [name, setName] = useState(currentName);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setName(currentName);
  }, [currentName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || name === currentName) return;

    setIsLoading(true);
    try {
      await fileService.renameEntry(entryPath, name.trim());
      toast.success('重命名成功');
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(`重命名失败: ${getErrorMessage(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>重命名</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="py-4">
            <Input
              placeholder="新名称"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || name === currentName || isLoading}
            >
              {isLoading ? '处理中...' : '确定'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
