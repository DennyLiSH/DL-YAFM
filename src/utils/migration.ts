import { configService } from '@/services/configService';

const OLD_STORAGE_KEYS = {
  settings: 'test-fm-settings',
  bookmarks: 'test-fm-bookmarks',
  chat: 'test-fm-chat',
};

const MIGRATION_FLAG = 'test-fm-migrated';

interface ZustandPersistData<T> {
  state: T;
  version: number;
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
      const parsed = JSON.parse(settingsRaw) as ZustandPersistData<LegacySettings>;
      const state = parsed.state || parsed;
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
    } catch (e) {
      console.error('Failed to parse settings:', e);
    }
  }

  // Read bookmarks
  const bookmarksRaw = localStorage.getItem(OLD_STORAGE_KEYS.bookmarks);
  if (bookmarksRaw) {
    try {
      const parsed = JSON.parse(bookmarksRaw) as ZustandPersistData<{ bookmarks: LegacyBookmark[] }>;
      const bookmarks = parsed.state?.bookmarks || (parsed as unknown as { bookmarks: LegacyBookmark[] }).bookmarks || [];
      // Convert createdAt to created_at
      const backendData = bookmarks.map((b) => ({
        id: b.id,
        name: b.name,
        path: b.path,
        created_at: b.createdAt || Date.now(),
      }));
      data.bookmarks = JSON.stringify(backendData);
      hasData = true;
    } catch (e) {
      console.error('Failed to parse bookmarks:', e);
    }
  }

  // Read chat
  const chatRaw = localStorage.getItem(OLD_STORAGE_KEYS.chat);
  if (chatRaw) {
    try {
      const parsed = JSON.parse(chatRaw) as ZustandPersistData<{ messages: LegacyChatMessage[] }>;
      const messages = parsed.state?.messages || (parsed as unknown as { messages: LegacyChatMessage[] }).messages || [];
      // Chat message format is the same
      data.chat = JSON.stringify(messages);
      hasData = true;
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
