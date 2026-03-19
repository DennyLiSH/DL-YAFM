import { create } from 'zustand';
import { fileService, type EditorInfo } from '@/services/fileService';

interface EditorState {
  editors: EditorInfo[];
  isLoading: boolean;
  isLoaded: boolean;
  loadEditors: () => Promise<void>;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  editors: [],
  isLoading: false,
  isLoaded: false,

  loadEditors: async () => {
    // 防止重复加载
    if (get().isLoaded || get().isLoading) return;

    set({ isLoading: true });
    try {
      const editors = await fileService.getAvailableEditors();
      set({ editors, isLoaded: true, isLoading: false });
    } catch (err) {
      console.error('Failed to detect editors:', err);
      set({ isLoading: false });
    }
  },
}));
