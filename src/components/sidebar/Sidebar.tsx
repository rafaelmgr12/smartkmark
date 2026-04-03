import { useState } from 'react';
import {
  FileText,
  Pin,
  FolderOpen,
  Plus,
  Trash2,
} from 'lucide-react';
import SidebarItem from './SidebarItem';
import SidebarSection from './SidebarSection';
import UserProfile from './UserProfile';
import type { Notebook } from '../../types';

interface SidebarProps {
  notebooks: Notebook[];
  activeItem: string;
  onItemClick: (id: string) => void;
  totalNotes: number;
  onCreateNotebook: (name: string) => Promise<Notebook | null>;
  onDeleteNotebook: (id: string) => Promise<void>;
}

export default function Sidebar({
  notebooks,
  activeItem,
  onItemClick,
  totalNotes,
  onCreateNotebook,
  onDeleteNotebook,
}: SidebarProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    await onCreateNotebook(trimmed);
    setNewName('');
    setIsCreating(false);
  };

  return (
    <aside
      className="workbench-panel flex h-full w-64 shrink-0 flex-col border-r"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      <div className="px-4 pt-5 pb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-dim)]">
          SmartKMark
        </p>
        <h1 className="mt-2 text-xl font-semibold text-[var(--text-1)]">
          Developer Workbench
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--text-2)]">
          Local-first markdown notes for code, docs and formulas.
        </p>
      </div>

      <div className="px-3 pb-3">
        <SidebarItem
          label="All Notes"
          icon={FileText}
          count={totalNotes}
          active={activeItem === 'all'}
          onClick={() => onItemClick('all')}
        />
        <SidebarItem
          label="Pinned"
          icon={Pin}
          active={activeItem === 'pinned'}
          onClick={() => onItemClick('pinned')}
        />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2">
        <SidebarSection title="Notebooks">
          {notebooks.map((nb) => (
            <div key={nb.id} className="group relative">
              <SidebarItem
                label={nb.name}
                icon={FolderOpen}
                active={activeItem === nb.id}
                depth={1}
                onClick={() => onItemClick(nb.id)}
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (
                    window.confirm(`Delete notebook "${nb.name}" and all its notes?`)
                  ) {
                    void onDeleteNotebook(nb.id);
                  }
                }}
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 opacity-0 transition group-hover:opacity-100"
                style={{ color: 'var(--text-dim)' }}
                title={`Delete ${nb.name}`}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}

          {/* New notebook input */}
          {isCreating ? (
            <div className="px-2 py-1">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleCreate();
                  if (e.key === 'Escape') {
                    setIsCreating(false);
                    setNewName('');
                  }
                }}
                onBlur={() => {
                  if (!newName.trim()) setIsCreating(false);
                }}
                placeholder="Notebook name..."
                className="text-field px-3 py-2 text-xs"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="ghost-button ml-2 w-[calc(100%-1rem)] justify-start px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em]"
              style={{ paddingLeft: '1.5rem' }}
            >
              <Plus size={14} />
              New notebook
            </button>
          )}
        </SidebarSection>
      </nav>

      <UserProfile name="SmartKMark" syncedAt={new Date().toLocaleTimeString()} />
    </aside>
  );
}
