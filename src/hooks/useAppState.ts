import { useCallback, useEffect, useState } from 'react';
import type {
  Notebook,
  Note,
  NoteMeta,
  CreateNotePayload,
  UpdateNotePayload,
} from '../types';

interface AppState {
  notebooks: Notebook[];
  notes: NoteMeta[];
  selectedNoteId: string | null;
  selectedNotebookId: string | null;
  activeNote: Note | null;
  activeFilter: string; // 'all' | 'pinned' | notebookId
  loading: boolean;
}

export default function useAppState() {
  const [state, setState] = useState<AppState>({
    notebooks: [],
    notes: [],
    selectedNoteId: null,
    selectedNotebookId: null,
    activeNote: null,
    activeFilter: 'all',
    loading: true,
  });

  // ----- Bootstrap: load notebooks + notes from disk -----

  const refresh = useCallback(async () => {
    try {
      const [notebooks, notes] = await Promise.all([
        window.desktopApi.listNotebooks(),
        window.desktopApi.listNotes(),
      ]);
      setState((prev) => ({ ...prev, notebooks, notes, loading: false }));
    } catch (err) {
      console.error('Failed to load data:', err);
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // ----- Note selection -----

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

      const meta = state.notes.find((n) => n.id === noteId);
      if (!meta) return;

      try {
        const note = await window.desktopApi.getNote(
          meta.notebookId,
          meta.id
        );
        setState((prev) => ({
          ...prev,
          selectedNoteId: noteId,
          activeNote: note,
        }));
      } catch (err) {
        console.error('Failed to load note:', err);
      }
    },
    [state.notes]
  );

  // ----- Filter -----

  const setFilter = useCallback((filter: string) => {
    setState((prev) => ({ ...prev, activeFilter: filter }));
  }, []);

  // ----- Notebook CRUD -----

  const createNotebook = useCallback(
    async (name: string) => {
      try {
        const nb = await window.desktopApi.createNotebook(name);
        setState((prev) => ({
          ...prev,
          notebooks: [...prev.notebooks, nb],
        }));
        return nb;
      } catch (err) {
        console.error('Failed to create notebook:', err);
        return null;
      }
    },
    []
  );

  const deleteNotebook = useCallback(
    async (id: string) => {
      try {
        await window.desktopApi.deleteNotebook(id);
        await refresh();
      } catch (err) {
        console.error('Failed to delete notebook:', err);
      }
    },
    [refresh]
  );

  // ----- Note CRUD -----

  const createNote = useCallback(
    async (payload: CreateNotePayload) => {
      try {
        const note = await window.desktopApi.createNote(payload);
        const { body: _, ...meta } = note;
        setState((prev) => ({
          ...prev,
          notes: [meta, ...prev.notes],
          selectedNoteId: note.id,
          activeNote: note,
        }));
        return note;
      } catch (err) {
        console.error('Failed to create note:', err);
        return null;
      }
    },
    []
  );

  const updateNote = useCallback(
    async (payload: UpdateNotePayload) => {
      try {
        const updated = await window.desktopApi.updateNote(payload);
        const { body: _, ...meta } = updated;
        setState((prev) => ({
          ...prev,
          notes: prev.notes.map((n) => (n.id === updated.id ? meta : n)),
          activeNote:
            prev.selectedNoteId === updated.id ? updated : prev.activeNote,
        }));
        return updated;
      } catch (err) {
        console.error('Failed to update note:', err);
        return null;
      }
    },
    []
  );

  const deleteNote = useCallback(
    async (notebookId: string, noteId: string) => {
      try {
        await window.desktopApi.deleteNote(notebookId, noteId);
        setState((prev) => ({
          ...prev,
          notes: prev.notes.filter((n) => n.id !== noteId),
          selectedNoteId:
            prev.selectedNoteId === noteId ? null : prev.selectedNoteId,
          activeNote:
            prev.selectedNoteId === noteId ? null : prev.activeNote,
        }));
      } catch (err) {
        console.error('Failed to delete note:', err);
      }
    },
    []
  );

  const togglePin = useCallback(
    async (noteId: string) => {
      const meta = state.notes.find((n) => n.id === noteId);
      if (!meta) return;
      await updateNote({
        id: meta.id,
        notebookId: meta.notebookId,
        pinned: !meta.pinned,
      });
    },
    [state.notes, updateNote]
  );

  // ----- Derived data -----

  const filteredNotes = (() => {
    const { activeFilter, notes } = state;
    if (activeFilter === 'all') return notes;
    if (activeFilter === 'pinned') return notes.filter((n) => n.pinned);
    return notes.filter((n) => n.notebookId === activeFilter);
  })();

  const filterTitle = (() => {
    const { activeFilter, notebooks } = state;
    if (activeFilter === 'all') return 'All Notes';
    if (activeFilter === 'pinned') return 'Pinned Notes';
    const nb = notebooks.find((n) => n.id === activeFilter);
    return nb?.name ?? 'Notes';
  })();

  return {
    ...state,
    filteredNotes,
    filterTitle,
    refresh,
    selectNote,
    setFilter,
    createNotebook,
    deleteNotebook,
    createNote,
    updateNote,
    deleteNote,
    togglePin,
  };
}
