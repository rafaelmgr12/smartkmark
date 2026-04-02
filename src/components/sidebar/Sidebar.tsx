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
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-slate-700/50 bg-slate-900">
      {/* Header */}
      <div className="px-3 pt-4 pb-2">
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

      {/* Scrollable nav */}
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
                  void onDeleteNotebook(nb.id);
                }}
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-slate-600 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
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
                className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-300 outline-none focus:border-indigo-500"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-500 transition hover:bg-slate-800 hover:text-slate-400"
              style={{ paddingLeft: '1.5rem' }}
            >
              <Plus size={14} />
              New Notebook
            </button>
          )}
        </SidebarSection>
      </nav>

      {/* User profile */}
      <UserProfile name="SmartKMark" syncedAt={new Date().toLocaleTimeString()} />
    </aside>
  );
}
