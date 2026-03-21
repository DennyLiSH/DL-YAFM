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
import { useArrowKeyNavigation } from '@/hooks/useArrowKeyNavigation';

interface OverwriteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflictCount: number;
  nonConflictCount: number;
  onOverwrite: () => void;
  onRename: () => void;
  onCancel?: () => void;
}

export function OverwriteConfirmDialog({
  open,
  onOpenChange,
  conflictCount,
  nonConflictCount,
  onOverwrite,
  onRename,
  onCancel,
}: OverwriteConfirmDialogProps) {
  const buttonsRef = useRef<HTMLDivElement>(null);
  useArrowKeyNavigation(open, buttonsRef);

  const handleOverwrite = () => {
    onOpenChange(false);
    onOverwrite();
  };

  const handleRename = () => {
    onOpenChange(false);
    onRename();
  };

  const handleCancel = () => {
    onOpenChange(false);
    onCancel?.();
  };

  const totalFiles = conflictCount + nonConflictCount;
  const description = conflictCount === 1
    ? `目标位置已存在 ${totalFiles} 个同名文件。您想要如何处理？`
    : `目标位置已存在 ${conflictCount} 个同名文件（共 ${totalFiles} 个项目）。您想要如何处理？`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>文件已存在</DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter ref={buttonsRef} className="flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
          >
            取消
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleRename}
          >
            重命名冲突文件
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleOverwrite}
          >
            覆盖所有
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
