/**
 * 文件或目录条目信息
 */
export interface FileEntry {
  /** 文件或目录名称 */
  name: string;
  /** 完整路径 */
  path: string;
  /** 是否为目录 */
  is_dir: boolean;
  /** 文件大小（字节） */
  size: number;
  /** 最后修改时间戳（毫秒） */
  modified_at: number | null;
  /** 创建时间戳（毫秒） */
  created_at: number | null;
  /** 是否只读 */
  is_readonly: boolean;
  /** 是否隐藏文件 */
  is_hidden: boolean;
  /** 文件扩展名（不含点号），目录为 null */
  extension: string | null;
}

/**
 * 文件浏览器错误类型
 */
export interface FileExplorerError {
  /** 错误类型标识 */
  type: string;
  /** 错误消息 */
  message: string;
}

/**
 * 树节点加载状态
 */
export interface TreeNodeState {
  /** 子节点列表 */
  children: FileEntry[];
  /** 是否已加载完成 */
  isLoaded: boolean;
  /** 是否正在加载中 */
  isLoading: boolean;
  /** 加载错误信息 */
  error?: string;
}

/** 预览类型枚举 */
export type PreviewType = 'text' | 'markdown' | 'image' | 'pdf' | 'unsupported';

/** 图片 MIME 类型映射表 */
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
