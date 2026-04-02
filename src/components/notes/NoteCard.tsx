import { Clock, Pin } from 'lucide-react';
import Badge from '../ui/Badge';
import type { NoteMeta } from '../../types';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface NoteCardProps {
  note: NoteMeta;
  active?: boolean;
  onClick?: () => void;
}

export default function NoteCard({ note, active = false, onClick }: NoteCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
        active
          ? 'border-indigo-500/40 bg-slate-700/50'
          : 'border-transparent hover:bg-slate-800/60'
      }`}
    >
      <div className="flex items-start gap-1.5">
        {note.pinned && <Pin size={12} className="mt-0.5 shrink-0 text-amber-400" />}
        <h3 className="truncate text-sm font-semibold text-slate-200">{note.title}</h3>
      </div>

      <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
        <Clock size={11} />
        <span>{timeAgo(note.updatedAt)}</span>
        <span className="truncate text-slate-600">{note.notebookId}</span>
      </div>

      {note.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {note.tags.map((tag, i) => (
            <Badge key={`${tag.label}-${i}`} label={tag.label} color={tag.color} />
          ))}
        </div>
      )}
    </button>
  );
}
