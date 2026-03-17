import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';

interface ResizablePanelProps {
  direction: 'vertical' | 'horizontal';
  storageKey?: string;
  defaultRatio?: number;
  minSize?: number;
  maxSize?: number;
  children: [ReactNode, ReactNode];
  className?: string;
}

export function ResizablePanel({
  direction,
  storageKey,
  defaultRatio = 0.5,
  minSize = 0.1,
  maxSize = 0.9,
  children,
  className = '',
}: ResizablePanelProps) {
  const [ratio, setRatio] = useState(() => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= minSize && parsed <= maxSize) {
          return parsed;
        }
      }
    }
    return defaultRatio;
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = direction === 'vertical' ? 'ns-resize' : 'ew-resize';
    document.body.style.userSelect = 'none';
  }, [direction]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    let newRatio: number;

    if (direction === 'vertical') {
      newRatio = (e.clientY - rect.top) / rect.height;
    } else {
      newRatio = (e.clientX - rect.left) / rect.width;
    }

    // Clamp ratio
    newRatio = Math.max(minSize, Math.min(maxSize, newRatio));
    setRatio(newRatio);

    if (storageKey) {
      localStorage.setItem(storageKey, newRatio.toString());
    }
  }, [direction, minSize, maxSize, storageKey]);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const isVertical = direction === 'vertical';

  return (
    <div
      ref={containerRef}
      className={`flex ${isVertical ? 'flex-col' : 'flex-row'} h-full w-full ${className}`}
    >
      {/* First panel */}
      <div
        style={{ [isVertical ? 'height' : 'width']: `${ratio * 100}%` }}
        className="overflow-hidden"
      >
        {children[0]}
      </div>

      {/* Divider */}
      <div
        className={`
          flex-shrink-0 bg-border hover:bg-primary/50 transition-colors
          ${isVertical ? 'h-1 cursor-ns-resize' : 'w-1 cursor-ew-resize'}
        `}
        onMouseDown={handleMouseDown}
      />

      {/* Second panel */}
      <div
        className="flex-1 overflow-hidden"
      >
        {children[1]}
      </div>
    </div>
  );
}
