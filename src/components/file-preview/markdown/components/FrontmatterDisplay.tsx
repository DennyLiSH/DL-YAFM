import { FileText, Calendar, Tags, User, Info } from 'lucide-react';
import type { FrontmatterData } from '../utils/parse-frontmatter';

interface FrontmatterDisplayProps {
  data: FrontmatterData;
}

export function FrontmatterDisplay({ data }: FrontmatterDisplayProps) {
  if (!data || Object.keys(data).length === 0) return null;

  return (
    <div className="mb-4 p-3 bg-muted/50 rounded-lg border text-sm space-y-2">
      {data.title && (
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="font-medium">{String(data.title)}</span>
        </div>
      )}
      {data.author && (
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-muted-foreground shrink-0" />
          <span>{String(data.author)}</span>
        </div>
      )}
      {data.date && (
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
          <span>{String(data.date)}</span>
        </div>
      )}
      {data.description && (
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <span className="text-muted-foreground">{String(data.description)}</span>
        </div>
      )}
      {data.tags && Array.isArray(data.tags) && data.tags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Tags className="w-4 h-4 text-muted-foreground shrink-0" />
          {data.tags.map((tag, index) => (
            <span
              key={index}
              className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs"
            >
              {String(tag)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
