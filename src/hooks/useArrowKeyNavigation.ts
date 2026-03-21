import { useEffect, RefObject, useCallback } from 'react';

/**
 * 在对话框中启用左右方向键在按钮间切换焦点
 * @param open 对话框是否打开
 * @param containerRef 包含按钮的容器 ref
 */
export function useArrowKeyNavigation(
  open: boolean,
  containerRef: RefObject<HTMLElement | null>
) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const buttons = containerRef.current?.querySelectorAll('button');
      if (!buttons || buttons.length === 0) return;

      e.preventDefault();
      e.stopPropagation();

      const focusedElement = document.activeElement;
      const currentIndex = Array.from(buttons).findIndex(btn => btn === focusedElement);

      let newIndex: number;
      if (e.key === 'ArrowRight') {
        // 向右循环：当前按钮 -> 下一个按钮，最后一个 -> 第一个
        newIndex = currentIndex < buttons.length - 1 ? currentIndex + 1 : 0;
      } else {
        // 向左循环：当前按钮 -> 上一个按钮，第一个 -> 最后一个
        newIndex = currentIndex > 0 ? currentIndex - 1 : buttons.length - 1;
      }

      buttons[newIndex]?.focus();
    }
  }, [containerRef]);

  useEffect(() => {
    if (!open) return;

    // 使用捕获阶段，确保在其他处理器之前执行
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [open, handleKeyDown]);

  // 对话框打开时，确保焦点在按钮上
  useEffect(() => {
    if (!open) return;

    // 延迟一帧确保 DOM 已渲染
    const timer = requestAnimationFrame(() => {
      const buttons = containerRef.current?.querySelectorAll('button');
      // 如果焦点不在任何按钮上，聚焦第一个按钮
      if (buttons && buttons.length > 0) {
        const focusedElement = document.activeElement;
        const isButtonFocused = Array.from(buttons).some(btn => btn === focusedElement);
        if (!isButtonFocused) {
          buttons[0]?.focus();
        }
      }
    });

    return () => cancelAnimationFrame(timer);
  }, [open, containerRef]);
}
