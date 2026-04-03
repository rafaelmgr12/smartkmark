import { useEffect, useMemo, useRef, useState } from 'react';
import { Command, FileText, Hash, Search } from 'lucide-react';
import Badge from '../ui/Badge';
import { searchQuickOpenResults } from '../../lib/quick-open';
import type { NoteMeta } from '../../types';

interface QuickOpenModalProps {
  open: boolean;
  notes: NoteMeta[];
  selectedNoteId: string | null;
  query: string;
  onQueryChange: (value: string) => void;
  onClose: () => void;
  onSelectNote: (note: NoteMeta) => void;
}

export default function QuickOpenModal({
  open,
  notes,
  selectedNoteId,
  query,
  onQueryChange,
  onClose,
  onSelectNote,
}: QuickOpenModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const results = useMemo(
    () => searchQuickOpenResults(notes, query, 12),
    [notes, query]
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    setActiveIndex(0);
    window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!open) {
    return null;
  }

  const commitSelection = (index: number) => {
    const result = results[index];
    if (!result) {
      return;
    }

    onSelectNote(result.note);
  };

  return (
    <div
      className="quick-open-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Quick open"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="quick-open-modal">
        <div className="quick-open-search">
          <Search size={17} className="text-[var(--text-dim)]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            aria-label="Quick open search"
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
                return;
              }

              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveIndex((current) =>
                  Math.min(current + 1, Math.max(results.length - 1, 0))
                );
                return;
              }

              if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveIndex((current) => Math.max(current - 1, 0));
                return;
              }

              if (event.key === 'Enter') {
                event.preventDefault();
                commitSelection(activeIndex);
              }
            }}
            placeholder="Search notes, notebooks or tags..."
            className="quick-open-search__input"
          />
          <span className="quick-open-search__hint">
            <Command size={12} />
            K
          </span>
        </div>

        <div className="quick-open-results">
          {results.length === 0 ? (
            <div className="quick-open-empty">
              <p className="text-sm font-medium text-[var(--text-1)]">
                No matching notes.
              </p>
              <p className="mt-1 text-sm text-[var(--text-2)]">
                Try a note title, notebook name or tag.
              </p>
            </div>
          ) : (
            results.map((result, index) => (
              <button
                key={result.note.id}
                type="button"
                className="quick-open-result"
                data-active={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => commitSelection(index)}
              >
                <div className="quick-open-result__header">
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText size={14} className="shrink-0 text-[var(--text-dim)]" />
                    <span className="truncate text-sm font-semibold text-[var(--text-1)]">
                      {result.note.title}
                    </span>
                    {result.note.id === selectedNoteId ? (
                      <span className="quick-open-result__current">Open</span>
                    ) : null}
                  </div>
                  <span className="quick-open-result__notebook">
                    {result.note.notebookId}
                  </span>
                </div>

                <div className="quick-open-result__meta">
                  {result.matchedTags.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Hash size={12} className="text-[var(--text-dim)]" />
                      {result.matchedTags.map((tag) => (
                        <Badge
                          key={`${result.note.id}-${tag.label}`}
                          label={tag.label}
                          color={tag.color}
                        />
                      ))}
                    </div>
                  ) : result.note.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {result.note.tags.slice(0, 3).map((tag) => (
                        <Badge
                          key={`${result.note.id}-${tag.label}`}
                          label={tag.label}
                          color={tag.color}
                          className="opacity-80"
                        />
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-[var(--text-dim)]">
                      No tags
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
