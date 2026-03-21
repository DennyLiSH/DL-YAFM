import { useEffect, useCallback } from 'react';

export interface HotkeyOptions {
  /** 是否需要 Ctrl/Cmd 键 */
  ctrl?: boolean;
  /** 是否需要 Alt 键 */
  alt?: boolean;
  /** 是否需要 Shift 键 */
  shift?: boolean;
  /** 是否启用 */
  enabled?: boolean;
  /** 是否阻止默认行为 */
  preventDefault?: boolean;
  /** 是否忽略输入框中的事件 */
  ignoreInputs?: boolean;
  /** 作用域选择器，只在匹配的元素内触发 */
  scope?: string;
}

/**
 * 统一的快捷键处理 Hook
 *
 * @example
 * // 简单按键
 * useHotkey('Escape', () => console.log('Escape pressed'));
 *
 * @example
 * // 组合键
 * useHotkey('s', () => console.log('Save'), { ctrl: true });
 *
 * @example
 * // 忽略输入框
 * useHotkey('Delete', handleDelete, { ignoreInputs: true });
 */
export function useHotkey(
  key: string,
  callback: (e: KeyboardEvent) => void,
  options: HotkeyOptions = {}
) {
  const {
    ctrl = false,
    alt = false,
    shift = false,
    enabled = true,
    preventDefault = true,
    ignoreInputs = false,
    scope,
  } = options;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;

      // 检查作用域
      if (scope) {
        const scopeElement = target.closest(scope);
        if (!scopeElement) return;
      }

      // 检查是否忽略输入框
      if (ignoreInputs && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      // 检查按键匹配
      const keyMatch = e.key.toLowerCase() === key.toLowerCase() ||
                       e.key === key;

      // Ctrl/Cmd 键匹配（Mac 上 Cmd 相当于 Ctrl）
      const ctrlMatch = ctrl
        ? e.ctrlKey || e.metaKey
        : !e.ctrlKey && !e.metaKey;

      const altMatch = alt ? e.altKey : !e.altKey;
      const shiftMatch = shift ? e.shiftKey : !e.shiftKey;

      if (keyMatch && ctrlMatch && altMatch && shiftMatch) {
        if (preventDefault) {
          e.preventDefault();
        }
        callback(e);
      }
    },
    [key, ctrl, alt, shift, preventDefault, ignoreInputs, scope, callback]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);
}

/**
 * 检查键盘事件是否匹配指定快捷键
 */
export function matchesHotkey(
  e: KeyboardEvent,
  key: string,
  options: Omit<HotkeyOptions, 'enabled' | 'preventDefault' | 'ignoreInputs' | 'scope'> = {}
): boolean {
  const { ctrl = false, alt = false, shift = false } = options;

  const keyMatch = e.key.toLowerCase() === key.toLowerCase() || e.key === key;
  const ctrlMatch = ctrl ? e.ctrlKey || e.metaKey : !e.ctrlKey && !e.metaKey;
  const altMatch = alt ? e.altKey : !e.altKey;
  const shiftMatch = shift ? e.shiftKey : !e.shiftKey;

  return keyMatch && ctrlMatch && altMatch && shiftMatch;
}
