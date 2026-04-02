import { useState } from 'react';
import { Plus, Trash2, Pin } from 'lucide-react';
import SearchInput from '../ui/SearchInput';
import NoteCard from './NoteCard';
import type { NoteMeta } from '../../types';

interface NoteListProps {
  title: string;
  notes: NoteMeta[];
  selectedNoteId: string | null;
  onNoteSelect: (noteId: string) => void;
  onCreateNote: () => void;
  onDeleteNote: (notebookId: string, noteId: string) => void;
  onTogglePin: (noteId: string) => void;
}

export default function NoteList({
  title,
  notes,
  selectedNoteId,
  onNoteSelect,
  onCreateNote,
  onDeleteNote,
  onTogglePin,
}: NoteListProps) {
  const [search, setSearch] = useState('');

  const filtered = notes.filter((n) =>
    n.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-full w-72 shrink-0 flex-col border-r border-slate-700/50 bg-slate-850">
      {/* Header */}
      <div className="border-b border-slate-700/50 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-200">{title}</h2>
          <button
            type="button"
            onClick={onCreateNote}
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-700 hover:text-slate-200"
            title="New Note (Ctrl+N)"
          >
            <Plus size={16} />
          </button>
        </div>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search..."
          className="mt-3"
        />
      </div>

      {/* Note cards */}
      <div className="flex-1 space-y-1 overflow-y-auto px-2 py-2">
        {filtered.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-slate-600">
            No notes found.
          </p>
        ) : (
          filtered.map((note) => (
            <div key={note.id} className="group relative">
              <NoteCard
                note={note}
                active={note.id === selectedNoteId}
                onClick={() => onNoteSelect(note.id)}
              />
              {/* Quick actions overlay */}
              <div className="absolute right-2 top-2 flex gap-0.5 opacity-0 transition group-hover:opacity-100">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTogglePin(note.id);
                  }}
                  className={`rounded p-1 transition ${
                    note.pinned
                      ? 'text-amber-400 hover:text-amber-300'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                  title={note.pinned ? 'Unpin' : 'Pin'}
                >
                  <Pin size={12} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteNote(note.notebookId, note.id);
                  }}
                  className="rounded p-1 text-slate-500 transition hover:text-red-400"
                  title="Delete"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
