import { useCallback, useEffect, useMemo, useState } from 'react';
import { getErrorMessage } from '../lib/desktop-errors';
import type {
  AppSettings,
  CreateNotePayload,
  Note,
  NoteMeta,
  Notebook,
  UpdateNotePayload,
} from '../types';

interface AppState {
  notebooks: Notebook[];
  notes: NoteMeta[];
  selectedNoteId: string | null;
  activeNote: Note | null;
  activeFilter: string;
  settings: AppSettings;
  loading: boolean;
  error: string | null;
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'workbench',
  editorFontSize: 'md',
  lineWrap: 'wrap',
  previewOpen: false,
};

function sortNotes(notes: NoteMeta[]): NoteMeta[] {
  return [...notes].sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  );
}

export default function useAppState() {
  const [state, setState] = useState<AppState>({
    notebooks: [],
    notes: [],
    selectedNoteId: null,
    activeNote: null,
    activeFilter: 'all',
    settings: DEFAULT_SETTINGS,
    loading: true,
    error: null,
  });

  const refresh = useCallback(async () => {
    try {
      const [notebooks, notes, settings] = await Promise.all([
        window.desktopApi.listNotebooks(),
        window.desktopApi.listNotes(),
        window.desktopApi.getSettings(),
      ]);

      setState((prev) => ({
        ...prev,
        notebooks,
        notes: sortNotes(notes),
        settings,
        loading: false,
        error: null,
        activeFilter:
          prev.activeFilter !== 'all' &&
          prev.activeFilter !== 'pinned' &&
          !notebooks.some((notebook) => notebook.id === prev.activeFilter)
            ? 'all'
            : prev.activeFilter,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: getErrorMessage(error, 'Failed to load SmartKMark data.'),
      }));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selectNote = useCallback(
    async (noteId: string | null) => {
      if (!noteId) {
        setState((prev) => ({
          ...prev,
          selectedNoteId: null,
          activeNote: null,
        }));
        return;
      }

      const meta = state.notes.find((note) => note.id === noteId);
      if (!meta) {
        return;
      }

      try {
        const note = await window.desktopApi.getNote(meta.notebookId, meta.id);
        setState((prev) => ({
          ...prev,
          selectedNoteId: noteId,
          activeNote: note,
          error: null,
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: getErrorMessage(error, 'Failed to open the selected note.'),
        }));
      }
    },
    [state.notes]
  );

  const setFilter = useCallback((filter: string) => {
    setState((prev) => ({ ...prev, activeFilter: filter }));
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const createNotebook = useCallback(async (name: string) => {
    try {
      const notebook = await window.desktopApi.createNotebook(name);
      setState((prev) => ({
        ...prev,
        notebooks: [...prev.notebooks, notebook].sort((left, right) =>
          left.name.localeCompare(right.name)
        ),
        activeFilter: notebook.id,
        error: null,
      }));
      return notebook;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: getErrorMessage(error, 'Failed to create notebook.'),
      }));
      return null;
    }
  }, []);

  const deleteNotebook = useCallback(
    async (id: string) => {
      try {
        await window.desktopApi.deleteNotebook(id);
        setState((prev) => ({
          ...prev,
          notebooks: prev.notebooks.filter((notebook) => notebook.id !== id),
          notes: prev.notes.filter((note) => note.notebookId !== id),
          selectedNoteId:
            prev.activeNote?.notebookId === id ? null : prev.selectedNoteId,
          activeNote: prev.activeNote?.notebookId === id ? null : prev.activeNote,
          activeFilter: prev.activeFilter === id ? 'all' : prev.activeFilter,
          error: null,
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: getErrorMessage(error, 'Failed to delete notebook.'),
        }));
      }
    },
    []
  );

  const createNote = useCallback(async (payload: CreateNotePayload) => {
    try {
      const note = await window.desktopApi.createNote(payload);
      const meta = {
        id: note.id,
        title: note.title,
        notebookId: note.notebookId,
        tags: note.tags,
        pinned: note.pinned,
        status: note.status,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
      };
      setState((prev) => ({
        ...prev,
        notes: sortNotes([meta, ...prev.notes]),
        selectedNoteId: note.id,
        activeNote: note,
        activeFilter: payload.notebookId,
        error: null,
      }));
      return note;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: getErrorMessage(error, 'Failed to create note.'),
      }));
      return null;
    }
  }, []);

  const updateNote = useCallback(async (payload: UpdateNotePayload) => {
    try {
      const updated = await window.desktopApi.updateNote(payload);
      const meta = {
        id: updated.id,
        title: updated.title,
        notebookId: updated.notebookId,
        tags: updated.tags,
        pinned: updated.pinned,
        status: updated.status,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };
      setState((prev) => ({
        ...prev,
        notes: sortNotes(
          prev.notes.map((note) => (note.id === updated.id ? meta : note))
        ),
        activeNote:
          prev.selectedNoteId === updated.id ? updated : prev.activeNote,
        error: null,
      }));
      return updated;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: getErrorMessage(error, 'Failed to save note.'),
      }));
      return null;
    }
  }, []);

  const deleteNote = useCallback(async (notebookId: string, noteId: string) => {
    try {
      await window.desktopApi.deleteNote(notebookId, noteId);
      setState((prev) => ({
        ...prev,
        notes: prev.notes.filter((note) => note.id !== noteId),
        selectedNoteId: prev.selectedNoteId === noteId ? null : prev.selectedNoteId,
        activeNote: prev.selectedNoteId === noteId ? null : prev.activeNote,
        error: null,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: getErrorMessage(error, 'Failed to delete note.'),
      }));
    }
  }, []);

  const togglePin = useCallback(
    async (noteId: string) => {
      const meta = state.notes.find((note) => note.id === noteId);
      if (!meta) {
        return;
      }

      await updateNote({
        id: meta.id,
        notebookId: meta.notebookId,
        pinned: !meta.pinned,
      });
    },
    [state.notes, updateNote]
  );

  const patchSettings = useCallback(async (patch: Partial<AppSettings>) => {
    try {
      const next = await window.desktopApi.updateSettings(patch);
      setState((prev) => ({
        ...prev,
        settings: next,
        error: null,
      }));
      return next;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: getErrorMessage(error, 'Failed to save preferences.'),
      }));
      return null;
    }
  }, []);

  const filteredNotes = useMemo(() => {
    if (state.activeFilter === 'all') {
      return state.notes;
    }

    if (state.activeFilter === 'pinned') {
      return state.notes.filter((note) => note.pinned);
    }

    return state.notes.filter((note) => note.notebookId === state.activeFilter);
  }, [state.activeFilter, state.notes]);

  const filterTitle = useMemo(() => {
    if (state.activeFilter === 'all') {
      return 'All Notes';
    }

    if (state.activeFilter === 'pinned') {
      return 'Pinned Notes';
    }

    return (
      state.notebooks.find((notebook) => notebook.id === state.activeFilter)?.name ??
      'Notes'
    );
  }, [state.activeFilter, state.notebooks]);

  return {
    ...state,
    filteredNotes,
    filterTitle,
    clearError,
    refresh,
    selectNote,
    setFilter,
    createNotebook,
    deleteNotebook,
    createNote,
    updateNote,
    deleteNote,
    togglePin,
    patchSettings,
  };
}
