/**
 * 从 Tauri 错误对象中提取错误消息
 * Tauri 返回的错误格式可能是：
 * - 字符串
 * - { message: string }
 * - { error: string }
 * - Error 对象
 */
export function getErrorMessage(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null) {
    const obj = err as Record<string, unknown>;
    if (typeof obj['message'] === 'string') return obj['message'];
    if (typeof obj['error'] === 'string') return obj['error'];
  }
  return '未知错误';
}
