import { useSettingsStore } from '@/stores/settingsStore';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { Textarea } from '@/components/ui/textarea';

export function FolderSettings() {
  const { currentBrowsePath } = useFileTreeStore();
  const { getFolderDescription, setFolderDescription } = useSettingsStore();

  const description = currentBrowsePath ? getFolderDescription(currentBrowsePath) : '';

  const handleDescriptionChange = (value: string) => {
    if (currentBrowsePath) {
      setFolderDescription(currentBrowsePath, value);
    }
  };

  return (
    <div className="space-y-4 py-4">
      {currentBrowsePath ? (
        <>
          <div className="space-y-1">
            <label className="text-sm font-medium">当前文件夹</label>
            <p className="text-xs text-muted-foreground truncate" title={currentBrowsePath}>
              {currentBrowsePath}
            </p>
          </div>

          <div className="space-y-2">
            <div className="space-y-0.5">
              <label className="text-sm font-medium">文件夹介绍</label>
              <p className="text-xs text-muted-foreground">为当前文件夹添加描述信息</p>
            </div>
            <Textarea
              placeholder="在这里输入文件夹的介绍..."
              value={description}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              className="min-h-[150px] resize-none"
            />
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <p className="text-sm">请先选择一个文件夹</p>
          <p className="text-xs mt-1">在文件浏览器中点击任意文件夹即可添加描述</p>
        </div>
      )}
    </div>
  );
}
