import { SHORTCUTS_BY_CATEGORY, formatShortcut } from '@/config/shortcuts';
import { Keyboard } from 'lucide-react';

export function ShortcutSettings() {
  const categories = Object.keys(SHORTCUTS_BY_CATEGORY);

  return (
    <div className="space-y-6 py-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Keyboard className="w-4 h-4" />
        <span className="text-xs">应用支持的快捷键列表</span>
      </div>

      {categories.map((category) => {
        const shortcuts = SHORTCUTS_BY_CATEGORY[category];
        if (!shortcuts) return null;

        return (
          <div key={category} className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground border-b pb-1">
              {category}
            </h3>
            <div className="space-y-1">
              {shortcuts.map((shortcut) => (
                <div
                  key={shortcut.id}
                  className="flex items-center justify-between py-1.5"
                >
                  <span className="text-sm">{shortcut.description}</span>
                  <kbd className="px-2 py-0.5 text-xs font-mono bg-muted rounded border">
                    {formatShortcut(shortcut)}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
