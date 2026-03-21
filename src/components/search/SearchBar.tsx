import { useState, useEffect, useCallback, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X, Loader2 } from 'lucide-react';
import { useFileTreeStore } from '@/stores/fileTreeStore';

export function SearchBar() {
  const [query, setQuery] = useState('');
  const { search, isSearching, rootPath, cancelSearch } = useFileTreeStore();
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search with cancellation
  const debouncedSearch = useCallback(
    (value: string) => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      if (value.trim() && rootPath) {
        searchTimeoutRef.current = setTimeout(() => {
          search(value);
        }, 300);
      }
    },
    [search, rootPath]
  );

  useEffect(() => {
    if (query.trim()) {
      debouncedSearch(query);
    }
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, debouncedSearch]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSearching) {
        cancelSearch();
        setQuery('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearching, cancelSearch]);

  const handleClear = () => {
    if (isSearching) {
      cancelSearch();
    }
    setQuery('');
  };

  return (
    <div className="relative flex items-center gap-2 w-64">
      <div className="relative flex-1">
        {isSearching ? (
          <Loader2 className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
        ) : (
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        )}
        <Input
          placeholder="搜索文件..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-8 pr-8"
        />
        {(query || isSearching) && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6"
            onClick={handleClear}
            title={isSearching ? "取消搜索" : "清除"}
          >
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>
      {isSearching && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            cancelSearch();
            setQuery('');
          }}
          className="text-xs h-7 px-2"
        >
          取消
        </Button>
      )}
    </div>
  );
}
