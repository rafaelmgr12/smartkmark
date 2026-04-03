import { RotateCcw, Trash2 } from 'lucide-react';
import SearchInput from '../ui/SearchInput';
import type { NoteMeta } from '../../types';
import { useState } from 'react';

interface TrashNoteListProps {
  notes: NoteMeta[];
  onRestoreNote: (noteId: string, notebookId?: string) => void;
  onPurgeNote: (noteId: string) => void;
}

function formatDeletedAt(value?: string) {
  if (!value) {
    return 'Unknown';
  }

  return new Date(value).toLocaleDateString([], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function TrashNoteList({
  notes,
  onRestoreNote,
  onPurgeNote,
}: TrashNoteListProps) {
  const [search, setSearch] = useState('');

  const filtered = notes.filter((note) => {
    const query = search.toLowerCase();
    return (
      note.title.toLowerCase().includes(query) ||
      (note.trashedFromNotebookId ?? '').toLowerCase().includes(query)
    );
  });

  return (
    <div
      className="workbench-panel-muted flex h-full w-80 shrink-0 flex-col border-r"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      <div
        className="border-b px-4 pt-5 pb-4"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
          Trash
        </p>
        <h2 className="mt-1 text-lg font-semibold text-[var(--text-1)]">
          Deleted Notes
        </h2>
        <p className="mt-2 text-sm text-[var(--text-2)]">
          Restore notes to their notebook or permanently remove them.
        </p>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search trash..."
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
            <p className="text-sm font-medium text-[var(--text-1)]">
              Trash is empty.
            </p>
            <p className="mt-2 text-sm text-[var(--text-2)]">
              Deleted notes stay here until restored or purged.
            </p>
          </div>
        ) : (
          filtered.map((note) => (
            <div
              key={note.id}
              className="rounded-2xl border px-4 py-3"
              style={{
                borderColor: 'var(--card-border)',
                background: 'var(--card-bg)',
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-[var(--text-1)]">
                    {note.title}
                  </h3>
                  <p className="mt-1 text-xs text-[var(--text-dim)]">
                    From {note.trashedFromNotebookId ?? 'Inbox'}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-3)]">
                    Deleted {formatDeletedAt(note.deletedAt)}
                  </p>
                </div>

                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      onRestoreNote(note.id, note.trashedFromNotebookId)
                    }
                    className="rounded-lg border p-1.5 transition"
                    style={{
                      borderColor: 'var(--action-border)',
                      background: 'var(--action-bg)',
                      color: 'var(--success)',
                    }}
                    title="Restore"
                  >
                    <RotateCcw size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Permanently delete "${note.title}" from Trash?`
                        )
                      ) {
                        onPurgeNote(note.id);
                      }
                    }}
                    className="rounded-lg border p-1.5 transition"
                    style={{
                      borderColor: 'var(--action-border)',
                      background: 'var(--action-bg)',
                      color: 'var(--danger)',
                    }}
                    title="Delete permanently"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
