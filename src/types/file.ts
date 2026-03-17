export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified_at: number | null;
  created_at: number | null;
  is_readonly: boolean;
  is_hidden: boolean;
  extension: string | null;
}

export interface FileExplorerError {
  type: string;
  message: string;
}

export interface TreeNodeState {
  children: FileEntry[];
  isLoaded: boolean;
  isLoading: boolean;
  error?: string;
}

export type PreviewType = 'text' | 'markdown' | 'image' | 'pdf' | 'unsupported';

// MIME type mapping for images
export const IMAGE_MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
};
