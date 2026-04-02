import TagBar from './TagBar';
import EditorToolbar from './EditorToolbar';
import NoteContent from './NoteContent';
import type { Note, Notebook } from '../../types';

interface NoteEditorProps {
  note: Note | null;
  notebooks: Notebook[];
}

export default function NoteEditor({ note, notebooks }: NoteEditorProps) {
  if (!note) {
    return (
      <div className="flex flex-1 items-center justify-center bg-slate-850">
        <p className="text-sm text-slate-600">Select a note to start editing</p>
      </div>
    );
  }

  const notebook = notebooks.find((nb) => nb.id === note.notebookId);

  return (
    <div className="flex flex-1 flex-col bg-slate-850">
      {/* Title */}
      <div className="px-5 pt-5 pb-1">
        <h1 className="text-xl font-bold text-slate-100">{note.title}</h1>
      </div>

      {/* Tags */}
      <TagBar notebook={notebook?.name} tags={note.tags} />

      {/* Toolbar */}
      <EditorToolbar />

      {/* Content */}
      <NoteContent content={note.body} />
    </div>
  );
}
