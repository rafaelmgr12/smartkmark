import { BookOpen } from 'lucide-react';
import Badge from '../ui/Badge';
import type { NoteTag } from '../../types';

interface TagBarProps {
  notebook?: string;
  tags: NoteTag[];
}

export default function TagBar({ notebook, tags }: TagBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-700/50 px-5 py-2">
      {notebook && (
        <span className="flex items-center gap-1.5 text-xs text-slate-400">
          <BookOpen size={12} />
          {notebook}
        </span>
      )}
      {notebook && tags.length > 0 && (
        <span className="text-slate-700">·</span>
      )}
      {tags.map((tag) => (
        <Badge key={tag.id} label={tag.label} color={tag.color} />
      ))}
    </div>
  );
}
