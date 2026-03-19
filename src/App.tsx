import { useEffect } from 'react';
import { FileTree } from '@/components/file-tree';
import { FilePreview } from '@/components/file-preview';
import { FileBrowser } from '@/components/file-browser';
import { TitleBar } from '@/components/TitleBar';
import { BookmarkList } from '@/components/bookmarks';
import { ResizablePanel } from '@/components/ui/resizable-panel';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useBookmarkStore } from '@/stores/bookmarkStore';
import { usePluginStore } from '@/stores/pluginStore';
import { useEditorStore } from '@/stores/editorStore';
import { fileService } from '@/services/fileService';
import { detectLegacyData, executeMigration } from '@/utils/migration';
import { Toaster } from '@/components/ui/sonner';
import { Star, FolderTree, PanelRightOpen, PanelRightClose } from 'lucide-react';
import { CopyProgressDialog } from '@/components/dialogs/CopyProgressDialog';

// Module-level flag to prevent multiple initializations across React StrictMode remounts
let isAppInitialized = false;

function App() {
  const { setRootPath, loadRootEntries, previewPanelCollapsed, togglePreviewPanel } = useFileTreeStore();
  const { theme, initialize: initSettings } = useSettingsStore();
  const { initialize: initBookmarks } = useBookmarkStore();
  const { initialize: initPlugins } = usePluginStore();
  const loadEditors = useEditorStore((state) => state.loadEditors);

  // Theme system implementation
  useEffect(() => {
    const root = document.documentElement;

    const applyTheme = (isDark: boolean) => {
      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mediaQuery.matches);

      const handler = (e: MediaQueryListEvent) => applyTheme(e.matches);
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } else {
      applyTheme(theme === 'dark');
    }
  }, [theme]);

  useEffect(() => {
    // Prevent double execution in React StrictMode (using module-level variable)
    if (isAppInitialized) return;
    isAppInitialized = true;

    const initializeApp = async () => {
      // 1. Check and migrate legacy data
      const legacyData = detectLegacyData();
      if (legacyData) {
        console.log('Detected legacy data, migrating...');
        await executeMigration(legacyData);
      }

      // 2. Initialize all stores (load from backend)
      await Promise.all([initSettings(), initBookmarks(), initPlugins()]);

      // 3. Load available editors (singleton cache, only once)
      loadEditors();

      // 4. Prompt user to select a folder
      const path = await fileService.selectAndGrantDirectory();
      if (path) {
        setRootPath(path);
        loadRootEntries();
      }
    };

    initializeApp();
  }, [setRootPath, loadRootEntries, initSettings, initBookmarks, initPlugins, loadEditors]);

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Custom Title Bar */}
      <TitleBar />

      {/* Main Layout - 3 columns resizable */}
      <div className="flex flex-1 overflow-hidden">
        <ResizablePanel
          direction="horizontal"
          storageKey="file-explorer-main-ratio"
          defaultRatio={0.2}
          minSize={0.1}
          maxSize={0.4}
        >
          {/* Left Sidebar - Bookmarks + File Tree */}
          <aside className="h-full border-r flex flex-col bg-muted/30">
            <ResizablePanel
              direction="vertical"
              storageKey="file-explorer-sidebar-ratio"
              defaultRatio={0.4}
            >
              {/* Bookmarks Section */}
              <div className="flex flex-col h-full overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 border-b">
                  <Star className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm font-medium">收藏夹</span>
                </div>
                <div className="flex-1 overflow-auto">
                  <BookmarkList />
                </div>
              </div>

              {/* File Tree Section */}
              <div className="flex flex-col h-full overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 border-b">
                  <FolderTree className="w-4 h-4" />
                  <span className="text-sm font-medium">文件树</span>
                </div>
                <div className="flex-1 overflow-hidden">
                  <FileTree />
                </div>
              </div>
            </ResizablePanel>
          </aside>

          {/* Center + Right Panels */}
          <div className="flex flex-1 h-full overflow-hidden">
            {previewPanelCollapsed ? (
              <>
                {/* Center Panel - File Browser */}
                <main className="h-full border-r flex flex-col flex-1">
                  <FileBrowser />
                </main>
                {/* Expand Button */}
                <button
                  onClick={togglePreviewPanel}
                  className="w-8 h-full flex items-center justify-center border-l border-border hover:bg-accent transition-colors flex-shrink-0"
                  title="展开预览面板"
                >
                  <PanelRightOpen className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <ResizablePanel
                  direction="horizontal"
                  storageKey="file-explorer-center-right-ratio"
                  defaultRatio={0.6}
                  minSize={0.3}
                  maxSize={0.8}
                >
                  {/* Center Panel - File Browser */}
                  <main className="h-full border-r flex flex-col">
                    <FileBrowser />
                  </main>
                  {/* Right Panel - File Preview */}
                  <aside className="h-full flex flex-col min-w-[200px]">
                    <FilePreview />
                  </aside>
                </ResizablePanel>
                {/* Collapse Button */}
                <button
                  onClick={togglePreviewPanel}
                  className="w-8 h-full flex items-center justify-center border-l border-border hover:bg-accent transition-colors flex-shrink-0"
                  title="折叠预览面板"
                >
                  <PanelRightClose className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </ResizablePanel>
      </div>

      {/* Toast notifications */}
      <Toaster />

      {/* Copy progress dialog */}
      <CopyProgressDialog />
    </div>
  );
}

export default App;
