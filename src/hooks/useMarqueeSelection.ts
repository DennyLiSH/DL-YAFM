import { useState, useCallback, useRef, useEffect } from 'react';

interface MarqueeRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface UseMarqueeSelectionOptions<T> {
  containerRef: React.RefObject<HTMLElement | null>;
  itemRefs: Map<string, HTMLElement | null>;
  items: T[];
  getItemId: (item: T) => string;
  onSelectionChange: (selectedIds: string[], isAppend: boolean) => void;
}

interface UseMarqueeSelectionReturn {
  isSelecting: boolean;
  marqueeRect: MarqueeRect | null;
  handleMouseDown: (e: React.MouseEvent) => void;
}

export function useMarqueeSelection<T>({
  containerRef,
  itemRefs,
  items,
  getItemId,
  onSelectionChange,
}: UseMarqueeSelectionOptions<T>): UseMarqueeSelectionReturn {
  const [isSelecting, setIsSelecting] = useState(false);
  const [marqueeRect, setMarqueeRect] = useState<MarqueeRect | null>(null);

  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const isCtrlPressedRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);

  // 获取滚动容器
  const getScrollContainer = useCallback(() => {
    return containerRef.current?.querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement | null;
  }, [containerRef]);

  // 计算两个矩形的交集
  const rectsIntersect = useCallback((rect1: DOMRect, rect2: MarqueeRect): boolean => {
    return !(
      rect1.right < rect2.left ||
      rect1.left > rect2.left + rect2.width ||
      rect1.bottom < rect2.top ||
      rect1.top > rect2.top + rect2.height
    );
  }, []);

  // 更新选中项
  const updateSelection = useCallback((currentRect: MarqueeRect, isAppend: boolean) => {
    const containerBounds = containerRef.current?.getBoundingClientRect();
    if (!containerBounds) return;

    const selectedIds: string[] = [];

    items.forEach((item) => {
      const itemId = getItemId(item);
      const itemEl = itemRefs.get(itemId);
      if (!itemEl) return;

      const itemRect = itemEl.getBoundingClientRect();

      // 将 itemRect 转换为相对于容器的坐标
      const relativeItemRect = new DOMRect(
        itemRect.left - containerBounds.left,
        itemRect.top - containerBounds.top,
        itemRect.width,
        itemRect.height
      );

      if (rectsIntersect(relativeItemRect, currentRect)) {
        selectedIds.push(itemId);
      }
    });

    onSelectionChange(selectedIds, isAppend);
  }, [items, getItemId, itemRefs, containerRef, rectsIntersect, onSelectionChange]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // 只响应左键
    if (e.button !== 0) return;

    // 如果点击的是文件项，不启动框选
    const target = e.target as HTMLElement;
    if (target.closest('[data-file-item]')) return;

    const container = containerRef.current;
    if (!container) return;

    const containerBounds = container.getBoundingClientRect();
    const scrollContainer = getScrollContainer();
    const scrollLeft = scrollContainer?.scrollLeft || 0;
    const scrollTop = scrollContainer?.scrollTop || 0;

    isCtrlPressedRef.current = e.ctrlKey || e.metaKey;

    startPointRef.current = {
      x: e.clientX - containerBounds.left + scrollLeft,
      y: e.clientY - containerBounds.top + scrollTop,
    };

    setIsSelecting(true);
    setMarqueeRect({
      left: startPointRef.current.x,
      top: startPointRef.current.y,
      width: 0,
      height: 0,
    });

    e.preventDefault();
  }, [containerRef, getScrollContainer]);

  useEffect(() => {
    if (!isSelecting) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!startPointRef.current) return;

      // 使用 requestAnimationFrame 节流
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      animationFrameRef.current = requestAnimationFrame(() => {
        if (!startPointRef.current) return;

        const containerBounds = containerRef.current?.getBoundingClientRect();
        if (!containerBounds) return;

        const scrollContainer = getScrollContainer();
        const scrollLeft = scrollContainer?.scrollLeft || 0;
        const scrollTop = scrollContainer?.scrollTop || 0;

        const currentX = e.clientX - containerBounds.left + scrollLeft;
        const currentY = e.clientY - containerBounds.top + scrollTop;

        const left = Math.min(startPointRef.current.x, currentX);
        const top = Math.min(startPointRef.current.y, currentY);
        const width = Math.abs(currentX - startPointRef.current.x);
        const height = Math.abs(currentY - startPointRef.current.y);

        const newRect = { left, top, width, height };
        setMarqueeRect(newRect);

        updateSelection(newRect, isCtrlPressedRef.current);
      });
    };

    const handleMouseUp = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      setIsSelecting(false);
      setMarqueeRect(null);
      startPointRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isSelecting, containerRef, getScrollContainer, updateSelection]);

  return {
    isSelecting,
    marqueeRect,
    handleMouseDown,
  };
}
