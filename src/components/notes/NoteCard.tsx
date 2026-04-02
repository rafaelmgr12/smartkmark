import { Clock } from 'lucide-react';
import Badge from '../ui/Badge';
import type { Note } from '../../types';

interface NoteCardProps {
  note: Note;
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
      <h3 className="truncate text-sm font-semibold text-slate-200">{note.title}</h3>

      <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
        <Clock size={11} />
        <span>{note.updatedAt}</span>
        {note.tags.length > 0 && (
          <>
            <span className="text-slate-600">·</span>
            <span className="truncate">
              {note.tags.map((t) => t.label).join(', ')}
            </span>
          </>
        )}
      </div>

      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-500">
        {note.body}
      </p>

      {note.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {note.tags.map((tag) => (
            <Badge key={tag.id} label={tag.label} color={tag.color} />
          ))}
        </div>
      )}
    </button>
  );
}
