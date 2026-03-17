/**
 * Format file size to human readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}

/**
 * Format Unix timestamp to readable date string
 */
export function formatDate(timestamp: number | null): string {
  if (!timestamp) return '-';

  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get file icon based on extension or type
 */
export function getFileIcon(entry: { is_dir: boolean; extension: string | null; name: string }): string {
  if (entry.is_dir) {
    if (entry.name.startsWith('.')) return '📁';
    return '📂';
  }

  const ext = entry.extension?.toLowerCase();

  // Images
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(ext || '')) {
    return '🖼️';
  }

  // Documents
  if (['pdf'].includes(ext || '')) return '📄';
  if (['doc', 'docx'].includes(ext || '')) return '📝';
  if (['xls', 'xlsx'].includes(ext || '')) return '📊';
  if (['ppt', 'pptx'].includes(ext || '')) return '📽️';

  // Code
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'rs', 'go', 'rb'].includes(ext || '')) {
    return '💻';
  }
  if (['html', 'css', 'scss', 'json', 'xml', 'yaml', 'yml'].includes(ext || '')) {
    return '📄';
  }

  // Archives
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '')) {
    return '📦';
  }

  // Media
  if (['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(ext || '')) {
    return '🎵';
  }
  if (['mp4', 'avi', 'mkv', 'mov', 'webm'].includes(ext || '')) {
    return '🎬';
  }

  // Executables
  if (['exe', 'msi', 'dmg', 'app', 'deb', 'rpm'].includes(ext || '')) {
    return '⚙️';
  }

  // Hidden files
  if (entry.name.startsWith('.')) {
    return '🙈';
  }

  return '📄';
}
