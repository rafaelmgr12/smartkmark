import { useCallback, useEffect, useRef, useState } from 'react';
import TagBar from './TagBar';
import EditorToolbar from './EditorToolbar';
import NoteContent from './NoteContent';
import { wrapSelection, insertLink } from '../../lib/markdown-shortcuts';
import type { Note, Notebook, UpdateNotePayload } from '../../types';

interface NoteEditorProps {
  note: Note | null;
  notebooks: Notebook[];
  onUpdateNote: (payload: UpdateNotePayload) => Promise<Note | null>;
}

export default function NoteEditor({
  note,
  notebooks,
  onUpdateNote,
}: NoteEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState('');
  const [title, setTitle] = useState('');
  const [isPreview, setIsPreview] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local state when a different note is selected
  useEffect(() => {
    if (note) {
      setBody(note.body);
      setTitle(note.title);
      setIsPreview(false);
    }
  }, [note?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced auto-save
  const scheduleSave = useCallback(
    (newBody: string, newTitle?: string) => {
      if (!note) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        void onUpdateNote({
          id: note.id,
          notebookId: note.notebookId,
          body: newBody,
          title: newTitle ?? title,
        });
      }, 800);
    },
    [note, title, onUpdateNote]
  );

  // Immediate save (Ctrl+S)
  const saveNow = useCallback(() => {
    if (!note) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    void onUpdateNote({
      id: note.id,
      notebookId: note.notebookId,
      body,
      title,
    });
  }, [note, body, title, onUpdateNote]);

  const handleBodyChange = (value: string) => {
    setBody(value);
    scheduleSave(value);
  };

  const handleTitleBlur = () => {
    if (!note || title === note.title) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    void onUpdateNote({
      id: note.id,
      notebookId: note.notebookId,
      body,
      title,
    });
  };

  // Keyboard shortcuts on the textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isMeta = e.ctrlKey || e.metaKey;
    if (!isMeta) return;

    const el = textareaRef.current;
    if (!el) return;

    const key = e.key.toLowerCase();

    if (key === 'b') {
      e.preventDefault();
      const result = wrapSelection(el, '**');
      handleBodyChange(result.value);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(result.selectionStart, result.selectionEnd);
      });
    }

    if (key === 'i') {
      e.preventDefault();
      const result = wrapSelection(el, '_');
      handleBodyChange(result.value);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(result.selectionStart, result.selectionEnd);
      });
    }

    if (key === 'k') {
      e.preventDefault();
      const result = insertLink(el);
      handleBodyChange(result.value);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(result.selectionStart, result.selectionEnd);
      });
    }

    if (key === 's') {
      e.preventDefault();
      saveNow();
    }

    if (key === 'e') {
      e.preventDefault();
      setIsPreview((prev) => !prev);
    }
  };

  // Global Ctrl+S / Ctrl+N / Ctrl+E handler (when focus is not on textarea)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMeta = e.ctrlKey || e.metaKey;
      if (!isMeta) return;
      const key = e.key.toLowerCase();

      if (key === 's') {
        e.preventDefault();
        saveNow();
      }
      if (key === 'e') {
        e.preventDefault();
        setIsPreview((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [saveNow]);

  if (!note) {
    return (
      <div className="flex flex-1 items-center justify-center bg-slate-850">
        <p className="text-sm text-slate-600">
          Select a note to start editing
        </p>
      </div>
    );
  }

  const notebook = notebooks.find((nb) => nb.id === note.notebookId);

  return (
    <div className="flex flex-1 flex-col bg-slate-850">
      {/* Title */}
      <div className="px-5 pt-5 pb-1">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          className="w-full bg-transparent text-xl font-bold text-slate-100 outline-none placeholder-slate-600"
          placeholder="Note title..."
        />
      </div>

      {/* Tags */}
      <TagBar notebook={notebook?.name} tags={note.tags} />

      {/* Toolbar */}
      <EditorToolbar
        textareaRef={textareaRef}
        onContentChange={handleBodyChange}
        isPreview={isPreview}
        onTogglePreview={() => setIsPreview((p) => !p)}
      />

      {/* Content: edit or preview */}
      {isPreview ? (
        <NoteContent content={body} />
      ) : (
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => handleBodyChange(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          className="flex-1 resize-none bg-transparent px-5 py-4 font-mono text-sm leading-relaxed text-slate-300 outline-none"
          placeholder="Start writing markdown..."
        />
      )}
    </div>
  );
}
