import { useState } from 'react';
import { Pin, Plus, Trash2 } from 'lucide-react';
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

  const filtered = notes.filter((note) =>
    note.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      className="workbench-panel-muted flex h-full w-80 shrink-0 flex-col border-r"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      <div
        className="border-b px-4 pt-5 pb-4"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
              Notes
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--text-1)]">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onCreateNote}
            className="ghost-button h-10 w-10 justify-center p-0"
            title="New Note (Ctrl+N)"
            aria-label="Create note"
          >
            <Plus size={16} />
          </button>
        </div>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search notes..."
          className="mt-3"
        />
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {filtered.length === 0 ? (
          <div
            className="rounded-2xl border px-4 py-8 text-center"
            style={{
              borderColor: 'var(--border-subtle)',
              background: 'var(--card-bg)',
            }}
          >
            <p className="text-sm font-medium text-[var(--text-1)]">No notes found.</p>
            <p className="mt-2 text-sm text-[var(--text-2)]">
              Try another query or create a fresh note in this workspace.
            </p>
          </div>
        ) : (
          filtered.map((note) => (
            <div key={note.id} className="group relative">
              <NoteCard
                note={note}
                active={note.id === selectedNoteId}
                onClick={() => onNoteSelect(note.id)}
              />

              <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onTogglePin(note.id);
                  }}
                  className="rounded-lg border p-1.5 transition"
                  style={{
                    borderColor: 'var(--action-border)',
                    background: 'var(--action-bg)',
                    color: note.pinned ? 'var(--warning)' : 'var(--text-3)',
                  }}
                  title={note.pinned ? 'Unpin' : 'Pin'}
                >
                  <Pin size={12} />
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (window.confirm(`Delete note "${note.title}"?`)) {
                      onDeleteNote(note.notebookId, note.id);
                    }
                  }}
                  className="rounded-lg border p-1.5 transition"
                  style={{
                    borderColor: 'var(--action-border)',
                    background: 'var(--action-bg)',
                    color: 'var(--danger)',
                  }}
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
