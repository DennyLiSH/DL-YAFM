import { useSettingsStore, Theme, Language } from '@/stores/settingsStore';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

/** Type guard for Theme values */
const isValidTheme = (value: string): value is Theme =>
  value === 'light' || value === 'dark' || value === 'system';

/** Type guard for Language values */
const isValidLanguage = (value: string): value is Language =>
  value === 'zh-CN' || value === 'en-US';

export function GlobalSettings() {
  const {
    theme,
    language,
    showHiddenFiles,
    personalIntro,
    setTheme,
    setLanguage,
    setShowHiddenFiles,
    setPersonalIntro,
  } = useSettingsStore();

  /** Handle theme change with type guard */
  const handleThemeChange = (v: string | null) => {
    if (v !== null && isValidTheme(v)) {
      setTheme(v);
    }
  };

  /** Handle language change with type guard */
  const handleLanguageChange = (v: string | null) => {
    if (v !== null && isValidLanguage(v)) {
      setLanguage(v);
    }
  };

  return (
    <div className="space-y-6 py-4">
      {/* 主题设置 */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <label className="text-sm font-medium">主题</label>
          <p className="text-xs text-muted-foreground">选择应用的显示主题</p>
        </div>
        <Select value={theme} onValueChange={handleThemeChange}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="light">亮色</SelectItem>
            <SelectItem value="dark">暗色</SelectItem>
            <SelectItem value="system">跟随系统</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 语言设置 */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <label className="text-sm font-medium">语言</label>
          <p className="text-xs text-muted-foreground">选择应用的语言</p>
        </div>
        <Select value={language} onValueChange={handleLanguageChange}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="zh-CN">简体中文</SelectItem>
            <SelectItem value="en-US">English</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 显示隐藏文件 */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <label className="text-sm font-medium">显示隐藏文件</label>
          <p className="text-xs text-muted-foreground">是否显示以 . 开头的隐藏文件</p>
        </div>
        <Switch
          checked={showHiddenFiles}
          onCheckedChange={setShowHiddenFiles}
        />
      </div>

      {/* 个人介绍 */}
      <div className="space-y-2">
        <div className="space-y-0.5">
          <label className="text-sm font-medium">个人介绍</label>
          <p className="text-xs text-muted-foreground">介绍一下你自己</p>
        </div>
        <Textarea
          placeholder="在这里输入个人介绍..."
          value={personalIntro}
          onChange={(e) => setPersonalIntro(e.target.value)}
          className="min-h-[100px] resize-none"
        />
      </div>
    </div>
  );
}
