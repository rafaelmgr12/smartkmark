import { RotateCcw, Trash2 } from 'lucide-react';

interface TrashNoteActionsProps {
  onRestore: () => void;
  onPurge: () => void;
}

export default function TrashNoteActions({
  onRestore,
  onPurge,
}: TrashNoteActionsProps) {
  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onRestore();
        }}
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
        onClick={(event) => {
          event.stopPropagation();
          if (window.confirm('Delete this note permanently?')) {
            onPurge();
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
    </>
  );
}
