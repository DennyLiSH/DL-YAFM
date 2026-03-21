import { invoke } from '@tauri-apps/api/core';

// ==================== Types ====================

/** 应用主题类型 */
export type Theme = 'light' | 'dark' | 'system';

/** 支持的语言类型 */
export type Language = 'zh-CN' | 'en-US';

/** 聊天消息角色 */
export type ChatRole = 'user' | 'assistant';

/** 应用设置配置 */
export interface Settings {
  theme: Theme;
  language: Language;
  show_hidden_files: boolean;
  personal_intro: string;
  folder_descriptions: Record<string, string>;
  font_sans?: string;
  font_mono?: string;
}

/** 书签条目 */
export interface Bookmark {
  id: string;
  name: string;
  path: string;
  created_at: number;
}

/** 聊天消息 */
export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: number;
}

// ==================== Settings ====================

export async function getSettings(): Promise<Settings> {
  return invoke('get_settings');
}

export async function updateSettings(settings: Settings): Promise<void> {
  return invoke('update_settings', { settings });
}

// ==================== Bookmarks ====================

export async function getBookmarks(): Promise<Bookmark[]> {
  return invoke('get_bookmarks');
}

export async function addBookmark(name: string, path: string): Promise<Bookmark> {
  return invoke('add_bookmark', { name, path });
}

export async function removeBookmark(id: string): Promise<void> {
  return invoke('remove_bookmark', { id });
}

// ==================== Chat ====================

export async function getChatMessages(): Promise<ChatMessage[]> {
  return invoke('get_chat_messages');
}

export async function addChatMessage(role: ChatRole, content: string): Promise<ChatMessage> {
  return invoke('add_chat_message', { role, content });
}

export async function clearChatMessages(): Promise<void> {
  return invoke('clear_chat_messages');
}

// ==================== Migration ====================

export async function migrateFromLocalStorage(
  settingsJson?: string,
  bookmarksJson?: string,
  chatJson?: string
): Promise<void> {
  return invoke('migrate_from_local_storage', {
    settingsJson,
    bookmarksJson,
    chatJson,
  });
}

// ==================== Config Service Object ====================

export const configService = {
  // Settings
  getSettings,
  updateSettings,

  // Bookmarks
  getBookmarks,
  addBookmark,
  removeBookmark,

  // Chat
  getChatMessages,
  addChatMessage,
  clearChatMessages,

  // Migration
  migrateFromLocalStorage,
};
