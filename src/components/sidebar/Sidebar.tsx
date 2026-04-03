import { useState } from 'react';
import {
  Check,
  Download,
  FileText,
  HardDriveDownload,
  HardDriveUpload,
  Pin,
  Pencil,
  FolderOpen,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import SidebarItem from './SidebarItem';
import SidebarSection from './SidebarSection';
import TrashSidebarItem from './TrashSidebarItem';
import UserProfile from './UserProfile';
import type { Notebook } from '../../types';

interface SidebarProps {
  profileName: string;
  notebooks: Notebook[];
  activeItem: string;
  onItemClick: (id: string) => void;
  totalNotes: number;
  trashCount: number;
  onCreateNotebook: (name: string) => Promise<Notebook | null>;
  onRenameNotebook: (id: string, name: string) => Promise<Notebook | null>;
  onDeleteNotebook: (id: string) => Promise<void>;
  onExportBackup: () => Promise<void>;
  onImportBackup: () => Promise<void>;
  onCreateIncrementalBackup: () => Promise<void>;
}

export default function Sidebar({
  profileName,
  notebooks,
  activeItem,
  onItemClick,
  totalNotes,
  trashCount,
  onCreateNotebook,
  onRenameNotebook,
  onDeleteNotebook,
  onExportBackup,
  onImportBackup,
  onCreateIncrementalBackup,
}: SidebarProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingNotebookId, setEditingNotebookId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    await onCreateNotebook(trimmed);
    setNewName('');
    setIsCreating(false);
  };

  const startRename = (notebook: Notebook) => {
    setEditingNotebookId(notebook.id);
    setEditingName(notebook.name);
  };

  const cancelRename = () => {
    setEditingNotebookId(null);
    setEditingName('');
  };

  const handleRename = async (notebookId: string) => {
    const trimmed = editingName.trim();
    if (!trimmed) {
      cancelRename();
      return;
    }

    const renamed = await onRenameNotebook(notebookId, trimmed);
    if (renamed) {
      cancelRename();
    }
  };

  return (
    <aside
      className="workbench-panel flex h-full w-64 shrink-0 flex-col border-r"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      <div className="px-4 pt-5 pb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-dim)]">
          {profileName}
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
        <TrashSidebarItem
          active={activeItem === 'trash'}
          count={trashCount}
          onClick={() => onItemClick('trash')}
        />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2">
        <SidebarSection title="Notebooks">
          {notebooks.map((nb) => (
            <div key={nb.id} className="group relative">
              {editingNotebookId === nb.id ? (
                <div className="mx-1 rounded-xl border px-2 py-2" style={{
                  borderColor: 'var(--border-subtle)',
                  background: 'var(--surface-elevated)',
                }}>
                  <input
                    autoFocus
                    aria-label={`Rename ${nb.name}`}
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        void handleRename(nb.id);
                      }
                      if (event.key === 'Escape') {
                        cancelRename();
                      }
                    }}
                    onBlur={() => {
                      void handleRename(nb.id);
                    }}
                    className="text-field px-3 py-2 text-xs"
                    placeholder="Notebook name..."
                  />
                  <div className="mt-2 flex justify-end gap-1">
                    <button
                      type="button"
                      className="ghost-button px-2 py-1"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => cancelRename()}
                      title="Cancel rename"
                    >
                      <X size={12} />
                    </button>
                    <button
                      type="button"
                      className="ghost-button px-2 py-1"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => void handleRename(nb.id)}
                      title="Save rename"
                    >
                      <Check size={12} />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <SidebarItem
                    label={nb.name}
                    icon={FolderOpen}
                    active={activeItem === nb.id}
                    depth={1}
                    onClick={() => onItemClick(nb.id)}
                  />
                  <div className="absolute right-1 top-1/2 flex -translate-y-1/2 gap-0.5 opacity-0 transition group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        startRename(nb);
                      }}
                      className="rounded p-1"
                      style={{ color: 'var(--text-dim)' }}
                      title={`Rename ${nb.name}`}
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (
                          window.confirm(
                            `Move notebook "${nb.name}" and all its notes to Trash?`
                          )
                        ) {
                          void onDeleteNotebook(nb.id);
                        }
                      }}
                      className="rounded p-1"
                      style={{ color: 'var(--text-dim)' }}
                      title={`Delete ${nb.name}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}

          {/* New notebook input */}
          {isCreating ? (
            <div className="px-2 py-1">
              <input
                autoFocus
                aria-label="New notebook name"
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
              aria-label="Create notebook"
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

      <div className="border-t px-3 py-3" style={{ borderColor: 'var(--border-subtle)' }}>
        <SidebarSection title="Data & Backup">
          <button
            type="button"
            className="ghost-button w-full justify-start px-3 py-2 text-xs"
            onClick={() => void onExportBackup()}
          >
            <Download size={14} />
            Exportar
          </button>
          <button
            type="button"
            className="ghost-button w-full justify-start px-3 py-2 text-xs"
            onClick={() => void onImportBackup()}
          >
            <HardDriveUpload size={14} />
            Importar
          </button>
          <button
            type="button"
            className="ghost-button w-full justify-start px-3 py-2 text-xs"
            onClick={() => void onCreateIncrementalBackup()}
          >
            <HardDriveDownload size={14} />
            Criar backup agora
          </button>
        </SidebarSection>
      </div>

      <UserProfile name={profileName} syncedAt={new Date().toLocaleTimeString()} />
    </aside>
  );
}
