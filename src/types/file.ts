/**
 * 文件或目录条目信息
 */
export interface FileEntry {
  /** 文件或目录名称 */
  readonly name: string;
  /** 完整路径 */
  readonly path: string;
  /** 是否为目录 */
  readonly is_dir: boolean;
  /** 文件大小（字节） */
  readonly size: number;
  /** 最后修改时间戳（毫秒） */
  readonly modified_at: number | null;
  /** 创建时间戳（毫秒） */
  readonly created_at: number | null;
  /** 是否只读 */
  readonly is_readonly: boolean;
  /** 是否隐藏文件 */
  readonly is_hidden: boolean;
  /** 文件扩展名（不含点号），目录为 null */
  readonly extension: string | null;
}

/**
 * 文件浏览器错误类型
 */
export interface FileExplorerError {
  /** 错误类型标识 */
  readonly type: string;
  /** 错误消息 */
  readonly message: string;
}

/**
 * 树节点加载状态
 */
export interface TreeNodeState {
  /** 子节点列表 */
  readonly children: readonly FileEntry[];
  /** 是否已加载完成 */
  readonly isLoaded: boolean;
  /** 是否正在加载中 */
  readonly isLoading: boolean;
  /** 加载错误信息 */
  readonly error?: string;
}

/** 预览类型枚举 */
export type PreviewType = 'text' | 'markdown' | 'image' | 'pdf' | 'unsupported';

/** 图片 MIME 类型映射表 */
export const IMAGE_MIME_TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
} as const satisfies Record<string, string>;

/** 图片扩展名类型 */
export type ImageExtension = keyof typeof IMAGE_MIME_TYPES;
