import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { CheckCircle2, LoaderCircle, TriangleAlert } from 'lucide-react';
import TagBar from './TagBar';
import NoteMetaBar from './NoteMetaBar';
import EditorToolbar from './EditorToolbar';
import MarkdownEditor, {
  type EditorCommand,
  type MarkdownEditorHandle,
} from './MarkdownEditor';
import type {
  AppSettings,
  Note,
  NoteStatus,
  NoteTag,
  Notebook,
  UpdateNotePayload,
} from '../../types';

const NoteContent = lazy(() => import('./NoteContent'));

type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

interface NoteEditorProps {
  note: Note | null;
  notebooks: Notebook[];
  settings: AppSettings;
  onUpdateNote: (payload: UpdateNotePayload) => Promise<Note | null>;
  onMoveNote: (
    noteId: string,
    fromNotebookId: string,
    toNotebookId: string
  ) => Promise<Note | null>;
  onPatchSettings: (patch: Partial<AppSettings>) => Promise<AppSettings | null>;
}

interface NoteDraft {
  body: string;
  title: string;
  tags: NoteTag[];
  status: NoteStatus;
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

function areTagsEqual(left: NoteTag[], right: NoteTag[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every(
    (tag, index) =>
      tag.label === right[index]?.label && tag.color === right[index]?.color
  );
}

export default function NoteEditor({
  note,
  notebooks,
  settings,
  onUpdateNote,
  onMoveNote,
  onPatchSettings,
}: NoteEditorProps) {
  const editorRef = useRef<MarkdownEditorHandle>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [body, setBody] = useState('');
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState<NoteTag[]>([]);
  const [status, setStatus] = useState<NoteStatus>('active');
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
      setTags([]);
      setStatus('active');
      setSaveStatus('idle');
      setSaveError(null);
      setLastSavedAt(null);
      return;
    }

    setBody(note.body);
    setTitle(note.title);
    setTags(note.tags);
    setStatus(note.status);
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

  const buildDraft = useCallback(
    (overrides?: Partial<NoteDraft>): NoteDraft => ({
      body: overrides?.body ?? body,
      title: overrides?.title ?? title,
      tags: overrides?.tags ?? tags,
      status: overrides?.status ?? status,
    }),
    [body, status, tags, title]
  );

  const clearPendingSave = () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  };

  const persistDraft = useCallback(
    async (draft: NoteDraft) => {
      if (!note) {
        return null;
      }

      setSaveStatus('saving');
      setSaveError(null);

      const updated = await onUpdateNote({
        id: note.id,
        notebookId: note.notebookId,
        body: draft.body,
        title: draft.title.trim() || 'Untitled',
        tags: draft.tags,
        status: draft.status,
      });

      if (!updated) {
        setSaveStatus('error');
        setSaveError(
          'Unable to save this note. Your changes are still in the editor.'
        );
        return null;
      }

      setTitle(updated.title);
      setTags(updated.tags);
      setStatus(updated.status);
      setSaveStatus('saved');
      setLastSavedAt(new Date(updated.updatedAt));
      return updated;
    },
    [note, onUpdateNote]
  );

  const scheduleSave = useCallback(
    (draft: NoteDraft) => {
      if (!note) {
        return;
      }

      clearPendingSave();
      setSaveStatus('dirty');

      saveTimerRef.current = setTimeout(() => {
        void persistDraft(draft);
      }, 800);
    },
    [note, persistDraft]
  );

  const saveNow = useCallback(async () => {
    if (!note) {
      return;
    }

    clearPendingSave();
    await persistDraft(buildDraft());
  }, [buildDraft, note, persistDraft]);

  const hasLocalChanges =
    note !== null &&
    (body !== note.body ||
      title.trim() !== note.title ||
      status !== note.status ||
      !areTagsEqual(tags, note.tags));

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === 's') {
        event.preventDefault();
        void saveNow();
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
      scheduleSave(buildDraft({ body: nextBody }));
    },
    [buildDraft, scheduleSave]
  );

  const handleTitleChange = (nextTitle: string) => {
    setTitle(nextTitle);
    scheduleSave(buildDraft({ title: nextTitle }));
  };

  const handleTitleBlur = () => {
    if (!note || !hasLocalChanges) {
      return;
    }

    void saveNow();
  };

  const handleStatusChange = async (nextStatus: NoteStatus) => {
    setStatus(nextStatus);
    clearPendingSave();
    await persistDraft(buildDraft({ status: nextStatus }));
  };

  const handleAddTag = async (tag: NoteTag) => {
    const exists = tags.some(
      (current) => current.label.toLowerCase() === tag.label.toLowerCase()
    );

    if (exists) {
      setSaveError(`Tag "${tag.label}" already exists on this note.`);
      return;
    }

    const nextTags = [...tags, tag];
    setTags(nextTags);
    clearPendingSave();
    await persistDraft(buildDraft({ tags: nextTags }));
  };

  const handleRemoveTag = async (label: string) => {
    const nextTags = tags.filter((tag) => tag.label !== label);
    setTags(nextTags);
    clearPendingSave();
    await persistDraft(buildDraft({ tags: nextTags }));
  };

  const handleMoveNote = async (nextNotebookId: string) => {
    if (!note || nextNotebookId === note.notebookId) {
      return;
    }

    clearPendingSave();

    const persisted = await persistDraft(buildDraft());
    if (!persisted) {
      return;
    }

    const moved = await onMoveNote(note.id, note.notebookId, nextNotebookId);
    if (!moved) {
      setSaveStatus('error');
      setSaveError('Unable to move this note to the selected notebook.');
      return;
    }

    setSaveStatus('saved');
    setLastSavedAt(new Date(moved.updatedAt));
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
            This workspace now treats the editor like a coding workspace: markdown,
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
            {saveStatus === 'saving' ? (
              <LoaderCircle size={12} className="animate-spin" />
            ) : null}
            {saveStatus === 'error' ? <TriangleAlert size={12} /> : null}
            {saveStatus === 'saved' ? <CheckCircle2 size={12} /> : null}
            {formatSaveStatus(saveStatus)}
          </span>
          <span className="status-pill">{formatSavedAt(lastSavedAt)}</span>
        </div>
      </div>

      <TagBar notebook={notebook?.name} tags={tags} />

      <NoteMetaBar
        notebookId={note.notebookId}
        notebooks={notebooks}
        status={status}
        tags={tags}
        onNotebookChange={(value) => void handleMoveNote(value)}
        onStatusChange={(value) => void handleStatusChange(value)}
        onAddTag={(value) => void handleAddTag(value)}
        onRemoveTag={(label) => void handleRemoveTag(label)}
      />

      <EditorToolbar
        isPreviewOpen={settings.previewOpen}
        fontSize={settings.editorFontSize}
        lineWrap={settings.lineWrap}
        onCommand={applyCommand}
        onTogglePreview={() =>
          void onPatchSettings({ previewOpen: !settings.previewOpen })
        }
        onFontSizeChange={(value) =>
          void onPatchSettings({ editorFontSize: value })
        }
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
            onSave={() => void saveNow()}
            onTogglePreview={() =>
              void onPatchSettings({ previewOpen: !settings.previewOpen })
            }
            fontSize={settings.editorFontSize}
            lineWrap={settings.lineWrap}
          />
        </div>

        {settings.previewOpen ? (
          <div className="hidden min-w-0 flex-1 xl:block">
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center text-sm text-[var(--text-2)]">
                  Preparing preview...
                </div>
              }
            >
              <NoteContent content={body} />
            </Suspense>
          </div>
        ) : null}
      </div>
    </section>
  );
}
