import { useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, Square, X, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SettingsDialog } from '@/components/settings';

export function TitleBar() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleMinimize = () => {
    getCurrentWindow().minimize();
  };

  const handleMaximize = () => {
    getCurrentWindow().toggleMaximize();
  };

  const handleClose = () => {
    getCurrentWindow().close();
  };

  return (
    <div
      data-tauri-drag-region
      className="flex items-center justify-between h-8 bg-background border-b select-none"
    >
      {/* Left: Title + Settings */}
      <div className="flex items-center">
        <div className="flex items-center px-3">
          <span className="text-sm font-medium">DL-YAFM</span>
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded text-sm",
            "hover:bg-muted transition-colors"
          )}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>设置</span>
        </button>
        <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      </div>

      {/* Right: Window Controls */}
      <div className="flex items-center">
        <button
          onClick={handleMinimize}
          className={cn(
            "flex items-center justify-center w-11 h-8",
            "hover:bg-muted transition-colors"
          )}
          aria-label="Minimize"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          onClick={handleMaximize}
          className={cn(
            "flex items-center justify-center w-11 h-8",
            "hover:bg-muted transition-colors"
          )}
          aria-label="Maximize"
        >
          <Square className="w-3 h-3" />
        </button>
        <button
          onClick={handleClose}
          className={cn(
            "flex items-center justify-center w-11 h-8",
            "hover:bg-destructive hover:text-destructive-foreground transition-colors"
          )}
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
