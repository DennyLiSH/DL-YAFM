import { create } from 'zustand';
import { configService, Theme, Language, Settings } from '@/services/configService';

// Helper to apply font to CSS variables
function applyFontToCSS(sansFont?: string, monoFont?: string) {
  const root = document.documentElement;
  if (sansFont) {
    root.style.setProperty('--font-sans', `'${sansFont}', system-ui, sans-serif`);
  }
  if (monoFont) {
    root.style.setProperty('--font-mono', `'${monoFont}', ui-monospace, monospace`);
  }
}

interface SettingsState {
  // State
  theme: Theme;
  language: Language;
  showHiddenFiles: boolean;
  personalIntro: string;
  folderDescriptions: Record<string, string>;
  fontSans: string;
  fontMono: string;
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  initialize: () => Promise<void>;
  setTheme: (theme: Theme) => Promise<void>;
  setLanguage: (language: Language) => Promise<void>;
  setShowHiddenFiles: (show: boolean) => Promise<void>;
  setPersonalIntro: (intro: string) => Promise<void>;
  setFolderDescription: (path: string, description: string) => Promise<void>;
  getFolderDescription: (path: string) => string;
  setFontSans: (font: string) => Promise<void>;
  setFontMono: (font: string) => Promise<void>;
}

// Helper to convert backend format to frontend format
function mapSettingsFromBackend(settings: Settings): Partial<SettingsState> {
  return {
    theme: settings.theme,
    language: settings.language,
    showHiddenFiles: settings.show_hidden_files,
    personalIntro: settings.personal_intro,
    folderDescriptions: settings.folder_descriptions,
    fontSans: settings.font_sans || '',
    fontMono: settings.font_mono || '',
  };
}

// Helper to convert frontend format to backend format
function mapSettingsToBackend(state: SettingsState): Settings {
  return {
    theme: state.theme,
    language: state.language,
    show_hidden_files: state.showHiddenFiles,
    personal_intro: state.personalIntro,
    folder_descriptions: state.folderDescriptions,
    font_sans: state.fontSans || undefined,
    font_mono: state.fontMono || undefined,
  };
}

// Default fonts
const DEFAULT_SANS_FONT = 'LXGW WenKai';
const DEFAULT_MONO_FONT = 'JetBrains Mono';

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  // Default values
  theme: 'system',
  language: 'zh-CN',
  showHiddenFiles: false,
  personalIntro: '',
  folderDescriptions: {},
  fontSans: DEFAULT_SANS_FONT,
  fontMono: DEFAULT_MONO_FONT,
  isLoading: true,
  isInitialized: false,

  initialize: async () => {
    try {
      const settings = await configService.getSettings();
      const mapped = mapSettingsFromBackend(settings);
      // Use defaults if not set
      const fontSans = mapped.fontSans || DEFAULT_SANS_FONT;
      const fontMono = mapped.fontMono || DEFAULT_MONO_FONT;
      set({
        ...mapped,
        fontSans,
        fontMono,
        isLoading: false,
        isInitialized: true,
      });
      // Apply fonts
      applyFontToCSS(fontSans, fontMono);
    } catch (error) {
      console.error('Failed to load settings:', error);
      set({ isLoading: false, isInitialized: true });
    }
  },

  setTheme: async (theme) => {
    const state = get();
    const newSettings = mapSettingsToBackend({ ...state, theme });
    await configService.updateSettings(newSettings);
    set({ theme });
  },

  setLanguage: async (language) => {
    const state = get();
    const newSettings = mapSettingsToBackend({ ...state, language });
    await configService.updateSettings(newSettings);
    set({ language });
  },

  setShowHiddenFiles: async (showHiddenFiles) => {
    const state = get();
    const newSettings = mapSettingsToBackend({ ...state, showHiddenFiles });
    await configService.updateSettings(newSettings);
    set({ showHiddenFiles });
  },

  setPersonalIntro: async (personalIntro) => {
    const state = get();
    const newSettings = mapSettingsToBackend({ ...state, personalIntro });
    await configService.updateSettings(newSettings);
    set({ personalIntro });
  },

  setFolderDescription: async (path, description) => {
    const state = get();
    const newDescriptions = { ...state.folderDescriptions, [path]: description };
    const newSettings = mapSettingsToBackend({ ...state, folderDescriptions: newDescriptions });
    await configService.updateSettings(newSettings);
    set({ folderDescriptions: newDescriptions });
  },

  getFolderDescription: (path) => {
    return get().folderDescriptions[path] || '';
  },

  setFontSans: async (fontSans) => {
    const state = get();
    const newSettings = mapSettingsToBackend({ ...state, fontSans });
    await configService.updateSettings(newSettings);
    set({ fontSans });
    applyFontToCSS(fontSans, state.fontMono);
  },

  setFontMono: async (fontMono) => {
    const state = get();
    const newSettings = mapSettingsToBackend({ ...state, fontMono });
    await configService.updateSettings(newSettings);
    set({ fontMono });
    applyFontToCSS(state.fontSans, fontMono);
  },
}));

export type { Theme, Language };
