import { useEffect, useRef, useState } from 'react';

interface MermaidBlockProps {
  code: string;
}

export function MermaidBlock({ code }: MermaidBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const renderDiagram = async () => {
      try {
        // Dynamic import to reduce initial bundle size
        const mermaid = (await import('mermaid')).default;

        // Detect dark mode
        const isDark = document.documentElement.classList.contains('dark');

        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? 'dark' : 'default',
          securityLevel: 'loose',
        });

        const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const { svg } = await mermaid.render(id, code);

        if (mounted && containerRef.current) {
          containerRef.current.innerHTML = svg;
          setIsLoading(false);
        }
      } catch (err) {
        if (mounted) {
          const message = err instanceof Error ? err.message : '渲染失败';
          setError(message);
          setIsLoading(false);
        }
      }
    };

    renderDiagram();

    return () => {
      mounted = false;
    };
  }, [code]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 bg-muted/30 rounded-lg">
        <div className="animate-pulse text-muted-foreground text-sm">
          Loading diagram...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-destructive text-sm p-3 border border-destructive/20 rounded-lg bg-destructive/5">
        <div className="font-medium mb-1">Mermaid 语法错误</div>
        <div className="text-xs opacity-80">{error}</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="mermaid-container flex justify-center overflow-x-auto my-4"
    />
  );
}
