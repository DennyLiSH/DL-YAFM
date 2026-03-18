import { usePluginStore } from '@/stores/pluginStore';
import { pluginService } from '@/services/pluginService';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { FolderOpen, RefreshCw, Package, FileCode } from 'lucide-react';

export function PluginSettings() {
  const { pluginDirectory, isLoading, refreshPlugins } = usePluginStore();

  const handleOpenDirectory = async () => {
    try {
      await pluginService.openPluginDirectory();
    } catch (error) {
      console.error('Failed to open plugin directory:', error);
      toast.error('无法打开插件目录');
    }
  };

  const handleRefresh = async () => {
    await refreshPlugins();
  };

  return (
    <div className="space-y-6 py-4">
      {/* 插件目录 */}
      <div className="space-y-2">
        <label className="text-sm font-medium">插件目录</label>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-md bg-muted px-3 py-2 text-xs break-all">
            {pluginDirectory || '加载中...'}
          </code>
          <Button
            variant="outline"
            size="icon"
            onClick={handleOpenDirectory}
            title="打开插件目录"
          >
            <FolderOpen className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          将插件文件夹放入此目录，然后点击刷新按钮
        </p>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          刷新插件
        </Button>
      </div>

      {/* 插件列表 */}
      <div className="space-y-2">
        <label className="text-sm font-medium">已安装插件</label>
        <PluginList />
      </div>

      {/* 使用说明 */}
      <div className="rounded-md bg-muted/50 p-4 space-y-2">
        <h4 className="text-sm font-medium">如何安装插件</h4>
        <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
          <li>点击"打开插件目录"按钮</li>
          <li>在目录中创建插件文件夹（如 com.example.my-plugin）</li>
          <li>将 plugin.json 和 plugin.wasm 放入文件夹</li>
          <li>点击"刷新插件"按钮</li>
        </ol>
      </div>
    </div>
  );
}

function PluginList() {
  const { menuItems, isLoading } = usePluginStore();

  // 从菜单项中提取唯一的插件信息
  const plugins = Array.from(
    new Map(menuItems.map((item) => [item.pluginId, item])).values()
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <RefreshCw className="h-4 w-4 animate-spin mr-2" />
        <span className="text-sm">加载中...</span>
      </div>
    );
  }

  if (plugins.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Package className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">暂无已安装的插件</p>
        <p className="text-xs mt-1">将插件放入插件目录后刷新</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {plugins.map((plugin) => (
        <div
          key={plugin.pluginId}
          className="flex items-center gap-3 rounded-md border p-3"
        >
          <div className="flex-shrink-0">
            <FileCode className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">
                {plugin.label}
              </span>
              <span className="text-xs text-muted-foreground truncate">
                {plugin.pluginId}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">
                contexts: {plugin.contexts?.join(', ') || 'file, folder'}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
