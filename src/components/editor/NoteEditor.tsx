import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, LoaderCircle, TriangleAlert } from 'lucide-react';
import TagBar from './TagBar';
import EditorToolbar from './EditorToolbar';
import MarkdownEditor, { type EditorCommand, type MarkdownEditorHandle } from './MarkdownEditor';
import NoteContent from './NoteContent';
import type {
  AppSettings,
  Note,
  Notebook,
  UpdateNotePayload,
} from '../../types';

type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

interface NoteEditorProps {
  note: Note | null;
  notebooks: Notebook[];
  settings: AppSettings;
  onUpdateNote: (payload: UpdateNotePayload) => Promise<Note | null>;
  onPatchSettings: (patch: Partial<AppSettings>) => Promise<AppSettings | null>;
}

function formatSavedAt(date: Date | null) {
  if (!date) {
    return 'Waiting for changes';
  }

  return `Saved at ${date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function formatSaveStatus(status: SaveStatus) {
  switch (status) {
    case 'dirty':
      return 'Unsaved';
    case 'saving':
      return 'Saving';
    case 'saved':
      return 'Saved';
    case 'error':
      return 'Error';
    default:
      return 'Idle';
  }
}

export default function NoteEditor({
  note,
  notebooks,
  settings,
  onUpdateNote,
  onPatchSettings,
}: NoteEditorProps) {
  const editorRef = useRef<MarkdownEditorHandle>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [body, setBody] = useState('');
  const [title, setTitle] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const notebook = useMemo(
    () => notebooks.find((item) => item.id === note?.notebookId),
    [note?.notebookId, notebooks]
  );

  useEffect(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    if (!note) {
      setBody('');
      setTitle('');
      setSaveStatus('idle');
      setSaveError(null);
      setLastSavedAt(null);
      return;
    }

    setBody(note.body);
    setTitle(note.title);
    setSaveStatus('saved');
    setSaveError(null);
    setLastSavedAt(new Date(note.updatedAt));
  }, [note]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const saveNote = useCallback(
    async (draft: { body: string; title: string }) => {
      if (!note) {
        return;
      }

      setSaveStatus('saving');
      setSaveError(null);

      const updated = await onUpdateNote({
        id: note.id,
        notebookId: note.notebookId,
        body: draft.body,
        title: draft.title.trim() || 'Untitled',
      });

      if (!updated) {
        setSaveStatus('error');
        setSaveError('Unable to save this note. Your changes are still in the editor.');
        return;
      }

      setTitle(updated.title);
      setSaveStatus('saved');
      setLastSavedAt(new Date(updated.updatedAt));
    },
    [note, onUpdateNote]
  );

  const scheduleSave = useCallback(
    (draft: { body: string; title: string }) => {
      if (!note) {
        return;
      }

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      setSaveStatus('dirty');

      saveTimerRef.current = setTimeout(() => {
        void saveNote(draft);
      }, 800);
    },
    [note, saveNote]
  );

  const saveNow = useCallback(() => {
    if (!note) {
      return;
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    void saveNote({ body, title });
  }, [body, note, saveNote, title]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === 's') {
        event.preventDefault();
        saveNow();
      }

      if (key === 'e') {
        event.preventDefault();
        void onPatchSettings({ previewOpen: !settings.previewOpen });
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onPatchSettings, saveNow, settings.previewOpen]);

  const handleBodyChange = useCallback(
    (nextBody: string) => {
      setBody(nextBody);
      scheduleSave({ body: nextBody, title });
    },
    [scheduleSave, title]
  );

  const handleTitleChange = (nextTitle: string) => {
    setTitle(nextTitle);
    scheduleSave({ body, title: nextTitle });
  };

  const handleTitleBlur = () => {
    if (!note) {
      return;
    }

    if (title.trim() === note.title && body === note.body) {
      return;
    }

    saveNow();
  };

  const applyCommand = (command: EditorCommand) => {
    editorRef.current?.applyCommand(command);
  };

  const saveTone =
    saveStatus === 'error'
      ? 'danger'
      : saveStatus === 'saving' || saveStatus === 'dirty'
        ? 'warning'
        : 'success';

  if (!note) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div
          className="workbench-panel max-w-lg rounded-[28px] border px-10 py-12 text-center"
          style={{ color: 'var(--text-2)' }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-dim)]">
            Developer Workbench
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-[var(--text-1)]">
            Pick a note to start writing.
          </h2>
          <p className="mt-3 text-sm leading-7">
            SmartKMark now treats the editor like a coding workspace: markdown,
            formulas, code fences and preview are all ready on the right panel.
          </p>
        </div>
      </div>
    );
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <div
        className="flex items-center justify-between border-b px-5 py-4"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
            {notebook?.name ?? 'Workspace'}
          </p>
          <input
            value={title}
            onChange={(event) => handleTitleChange(event.target.value)}
            onBlur={handleTitleBlur}
            className="mt-1 w-full bg-transparent text-2xl font-semibold text-[var(--text-1)] outline-none placeholder:text-[var(--text-dim)]"
            placeholder="Note title..."
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="status-pill" data-tone={saveTone}>
            {saveStatus === 'saving' ? <LoaderCircle size={12} className="animate-spin" /> : null}
            {saveStatus === 'error' ? <TriangleAlert size={12} /> : null}
            {saveStatus === 'saved' ? <CheckCircle2 size={12} /> : null}
            {formatSaveStatus(saveStatus)}
          </span>
          <span className="status-pill">{formatSavedAt(lastSavedAt)}</span>
        </div>
      </div>

      <TagBar notebook={notebook?.name} tags={note.tags} />

      <EditorToolbar
        isPreviewOpen={settings.previewOpen}
        fontSize={settings.editorFontSize}
        lineWrap={settings.lineWrap}
        onCommand={applyCommand}
        onTogglePreview={() =>
          void onPatchSettings({ previewOpen: !settings.previewOpen })
        }
        onFontSizeChange={(value) => void onPatchSettings({ editorFontSize: value })}
        onLineWrapChange={(value) => void onPatchSettings({ lineWrap: value })}
      />

      {saveError ? (
        <div className="px-5 pt-4">
          <div className="inline-banner">{saveError}</div>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div
          className="min-w-0 flex-1 border-r"
          style={{
            borderColor: settings.previewOpen
              ? 'var(--border-subtle)'
              : 'transparent',
          }}
        >
          <MarkdownEditor
            ref={editorRef}
            value={body}
            onChange={handleBodyChange}
            onSave={saveNow}
            onTogglePreview={() =>
              void onPatchSettings({ previewOpen: !settings.previewOpen })
            }
            fontSize={settings.editorFontSize}
            lineWrap={settings.lineWrap}
          />
        </div>

        {settings.previewOpen ? (
          <div className="hidden min-w-0 flex-1 xl:block">
            <NoteContent content={body} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
