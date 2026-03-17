import { create } from 'zustand';
import { configService, Bookmark } from '@/services/configService';

interface BookmarkState {
  bookmarks: Bookmark[];
  isLoading: boolean;
  isInitialized: boolean;

  initialize: () => Promise<void>;
  addBookmark: (name: string, path: string) => Promise<void>;
  removeBookmark: (id: string) => Promise<void>;
  isBookmarked: (path: string) => boolean;
}

export const useBookmarkStore = create<BookmarkState>()((set, get) => ({
  bookmarks: [],
  isLoading: true,
  isInitialized: false,

  initialize: async () => {
    try {
      const bookmarks = await configService.getBookmarks();
      set({
        bookmarks,
        isLoading: false,
        isInitialized: true,
      });
    } catch (error) {
      console.error('Failed to load bookmarks:', error);
      set({ isLoading: false, isInitialized: true });
    }
  },

  addBookmark: async (name, path) => {
    const { bookmarks } = get();
    // Check if already bookmarked (optimistic check)
    if (bookmarks.some((b) => b.path === path)) {
      return;
    }

    try {
      const newBookmark = await configService.addBookmark(name, path);
      set({ bookmarks: [...bookmarks, newBookmark] });
    } catch (error) {
      console.error('Failed to add bookmark:', error);
    }
  },

  removeBookmark: async (id) => {
    const { bookmarks } = get();
    try {
      await configService.removeBookmark(id);
      set({ bookmarks: bookmarks.filter((b) => b.id !== id) });
    } catch (error) {
      console.error('Failed to remove bookmark:', error);
    }
  },

  isBookmarked: (path) => {
    return get().bookmarks.some((b) => b.path === path);
  },
}));
