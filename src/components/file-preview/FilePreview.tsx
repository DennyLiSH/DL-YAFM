import { FileText, FileWarning, PanelRightClose } from 'lucide-react';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { TxtPreview } from './TxtPreview';
import { MarkdownPreview } from './MarkdownPreview';
import { ImagePreview } from './ImagePreview';
import { PdfPreview } from './PdfPreview';

interface FilePreviewProps {
  onCollapse?: () => void;
}

export function FilePreview({ onCollapse }: FilePreviewProps) {
  const { previewFile, previewContent, previewType, isLoadingPreview, previewError } = useFileTreeStore();

  if (!previewFile) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-2 border-b flex items-center justify-between">
          <h2 className="text-sm font-medium">文件预览</h2>
          {onCollapse && (
            <button
              onClick={onCollapse}
              className="hover:bg-accent p-1 rounded transition-colors"
              title="折叠预览面板"
            >
              <PanelRightClose className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          选择文件以预览内容
        </div>
      </div>
    );
  }

  const renderPreviewContent = () => {
    if (isLoadingPreview) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      );
    }

    if (previewError) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
          <FileWarning className="w-12 h-12 mb-2" />
          <span className="text-sm">{previewError}</span>
        </div>
      );
    }

    switch (previewType) {
      case 'markdown':
        return <MarkdownPreview content={previewContent} />;
      case 'image':
        return <ImagePreview src={previewContent} />;
      case 'pdf':
        return <PdfPreview filePath={previewContent} />;
      case 'text':
        return <TxtPreview content={previewContent} isLoading={false} error={null} />;
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <FileWarning className="w-12 h-12 mb-2" />
            <span className="text-sm">暂不支持此文件类型预览</span>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 shrink-0" />
          <span className="text-sm font-medium truncate">{previewFile.name}</span>
        </div>
        {onCollapse && (
          <button
            onClick={onCollapse}
            className="hover:bg-accent p-1 rounded transition-colors flex-shrink-0"
            title="折叠预览面板"
          >
            <PanelRightClose className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-hidden">
        {renderPreviewContent()}
      </div>
    </div>
  );
}
