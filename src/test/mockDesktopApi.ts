import { vi } from 'vitest';
import type {
  DesktopApi,
  Note,
  Notebook,
} from '../types';
import {
  createDesktopSeed,
  sortNotesByUpdatedAt,
  toNoteMeta,
  type DesktopSeed,
} from './factories';

function clone<T>(value: T): T {
  return structuredClone(value);
}

function createNotebookId(name: string, notebooks: Notebook[]) {
  const trimmed = name.trim();
  if (!trimmed) {
    return 'Untitled';
  }

  let candidate = trimmed;
  let suffix = 2;
  while (notebooks.some((notebook) => notebook.id === candidate)) {
    candidate = `${trimmed} ${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function nextTimestamp() {
  return new Date().toISOString();
}

export interface DesktopApiMockController {
  api: DesktopApi;
  mocks: {
    [K in keyof DesktopApi]: ReturnType<typeof vi.fn<DesktopApi[K]>>;
  };
  getState: () => DesktopSeed;
}

export function createDesktopApiMock(
  seedOverrides: Partial<DesktopSeed> = {}
): DesktopApiMockController {
  const state = createDesktopSeed(seedOverrides);
  let noteCounter = state.notes.length;

  const listNotebooks = vi.fn<DesktopApi['listNotebooks']>(async () =>
    clone(state.notebooks)
  );

  const createNotebook = vi.fn<DesktopApi['createNotebook']>(async (name) => {
    const id = createNotebookId(name, state.notebooks);
    const notebook = { id, name: id };
    state.notebooks.push(notebook);
    state.notebooks.sort((left, right) => left.name.localeCompare(right.name));
    return clone(notebook);
  });

  const renameNotebook = vi.fn<DesktopApi['renameNotebook']>(
    async (id, name) => {
      const notebook = state.notebooks.find((entry) => entry.id === id);
      if (!notebook) {
        throw new Error('Notebook not found');
      }

      const nextId = createNotebookId(name, state.notebooks.filter((entry) => entry.id !== id));
      notebook.id = nextId;
      notebook.name = nextId;
      state.notes = state.notes.map((note) =>
        note.notebookId === id ? { ...note, notebookId: nextId } : note
      );
      return clone(notebook);
    }
  );

  const deleteNotebook = vi.fn<DesktopApi['deleteNotebook']>(async (id) => {
    state.notebooks = state.notebooks.filter((notebook) => notebook.id !== id);
    state.notes = state.notes.filter((note) => note.notebookId !== id);
  });

  const listNotes = vi.fn<DesktopApi['listNotes']>(async () =>
    sortNotesByUpdatedAt(state.notes.map((note) => toNoteMeta(note))).map((note) =>
      clone(note)
    )
  );

  const getNote = vi.fn<DesktopApi['getNote']>(async (_notebookId, noteId) => {
    const note = state.notes.find((entry) => entry.id === noteId);
    if (!note) {
      throw new Error('Note not found');
    }

    return clone(note);
  });

  const createNote = vi.fn<DesktopApi['createNote']>(async (payload) => {
    noteCounter += 1;
    const timestamp = nextTimestamp();
    const title = payload.title.trim() || 'Untitled';
    const note: Note = {
      id: `note-${noteCounter}`,
      title,
      notebookId: payload.notebookId,
      body: payload.body ?? '',
      tags: [],
      pinned: false,
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    state.notes.push(note);
    return clone(note);
  });

  const updateNote = vi.fn<DesktopApi['updateNote']>(async (payload) => {
    const note = state.notes.find((entry) => entry.id === payload.id);
    if (!note) {
      throw new Error('Note not found');
    }

    note.title = payload.title ?? note.title;
    note.body = payload.body ?? note.body;
    note.tags = clone(payload.tags ?? note.tags);
    note.pinned = payload.pinned ?? note.pinned;
    note.status = payload.status ?? note.status;
    note.notebookId = payload.notebookId ?? note.notebookId;
    note.updatedAt = nextTimestamp();
    return clone(note);
  });

  const deleteNote = vi.fn<DesktopApi['deleteNote']>(async (_notebookId, noteId) => {
    state.notes = state.notes.filter((note) => note.id !== noteId);
  });

  const moveNote = vi.fn<DesktopApi['moveNote']>(
    async (noteId, fromNotebookId, toNotebookId) => {
      const note = state.notes.find(
        (entry) => entry.id === noteId && entry.notebookId === fromNotebookId
      );
      if (!note) {
        throw new Error('Note not found');
      }

      note.notebookId = toNotebookId;
      note.updatedAt = nextTimestamp();
      return clone(note);
    }
  );

  const getProfile = vi.fn<DesktopApi['getProfile']>(async () =>
    clone(state.profile)
  );

  const getSettings = vi.fn<DesktopApi['getSettings']>(async () =>
    clone(state.settings)
  );

  const updateSettings = vi.fn<DesktopApi['updateSettings']>(async (patch) => {
    state.settings = { ...state.settings, ...patch };
    return clone(state.settings);
  });

  const mocks = {
    listNotebooks,
    createNotebook,
    renameNotebook,
    deleteNotebook,
    listNotes,
    getNote,
    createNote,
    updateNote,
    deleteNote,
    moveNote,
    getProfile,
    getSettings,
    updateSettings,
  };

  return {
    api: mocks,
    mocks,
    getState: () => clone(state),
  };
}

export function installDesktopApiMock(
  seedOverrides: Partial<DesktopSeed> = {}
): DesktopApiMockController {
  const controller = createDesktopApiMock(seedOverrides);
  window.desktopApi = controller.api;
  return controller;
}
