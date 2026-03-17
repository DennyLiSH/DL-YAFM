import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { GlobalSettings } from './GlobalSettings';
import { FolderSettings } from './FolderSettings';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="global" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="global" className="flex-1">
              全局设置
            </TabsTrigger>
            <TabsTrigger value="folder" className="flex-1">
              文件夹设置
            </TabsTrigger>
            <TabsTrigger value="feature-a" className="flex-1">
              A 功能
            </TabsTrigger>
          </TabsList>
          <TabsContent value="global">
            <GlobalSettings />
          </TabsContent>
          <TabsContent value="folder">
            <FolderSettings />
          </TabsContent>
          <TabsContent value="feature-a">
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <p className="text-sm">功能开发中...</p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
