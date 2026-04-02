import { useMemo, useState } from 'react';
import Sidebar from './components/sidebar/Sidebar';
import NoteList from './components/notes/NoteList';
import NoteEditor from './components/editor/NoteEditor';
import { NOTEBOOKS, NOTES, SELECTED_NOTE_CONTENT } from './data/mock';

function App() {
  const [activeItem, setActiveItem] = useState('all');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(NOTES[3]?.id ?? null);

  const filteredNotes = useMemo(() => {
    if (activeItem === 'all') return NOTES;
    if (activeItem === 'pinned') return NOTES.filter((n) => n.pinned);
    return NOTES.filter((n) => n.notebookId === activeItem);
  }, [activeItem]);

  const listTitle = useMemo(() => {
    if (activeItem === 'all') return 'All Notes';
    if (activeItem === 'pinned') return 'Pinned Notes';
    const nb = NOTEBOOKS.find((n) => n.id === activeItem);
    return nb?.name ?? 'Notes';
  }, [activeItem]);

  const selectedNote = useMemo(() => {
    if (!selectedNoteId) return null;
    const note = NOTES.find((n) => n.id === selectedNoteId);
    if (!note) return null;
    return { ...note, body: SELECTED_NOTE_CONTENT };
  }, [selectedNoteId]);

  return (
    <div className="flex h-screen bg-slate-850 font-sans text-slate-300">
      <Sidebar
        notebooks={NOTEBOOKS}
        activeItem={activeItem}
        onItemClick={setActiveItem}
        totalNotes={NOTES.length}
      />
      <NoteList
        title={listTitle}
        notes={filteredNotes}
        selectedNoteId={selectedNoteId}
        onNoteSelect={setSelectedNoteId}
      />
      <NoteEditor note={selectedNote} notebooks={NOTEBOOKS} />
    </div>
  );
}

export default App;
