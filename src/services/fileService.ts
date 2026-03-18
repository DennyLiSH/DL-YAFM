import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { FileEntry } from '@/types/file';

// Copy progress event payload
export interface CopyProgress {
  task_id: string;
  source: string;
  dest: string;
  current_file: string;
  files_copied: number;
  total_files: number;
  bytes_copied: number;
  total_bytes: number;
  percentage: number;
  speed_mbps: number;
  is_complete: boolean;
  error: string | null;
}

// File change event types
export type FileChangeKind = 'created' | 'modified' | 'deleted' | 'renamed';

// File change event payload from backend
export interface FileChangeEvent {
  directory: string;
  kind: FileChangeKind;
  paths: string[];
  timestamp: number;
}

// Editor information
export interface EditorInfo {
  id: string;
  name: string;
  available: boolean;
}

export const fileService = {
  async getDirectoryEntries(path: string): Promise<FileEntry[]> {
    return invoke('get_directory_entries', { path });
  },

  async createDirectory(path: string): Promise<void> {
    return invoke('create_directory', { path });
  },

  async deleteEntry(path: string, recursive: boolean = false): Promise<void> {
    return invoke('delete_entry', { path, recursive });
  },

  async renameEntry(oldPath: string, newName: string): Promise<void> {
    return invoke('rename_entry', { oldPath, newName });
  },

  async copyFile(source: string, dest: string): Promise<void> {
    return invoke('copy_file', { source, dest });
  },

  async searchFiles(directory: string, query: string): Promise<FileEntry[]> {
    return invoke('search_files', { directory, query });
  },

  async grantDirectoryAccess(path: string): Promise<void> {
    return invoke('grant_directory_access', { path });
  },

  async selectDirectory(): Promise<string | null> {
    // Use Tauri dialog plugin dynamically
    const { open } = await import('@tauri-apps/plugin-dialog');
    const result = await open({
      directory: true,
      multiple: false,
      title: '选择文件夹',
    });
    return result as string | null;
  },

  async selectAndGrantDirectory(): Promise<string | null> {
    const path = await this.selectDirectory();
    if (path) {
      await this.grantDirectoryAccess(path);
    }
    return path;
  },

  async readFileContent(path: string): Promise<string> {
    return invoke('read_file_content', { path });
  },

  async readFileAsBase64(path: string): Promise<string> {
    return invoke('read_file_as_base64', { path });
  },

  async createFile(path: string): Promise<void> {
    return invoke('create_file', { path });
  },

  async copyEntry(source: string, dest: string): Promise<void> {
    return invoke('copy_entry', { source, dest });
  },

  // Async copy with progress events
  async copyEntryAsync(taskId: string, source: string, dest: string): Promise<void> {
    return invoke('copy_entry_async', { taskId, source, dest });
  },

  // Cancel a copy task
  async cancelCopyTask(taskId: string): Promise<boolean> {
    return invoke('cancel_copy_task', { taskId });
  },

  // Listen to copy progress events
  onCopyProgress(callback: (progress: CopyProgress) => void): Promise<UnlistenFn> {
    return listen<CopyProgress>('copy-progress', (event) => {
      callback(event.payload);
    });
  },

  // Check if a path exists
  async checkPathExists(path: string): Promise<boolean> {
    return invoke('check_path_exists', { path });
  },

  // Move entry (file or directory) to a new location
  async moveEntry(source: string, dest: string): Promise<void> {
    return invoke('move_entry', { source, dest });
  },

  // === File Watch Commands ===

  // Start watching a directory
  async startWatch(path: string): Promise<void> {
    return invoke('start_watch', { path });
  },

  // Stop watching a directory
  async stopWatch(path: string): Promise<void> {
    return invoke('stop_watch', { path });
  },

  // Update all watched paths at once
  async updateWatchPaths(paths: string[]): Promise<void> {
    return invoke('update_watch_paths', { paths });
  },

  // Stop all watching
  async stopAllWatch(): Promise<void> {
    return invoke('stop_all_watch');
  },

  // Get currently watched paths
  async getWatchedPaths(): Promise<string[]> {
    return invoke('get_watched_paths');
  },

  // Listen to file change events
  onFileChange(callback: (event: FileChangeEvent) => void): Promise<UnlistenFn> {
    return listen<FileChangeEvent>('fs-change', (event) => {
      callback(event.payload);
    });
  },

  // Open file with system default application (with security check)
  async openWithSystemApp(path: string): Promise<void> {
    return invoke('open_file_safe', { path });
  },

  // Get available editors on the system
  async getAvailableEditors(): Promise<EditorInfo[]> {
    return invoke('detect_editors');
  },

  // Open path with a specific editor
  async openWithEditor(path: string, editorId: string): Promise<void> {
    return invoke('open_with_editor', { path, editorId });
  },
};
