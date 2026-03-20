import { configService } from '@/services/configService';

const OLD_STORAGE_KEYS = {
  settings: 'test-fm-settings',
  bookmarks: 'test-fm-bookmarks',
  chat: 'test-fm-chat',
};

const MIGRATION_FLAG = 'test-fm-migrated';

interface ZustandPersistData<T> {
  state?: T;
  version?: number;
}

interface LegacySettings {
  theme?: string;
  language?: string;
  showHiddenFiles?: boolean;
  personalIntro?: string;
  folderDescriptions?: Record<string, string>;
}

interface LegacyBookmark {
  id: string;
  name: string;
  path: string;
  createdAt: number;
}

interface LegacyChatMessage {
  id: string;
  role: string;
  content: string;
  timestamp: number;
}

/** Type guard: check if data has bookmarks directly (legacy format) */
function hasBookmarksDirect(data: unknown): data is { bookmarks: LegacyBookmark[] } {
  return (
    typeof data === 'object' &&
    data !== null &&
    'bookmarks' in data &&
    Array.isArray((data as Record<string, unknown>)['bookmarks'])
  );
}

/** Type guard: check if data has messages directly (legacy format) */
function hasMessagesDirect(data: unknown): data is { messages: LegacyChatMessage[] } {
  return (
    typeof data === 'object' &&
    data !== null &&
    'messages' in data &&
    Array.isArray((data as Record<string, unknown>)['messages'])
  );
}

/** Type guard: check if data has settings directly (legacy format) */
function hasSettingsDirect(data: unknown): data is LegacySettings {
  return (
    typeof data === 'object' &&
    data !== null &&
    ('theme' in data || 'language' in data || 'showHiddenFiles' in data)
  );
}

export interface MigrationData {
  settings?: string;
  bookmarks?: string;
  chat?: string;
}

/**
 * Check if there is legacy data in localStorage that needs migration
 */
export function detectLegacyData(): MigrationData | null {
  // Check if already migrated
  if (localStorage.getItem(MIGRATION_FLAG)) {
    return null;
  }

  const data: MigrationData = {};
  let hasData = false;

  // Read settings
  const settingsRaw = localStorage.getItem(OLD_STORAGE_KEYS.settings);
  if (settingsRaw) {
    try {
      const parsed: unknown = JSON.parse(settingsRaw);
      let state: LegacySettings | undefined;

      if (typeof parsed === 'object' && parsed !== null) {
        const persistData = parsed as ZustandPersistData<LegacySettings>;
        if (persistData.state) {
          state = persistData.state;
        } else if (hasSettingsDirect(parsed)) {
          state = parsed;
        }
      }

      if (state) {
        // Convert camelCase to snake_case for backend
        const backendData = {
          theme: state.theme || 'system',
          language: state.language || 'zh-CN',
          show_hidden_files: state.showHiddenFiles || false,
          personal_intro: state.personalIntro || '',
          folder_descriptions: state.folderDescriptions || {},
        };
        data.settings = JSON.stringify(backendData);
        hasData = true;
      }
    } catch (e) {
      console.error('Failed to parse settings:', e);
    }
  }

  // Read bookmarks
  const bookmarksRaw = localStorage.getItem(OLD_STORAGE_KEYS.bookmarks);
  if (bookmarksRaw) {
    try {
      const parsed: unknown = JSON.parse(bookmarksRaw);
      let bookmarks: LegacyBookmark[] = [];

      if (typeof parsed === 'object' && parsed !== null) {
        const persistData = parsed as ZustandPersistData<{ bookmarks: LegacyBookmark[] }>;
        if (persistData.state?.bookmarks) {
          bookmarks = persistData.state.bookmarks;
        } else if (hasBookmarksDirect(parsed)) {
          bookmarks = parsed.bookmarks;
        }
      }

      if (bookmarks.length > 0) {
        // Convert createdAt to created_at
        const backendData = bookmarks.map((b) => ({
          id: b.id,
          name: b.name,
          path: b.path,
          created_at: b.createdAt || Date.now(),
        }));
        data.bookmarks = JSON.stringify(backendData);
        hasData = true;
      }
    } catch (e) {
      console.error('Failed to parse bookmarks:', e);
    }
  }

  // Read chat
  const chatRaw = localStorage.getItem(OLD_STORAGE_KEYS.chat);
  if (chatRaw) {
    try {
      const parsed: unknown = JSON.parse(chatRaw);
      let messages: LegacyChatMessage[] = [];

      if (typeof parsed === 'object' && parsed !== null) {
        const persistData = parsed as ZustandPersistData<{ messages: LegacyChatMessage[] }>;
        if (persistData.state?.messages) {
          messages = persistData.state.messages;
        } else if (hasMessagesDirect(parsed)) {
          messages = parsed.messages;
        }
      }

      if (messages.length > 0) {
        // Chat message format is the same
        data.chat = JSON.stringify(messages);
        hasData = true;
      }
    } catch (e) {
      console.error('Failed to parse chat:', e);
    }
  }

  return hasData ? data : null;
}

/**
 * Execute migration from localStorage to backend
 */
export async function executeMigration(data: MigrationData): Promise<boolean> {
  try {
    await configService.migrateFromLocalStorage(
      data.settings,
      data.bookmarks,
      data.chat
    );

    // Clear old localStorage data
    Object.values(OLD_STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(key);
    });

    // Mark as migrated
    localStorage.setItem(MIGRATION_FLAG, 'true');

    console.log('Migration completed successfully');
    return true;
  } catch (error) {
    console.error('Migration failed:', error);
    return false;
  }
}

/**
 * Check if migration has been done
 */
export function isMigrated(): boolean {
  return !!localStorage.getItem(MIGRATION_FLAG);
}
