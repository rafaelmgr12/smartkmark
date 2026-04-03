import type { Page } from '@playwright/test';
import type { AppSettings, Note, NoteTag, Notebook } from '../../src/types';
import { createDesktopSeed, type DesktopSeed } from '../../src/test/factories';

export async function installDesktopApiFixture(
  page: Page,
  seedOverrides: Partial<DesktopSeed> = {}
) {
  const seed = createDesktopSeed(seedOverrides);

  await page.addInitScript(
    ({ seed: initialSeed }) => {
      const clone = <T,>(value: T): T => structuredClone(value);
      const sortNotes = <T extends { updatedAt: string }>(notes: T[]) =>
        [...notes].sort(
          (left, right) =>
            new Date(right.updatedAt).getTime() -
            new Date(left.updatedAt).getTime()
        );

      const STORAGE_KEYS = {
        profile: 'smartkmark-e2e-profile',
        notebooks: 'smartkmark-e2e-notebooks',
        notes: 'smartkmark-e2e-notes',
        settings: 'smartkmark-e2e-settings',
      } as const;

      const read = <T,>(key: string, fallback: T): T =>
        JSON.parse(
          window.localStorage.getItem(key) ?? JSON.stringify(fallback)
        ) as T;

      const write = (key: string, value: unknown) => {
        window.localStorage.setItem(key, JSON.stringify(value));
      };

      if (!window.localStorage.getItem(STORAGE_KEYS.profile)) {
        write(STORAGE_KEYS.profile, initialSeed.profile);
      }
      if (!window.localStorage.getItem(STORAGE_KEYS.notebooks)) {
        write(STORAGE_KEYS.notebooks, initialSeed.notebooks);
      }
      if (!window.localStorage.getItem(STORAGE_KEYS.notes)) {
        write(STORAGE_KEYS.notes, initialSeed.notes);
      }
      if (!window.localStorage.getItem(STORAGE_KEYS.settings)) {
        write(STORAGE_KEYS.settings, initialSeed.settings);
      }

      const readProfile = () => read(STORAGE_KEYS.profile, initialSeed.profile);
      const readNotebooks = () =>
        read(STORAGE_KEYS.notebooks, initialSeed.notebooks);
      const readNotes = () => read(STORAGE_KEYS.notes, initialSeed.notes);
      const readSettings = () =>
        read(STORAGE_KEYS.settings, initialSeed.settings);

      const toMeta = (note: Note) => ({
        id: note.id,
        title: note.title,
        notebookId: note.notebookId,
        tags: clone(note.tags),
        pinned: note.pinned,
        status: note.status,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
      });

      const createNotebookId = (name: string, notebooks: Notebook[]) => {
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
      };

      Object.defineProperty(window, 'desktopApi', {
        configurable: true,
        value: {
          listNotebooks: async () => clone(readNotebooks()),
          createNotebook: async (name: string) => {
            const notebooks = readNotebooks();
            const id = createNotebookId(name, notebooks);
            const notebook = { id, name: id };
            notebooks.push(notebook);
            notebooks.sort((left, right) => left.name.localeCompare(right.name));
            write(STORAGE_KEYS.notebooks, notebooks);
            return clone(notebook);
          },
          renameNotebook: async (id: string, name: string) => {
            const notebooks = readNotebooks();
            const notes = readNotes();
            const notebook = notebooks.find((entry) => entry.id === id);
            if (!notebook) {
              throw new Error('Notebook not found');
            }

            const nextId = createNotebookId(
              name,
              notebooks.filter((entry) => entry.id !== id)
            );
            notebook.id = nextId;
            notebook.name = nextId;
            const renamedNotes = notes.map((note) =>
              note.notebookId === id ? { ...note, notebookId: nextId } : note
            );
            write(STORAGE_KEYS.notebooks, notebooks);
            write(STORAGE_KEYS.notes, renamedNotes);
            return clone(notebook);
          },
          deleteNotebook: async (id: string) => {
            write(
              STORAGE_KEYS.notebooks,
              readNotebooks().filter((notebook) => notebook.id !== id)
            );
            write(
              STORAGE_KEYS.notes,
              readNotes().filter((note) => note.notebookId !== id)
            );
          },
          listNotes: async () =>
            sortNotes(readNotes().map((note) => toMeta(note))).map((note) =>
              clone(note)
            ),
          getNote: async (_notebookId: string, noteId: string) => {
            const note = readNotes().find((entry) => entry.id === noteId);
            if (!note) {
              throw new Error('Note not found');
            }

            return clone(note);
          },
          createNote: async (payload: {
            notebookId: string;
            title: string;
            body?: string;
          }) => {
            const notes = readNotes();
            const timestamp = new Date().toISOString();
            const note: Note = {
              id: `note-${notes.length + 1}`,
              title: payload.title.trim() || 'Untitled',
              notebookId: payload.notebookId,
              tags: [],
              pinned: false,
              status: 'active',
              createdAt: timestamp,
              updatedAt: timestamp,
              body: payload.body ?? '',
            };
            write(STORAGE_KEYS.notes, [...notes, note]);
            return clone(note);
          },
          updateNote: async (payload: {
            id: string;
            notebookId: string;
            title?: string;
            body?: string;
            tags?: NoteTag[];
            pinned?: boolean;
            status?: Note['status'];
          }) => {
            const notes = readNotes();
            const note = notes.find((entry) => entry.id === payload.id);
            if (!note) {
              throw new Error('Note not found');
            }

            note.notebookId = payload.notebookId ?? note.notebookId;
            note.title = payload.title ?? note.title;
            note.body = payload.body ?? note.body;
            note.tags = clone(payload.tags ?? note.tags);
            note.pinned = payload.pinned ?? note.pinned;
            note.status = payload.status ?? note.status;
            note.updatedAt = new Date().toISOString();
            write(STORAGE_KEYS.notes, notes);
            return clone(note);
          },
          deleteNote: async (_notebookId: string, noteId: string) => {
            write(
              STORAGE_KEYS.notes,
              readNotes().filter((note) => note.id !== noteId)
            );
          },
          moveNote: async (
            noteId: string,
            fromNotebookId: string,
            toNotebookId: string
          ) => {
            const notes = readNotes();
            const note = notes.find(
              (entry) => entry.id === noteId && entry.notebookId === fromNotebookId
            );
            if (!note) {
              throw new Error('Note not found');
            }

            note.notebookId = toNotebookId;
            note.updatedAt = new Date().toISOString();
            write(STORAGE_KEYS.notes, notes);
            return clone(note);
          },
          getProfile: async () => clone(readProfile()),
          getSettings: async () => clone(readSettings() as AppSettings),
          updateSettings: async (patch: Partial<AppSettings>) => {
            const settings = { ...readSettings(), ...patch };
            write(STORAGE_KEYS.settings, settings);
            return clone(settings);
          },
        },
      });
    },
    { seed }
  );

  return seed;
}
