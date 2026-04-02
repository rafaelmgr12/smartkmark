import { useCallback, useEffect } from 'react';
import Sidebar from './components/sidebar/Sidebar';
import NoteList from './components/notes/NoteList';
import NoteEditor from './components/editor/NoteEditor';
import useAppState from './hooks/useAppState';

function App() {
  const {
    notebooks,
    notes,
    filteredNotes,
    filterTitle,
    selectedNoteId,
    activeNote,
    activeFilter,
    loading,
    selectNote,
    setFilter,
    createNotebook,
    deleteNotebook,
    createNote,
    updateNote,
    deleteNote,
    togglePin,
  } = useAppState();

  // Determine which notebook to create a new note in
  const getTargetNotebook = useCallback((): string => {
    // If filtering by a specific notebook, use that
    if (activeFilter !== 'all' && activeFilter !== 'pinned') {
      return activeFilter;
    }
    // Otherwise default to first notebook (usually "Inbox")
    return notebooks[0]?.id ?? 'Inbox';
  }, [activeFilter, notebooks]);

  const handleCreateNote = useCallback(async () => {
    const notebookId = getTargetNotebook();
    await createNote({
      notebookId,
      title: 'New Note',
      body: '',
    });
  }, [getTargetNotebook, createNote]);

  // Global Ctrl+N shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        void handleCreateNote();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleCreateNote]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-850 text-slate-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-850 font-sans text-slate-300">
      <Sidebar
        notebooks={notebooks}
        activeItem={activeFilter}
        onItemClick={setFilter}
        totalNotes={notes.length}
        onCreateNotebook={createNotebook}
        onDeleteNotebook={deleteNotebook}
      />
      <NoteList
        title={filterTitle}
        notes={filteredNotes}
        selectedNoteId={selectedNoteId}
        onNoteSelect={(id) => void selectNote(id)}
        onCreateNote={() => void handleCreateNote()}
        onDeleteNote={(nbId, nId) => void deleteNote(nbId, nId)}
        onTogglePin={(id) => void togglePin(id)}
      />
      <NoteEditor
        note={activeNote}
        notebooks={notebooks}
        onUpdateNote={updateNote}
      />
    </div>
  );
}

export default App;
