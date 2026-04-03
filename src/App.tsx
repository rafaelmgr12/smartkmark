import { Suspense, lazy, useCallback, useEffect } from 'react';
import Sidebar from './components/sidebar/Sidebar';
import NoteList from './components/notes/NoteList';
import useAppState from './hooks/useAppState';

const NoteEditor = lazy(() => import('./components/editor/NoteEditor'));

function App() {
  const {
    profile,
    notebooks,
    notes,
    filteredNotes,
    filterTitle,
    selectedNoteId,
    activeNote,
    activeFilter,
    settings,
    loading,
    error,
    clearError,
    selectNote,
    setFilter,
    createNotebook,
    renameNotebook,
    deleteNotebook,
    createNote,
    updateNote,
    deleteNote,
    moveNote,
    togglePin,
    patchSettings,
  } = useAppState();

  const getTargetNotebook = useCallback((): string => {
    if (activeFilter !== 'all' && activeFilter !== 'pinned') {
      return activeFilter;
    }

    return notebooks[0]?.id ?? 'Inbox';
  }, [activeFilter, notebooks]);

  const handleCreateNote = useCallback(async () => {
    const notebookId = getTargetNotebook();
    await createNote({
      notebookId,
      title: 'New Note',
      body: '',
    });
  }, [createNote, getTargetNotebook]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        void handleCreateNote();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleCreateNote]);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div
          className="workbench-panel rounded-[28px] border px-10 py-8"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-dim)]">
            {profile.shortName}
          </p>
          <p className="mt-2 text-lg font-semibold text-[var(--text-1)]">
            Loading your local workspace...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="workbench-shell p-4">
      <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-[28px] border border-[var(--border-subtle)]">
        <Sidebar
          profileName={profile.shortName}
          theme={settings.theme}
          notebooks={notebooks}
          activeItem={activeFilter}
          onItemClick={setFilter}
          totalNotes={notes.length}
          onCreateNotebook={createNotebook}
          onRenameNotebook={renameNotebook}
          onDeleteNotebook={deleteNotebook}
          onThemeChange={(theme) => void patchSettings({ theme })}
        />

        <NoteList
          title={filterTitle}
          notes={filteredNotes}
          selectedNoteId={selectedNoteId}
          onNoteSelect={(id) => void selectNote(id)}
          onCreateNote={() => void handleCreateNote()}
          onDeleteNote={(notebookId, noteId) => void deleteNote(notebookId, noteId)}
          onTogglePin={(id) => void togglePin(id)}
        />

        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden workbench-panel">
          {error ? (
            <div className="absolute left-5 right-5 top-5 z-10">
              <div className="inline-banner flex items-center justify-between gap-4">
                <span>{error}</span>
                <button
                  type="button"
                  className="ghost-button px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em]"
                  onClick={clearError}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}

          <Suspense
            fallback={
              <div className="flex flex-1 items-center justify-center px-6">
                <div
                  className="workbench-panel rounded-[24px] border px-6 py-5 text-sm text-[var(--text-2)]"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  Loading editor workspace...
                </div>
              </div>
            }
          >
            <NoteEditor
              note={activeNote}
              notebooks={notebooks}
              settings={settings}
              onUpdateNote={updateNote}
              onMoveNote={moveNote}
              onPatchSettings={patchSettings}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

export default App;
