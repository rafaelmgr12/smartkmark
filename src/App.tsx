import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import Sidebar from './components/sidebar/Sidebar';
import NoteList from './components/notes/NoteList';
import QuickOpenModal from './components/search/QuickOpenModal';
import useAppState from './hooks/useAppState';
import type { LayoutMode, NoteMeta } from './types';

const NoteEditor = lazy(() => import('./components/editor/NoteEditor'));

const LAYOUT_LABELS: Record<LayoutMode, string> = {
  workbench: 'Workbench',
  writer: 'No notebooks',
  editor: 'Editor only',
};

const LAYOUT_SEQUENCE: LayoutMode[] = ['workbench', 'writer', 'editor'];

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
  const [isQuickOpenVisible, setIsQuickOpenVisible] = useState(false);
  const [quickOpenQuery, setQuickOpenQuery] = useState('');

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

  const setLayoutMode = useCallback(
    (layoutMode: LayoutMode) => {
      void patchSettings({ layoutMode });
    },
    [patchSettings]
  );

  const cycleLayoutMode = useCallback(() => {
    const currentIndex = LAYOUT_SEQUENCE.indexOf(settings.layoutMode);
    const nextLayout =
      LAYOUT_SEQUENCE[(currentIndex + 1) % LAYOUT_SEQUENCE.length];

    setLayoutMode(nextLayout);
  }, [setLayoutMode, settings.layoutMode]);

  const openQuickOpen = useCallback(() => {
    setIsQuickOpenVisible(true);
  }, []);

  const closeQuickOpen = useCallback(() => {
    setIsQuickOpenVisible(false);
    setQuickOpenQuery('');
  }, []);

  const handleQuickOpenSelection = useCallback(
    async (note: NoteMeta) => {
      setFilter(note.notebookId);
      await selectNote(note.id);
      closeQuickOpen();
    },
    [closeQuickOpen, selectNote, setFilter]
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }

      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === 'n') {
        event.preventDefault();
        void handleCreateNote();
        return;
      }

      if (key === 'k') {
        event.preventDefault();
        openQuickOpen();
        return;
      }

      if (key === '1') {
        event.preventDefault();
        setLayoutMode('workbench');
        return;
      }

      if (key === '2') {
        event.preventDefault();
        setLayoutMode('writer');
        return;
      }

      if (key === '3') {
        event.preventDefault();
        setLayoutMode('editor');
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleCreateNote, openQuickOpen, setLayoutMode]);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);

  const showSidebar = settings.layoutMode === 'workbench';
  const showNoteList =
    settings.layoutMode === 'workbench' || settings.layoutMode === 'writer';
  const isLightTheme = settings.theme === 'workbench-light';

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
    <div className="workbench-shell p-4 pt-14">
      <QuickOpenModal
        open={isQuickOpenVisible}
        notes={notes}
        selectedNoteId={selectedNoteId}
        query={quickOpenQuery}
        onQueryChange={setQuickOpenQuery}
        onClose={closeQuickOpen}
        onSelectNote={(note) => void handleQuickOpenSelection(note)}
      />
      <div className="window-chrome">
        <div className="window-chrome__pill">
          <div className="window-chrome__identity">
            <span className="window-chrome__label">{profile.shortName}</span>
            <span className="window-chrome__dot" />
            <span className="window-chrome__title">Developer Workbench</span>
          </div>
          <div className="window-chrome__controls window-no-drag">
            <button
              type="button"
              aria-label="Toggle theme"
              title={isLightTheme ? 'Switch to dark theme' : 'Switch to light theme'}
              aria-pressed={isLightTheme}
              className="window-chrome__theme-toggle"
              onClick={() =>
                void patchSettings({
                  theme: isLightTheme ? 'workbench-dark' : 'workbench-light',
                })
              }
            >
              {isLightTheme ? <Moon size={15} /> : <Sun size={15} />}
            </button>

            <button
              type="button"
              aria-label="Cycle layout"
              className="window-chrome__layout-toggle"
              title={`Cycle layout (${LAYOUT_LABELS[settings.layoutMode]}). Shortcuts: Ctrl/Cmd+1, 2, 3`}
              onClick={cycleLayoutMode}
            >
              <span>Layout</span>
              <strong>{LAYOUT_LABELS[settings.layoutMode]}</strong>
            </button>
          </div>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-[28px] border border-[var(--border-subtle)]">
        {showSidebar ? (
          <Sidebar
            profileName={profile.shortName}
            notebooks={notebooks}
            activeItem={activeFilter}
            onItemClick={setFilter}
            totalNotes={notes.length}
            onCreateNotebook={createNotebook}
            onRenameNotebook={renameNotebook}
            onDeleteNotebook={deleteNotebook}
          />
        ) : null}

        {showNoteList ? (
          <NoteList
            title={filterTitle}
            notes={filteredNotes}
            selectedNoteId={selectedNoteId}
            onNoteSelect={(id) => void selectNote(id)}
            onCreateNote={() => void handleCreateNote()}
            onDeleteNote={(notebookId, noteId) => void deleteNote(notebookId, noteId)}
            onTogglePin={(id) => void togglePin(id)}
          />
        ) : null}

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
