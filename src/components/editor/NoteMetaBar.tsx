import { useState } from 'react';
import { ArrowRightLeft, Plus, Tag, X } from 'lucide-react';
import Badge from '../ui/Badge';
import type {
  NoteStatus,
  NoteTag,
  Notebook,
  TagColor,
} from '../../types';

const TAG_COLORS: TagColor[] = ['blue', 'green', 'orange', 'purple', 'red', 'gray'];

interface NoteMetaBarProps {
  notebookId: string;
  notebooks: Notebook[];
  status: NoteStatus;
  tags: NoteTag[];
  onNotebookChange: (notebookId: string) => void;
  onStatusChange: (status: NoteStatus) => void;
  onAddTag: (tag: NoteTag) => void;
  onRemoveTag: (label: string) => void;
}

const STATUS_OPTIONS: Array<{ value: NoteStatus; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'onHold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'dropped', label: 'Dropped' },
];

export default function NoteMetaBar({
  notebookId,
  notebooks,
  status,
  tags,
  onNotebookChange,
  onStatusChange,
  onAddTag,
  onRemoveTag,
}: NoteMetaBarProps) {
  const [newTagLabel, setNewTagLabel] = useState('');
  const [newTagColor, setNewTagColor] = useState<TagColor>('blue');

  const handleAddTag = () => {
    const trimmed = newTagLabel.trim();
    if (!trimmed) {
      return;
    }

    onAddTag({ label: trimmed, color: newTagColor });
    setNewTagLabel('');
    setNewTagColor('blue');
  };

  return (
    <div
      className="flex flex-wrap items-start gap-4 border-b px-5 py-3"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      <label className="flex min-w-[12rem] flex-col gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
        <span className="inline-flex items-center gap-2">
          <ArrowRightLeft size={12} />
          Notebook
        </span>
        <select
          aria-label="Move note to notebook"
          value={notebookId}
          onChange={(event) => onNotebookChange(event.target.value)}
          className="text-field py-2 text-sm font-medium normal-case tracking-normal"
        >
          {notebooks.map((notebook) => (
            <option key={notebook.id} value={notebook.id}>
              {notebook.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex min-w-[10rem] flex-col gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
        <span>Status</span>
        <select
          aria-label="Note status"
          value={status}
          onChange={(event) => onStatusChange(event.target.value as NoteStatus)}
          className="text-field py-2 text-sm font-medium normal-case tracking-normal"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <div className="min-w-[16rem] flex-1">
        <div className="mb-1 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
          <Tag size={12} />
          Tags
        </div>

        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag.label}
              className="inline-flex items-center gap-1 rounded-full border px-1.5 py-1"
              style={{
                borderColor: 'var(--border-subtle)',
                background: 'var(--surface-elevated)',
              }}
            >
              <Badge label={tag.label} color={tag.color} />
              <button
                type="button"
                aria-label={`Remove ${tag.label} tag`}
                className="rounded-full p-0.5 text-[var(--text-dim)] transition hover:text-[var(--text-1)]"
                onClick={() => onRemoveTag(tag.label)}
              >
                <X size={12} />
              </button>
            </span>
          ))}

          <div
            className="flex min-w-[15rem] flex-wrap items-center gap-2 rounded-2xl border px-3 py-2"
            style={{
              borderColor: 'var(--border-subtle)',
              background: 'var(--surface-elevated)',
            }}
          >
            <input
              aria-label="New tag name"
              value={newTagLabel}
              onChange={(event) => setNewTagLabel(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleAddTag();
                }
              }}
              placeholder="Add tag..."
              className="min-w-[8rem] flex-1 bg-transparent text-sm text-[var(--text-1)] outline-none placeholder:text-[var(--text-dim)]"
            />
            <select
              aria-label="New tag color"
              value={newTagColor}
              onChange={(event) => setNewTagColor(event.target.value as TagColor)}
              className="rounded-lg border px-2 py-1 text-xs"
              style={{
                borderColor: 'var(--border-subtle)',
                background: 'var(--surface-2)',
                color: 'var(--text-2)',
              }}
            >
              {TAG_COLORS.map((color) => (
                <option key={color} value={color}>
                  {color}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="ghost-button px-2 py-1"
              onClick={handleAddTag}
              title="Add tag"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
