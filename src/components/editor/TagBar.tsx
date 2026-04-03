import { BookOpen } from 'lucide-react';
import Badge from '../ui/Badge';
import type { NoteTag } from '../../types';

interface TagBarProps {
  notebook?: string;
  tags: NoteTag[];
}

export default function TagBar({ notebook, tags }: TagBarProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-2 border-b px-5 py-2"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      {notebook && (
        <span
          className="flex items-center gap-1.5 text-xs"
          style={{ color: 'var(--text-2)' }}
        >
          <BookOpen size={12} />
          {notebook}
        </span>
      )}
      {notebook && tags.length > 0 && (
        <span style={{ color: 'var(--text-dim)' }}>·</span>
      )}
      {tags.map((tag) => (
        <Badge key={tag.label} label={tag.label} color={tag.color} />
      ))}
    </div>
  );
}
