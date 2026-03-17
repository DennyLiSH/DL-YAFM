import { create } from 'zustand';
import { configService, Theme, Language, Settings } from '@/services/configService';

interface SettingsState {
  // State
  theme: Theme;
  language: Language;
  showHiddenFiles: boolean;
  personalIntro: string;
  folderDescriptions: Record<string, string>;
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
}

// Helper to convert backend format to frontend format
function mapSettingsFromBackend(settings: Settings): Partial<SettingsState> {
  return {
    theme: settings.theme,
    language: settings.language,
    showHiddenFiles: settings.show_hidden_files,
    personalIntro: settings.personal_intro,
    folderDescriptions: settings.folder_descriptions,
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
  };
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  // Default values
  theme: 'system',
  language: 'zh-CN',
  showHiddenFiles: false,
  personalIntro: '',
  folderDescriptions: {},
  isLoading: true,
  isInitialized: false,

  initialize: async () => {
    try {
      const settings = await configService.getSettings();
      const mapped = mapSettingsFromBackend(settings);
      set({
        ...mapped,
        isLoading: false,
        isInitialized: true,
      });
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
}));

export type { Theme, Language };
