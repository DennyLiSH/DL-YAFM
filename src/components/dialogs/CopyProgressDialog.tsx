import { useCopyProgressStore } from '@/stores/copyProgressStore';
import { fileService } from '@/services/fileService';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { X, HardDrive, File } from 'lucide-react';
import { cn } from '@/lib/utils';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatSpeed(speedMbps: number): string {
  if (speedMbps < 1) {
    return `${(speedMbps * 1024).toFixed(0)} KB/s`;
  }
  return `${speedMbps.toFixed(2)} MB/s`;
}

interface CopyTaskItemProps {
  taskId: string;
  sourceName: string;
  dest: string;
  currentFile: string;
  filesCopied: number;
  totalFiles: number;
  bytesCopied: number;
  totalBytes: number;
  percentage: number;
  speedMbps: number;
  isComplete: boolean;
  error: string | null;
}

function CopyTaskItem({
  taskId,
  sourceName,
  currentFile,
  filesCopied,
  totalFiles,
  bytesCopied,
  totalBytes,
  percentage,
  speedMbps,
  isComplete,
  error,
}: CopyTaskItemProps) {
  const handleCancel = async () => {
    await fileService.cancelCopyTask(taskId);
  };

  const handleDismiss = () => {
    useCopyProgressStore.getState().removeTask(taskId);
  };

  return (
    <div className={cn(
      "p-3 rounded-lg border",
      error ? "border-destructive bg-destructive/10" : "border-border bg-card"
    )}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <HardDrive className="w-4 h-4 shrink-0 text-muted-foreground" />
          <span className="font-medium truncate">{sourceName}</span>
        </div>
        {isComplete ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleDismiss}
          >
            <X className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-destructive hover:text-destructive"
            onClick={handleCancel}
          >
            取消
          </Button>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-2">
        <Progress
          value={error ? 100 : percentage}
          className={cn("h-2", error && "bg-destructive/20")}
        />
      </div>

      {/* Current file */}
      {currentFile && !isComplete && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1 min-w-0">
          <File className="w-3 h-3 shrink-0" />
          <span className="truncate">{currentFile}</span>
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {filesCopied} / {totalFiles} 文件
        </span>
        <span>
          {formatBytes(bytesCopied)} / {formatBytes(totalBytes)}
        </span>
      </div>

      {/* Speed */}
      {!isComplete && !error && speedMbps > 0 && (
        <div className="text-xs text-muted-foreground mt-1">
          速度: {formatSpeed(speedMbps)}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="text-xs text-destructive mt-1">
          错误: {error}
        </div>
      )}

      {/* Complete message */}
      {isComplete && !error && (
        <div className="text-xs text-green-600 mt-1">
          复制完成
        </div>
      )}
    </div>
  );
}

export function CopyProgressDialog() {
  const { tasks } = useCopyProgressStore();

  if (tasks.size === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 max-h-96 overflow-y-auto space-y-2">
      {Array.from(tasks.values()).map((task) => (
        <CopyTaskItem
          key={task.task_id}
          taskId={task.task_id}
          sourceName={task.source.split(/[\\/]/).pop() || task.source}
          dest={task.dest}
          currentFile={task.current_file}
          filesCopied={task.files_copied}
          totalFiles={task.total_files}
          bytesCopied={task.bytes_copied}
          totalBytes={task.total_bytes}
          percentage={task.percentage}
          speedMbps={task.speed_mbps}
          isComplete={task.is_complete}
          error={task.error}
        />
      ))}
    </div>
  );
}
