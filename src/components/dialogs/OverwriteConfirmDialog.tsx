import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface OverwriteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  onReplace: () => void;
  onSkip: () => void;
}

export function OverwriteConfirmDialog({
  open,
  onOpenChange,
  fileName,
  onReplace,
  onSkip,
}: OverwriteConfirmDialogProps) {
  const handleReplace = () => {
    onOpenChange(false);
    onReplace();
  };

  const handleSkip = () => {
    onOpenChange(false);
    onSkip();
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>文件已存在</DialogTitle>
          <DialogDescription>
            目标位置已存在 "{fileName}"。您想要如何处理？
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
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
            onClick={handleSkip}
          >
            跳过
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleReplace}
          >
            替换
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
