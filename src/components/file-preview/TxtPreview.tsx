import { ScrollArea } from '@/components/ui/scroll-area';

interface TxtPreviewProps {
  content: string;
  isLoading: boolean;
  error: string | null;
}

export function TxtPreview({ content, isLoading, error }: TxtPreviewProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        加载中...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-destructive">
        {error}
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <pre className="p-4 text-sm whitespace-pre-wrap font-mono">{content}</pre>
    </ScrollArea>
  );
}
