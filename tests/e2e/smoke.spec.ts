import { expect, test } from '@playwright/test';

test('creates and persists a note in the production renderer build', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const NOTES_KEY = 'smartkmark-e2e-notes';
    const SETTINGS_KEY = 'smartkmark-e2e-settings';
    const NOTEBOOKS = [{ id: 'Inbox', name: 'Inbox' }];

    const readNotes = () =>
      JSON.parse(window.localStorage.getItem(NOTES_KEY) ?? '[]') as Array<{
        id: string;
        title: string;
        notebookId: string;
        tags: Array<{ label: string; color: string }>;
        pinned: boolean;
        status: 'active';
        createdAt: string;
        updatedAt: string;
        body: string;
      }>;
    const writeNotes = (notes: unknown) =>
      window.localStorage.setItem(NOTES_KEY, JSON.stringify(notes));

    const readSettings = () =>
      JSON.parse(
        window.localStorage.getItem(SETTINGS_KEY) ??
          '{"theme":"workbench","editorFontSize":"md","lineWrap":"wrap","previewOpen":true}'
      );

    const writeSettings = (settings: unknown) =>
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

    Object.defineProperty(window, 'desktopApi', {
      configurable: true,
      value: {
        listNotebooks: async () => NOTEBOOKS,
        createNotebook: async (name: string) => ({ id: name, name }),
        renameNotebook: async (id: string, name: string) => ({ id, name }),
        deleteNotebook: async () => undefined,
        listNotes: async () =>
          readNotes()
            .map((note) => ({
              id: note.id,
              title: note.title,
              notebookId: note.notebookId,
              tags: note.tags,
              pinned: note.pinned,
              status: note.status,
              createdAt: note.createdAt,
              updatedAt: note.updatedAt,
            }))
            .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
        getNote: async (_notebookId: string, noteId: string) =>
          readNotes().find((note) => note.id === noteId),
        createNote: async ({
          notebookId,
          title,
          body = '',
        }: {
          notebookId: string;
          title: string;
          body?: string;
        }) => {
          const now = new Date().toISOString();
          const note = {
            id: crypto.randomUUID(),
            title,
            notebookId,
            tags: [],
            pinned: false,
            status: 'active' as const,
            createdAt: now,
            updatedAt: now,
            body,
          };
          const notes = readNotes();
          writeNotes([...notes, note]);
          return note;
        },
        updateNote: async (patch: Record<string, unknown>) => {
          const notes = readNotes();
          const note = notes.find((entry) => entry.id === patch.id);
          if (!note) {
            throw new Error('Note not found');
          }

          Object.assign(note, patch, { updatedAt: new Date().toISOString() });
          writeNotes(notes);
          return note;
        },
        deleteNote: async (_notebookId: string, noteId: string) => {
          writeNotes(readNotes().filter((note) => note.id !== noteId));
        },
        moveNote: async () => {
          throw new Error('Not implemented in smoke mock');
        },
        getSettings: async () => readSettings(),
        updateSettings: async (patch: Record<string, unknown>) => {
          const next = { ...readSettings(), ...patch };
          writeSettings(next);
          return next;
        },
      },
    });
  });

  await page.goto('/');
  await page.getByLabel('Create note').click();
  await page.getByPlaceholder('Note title...').fill('Playwright Smoke');
  await page.locator('.cm-content').click();
  await page.keyboard.type('# Hello from Electron');
  await page.waitForTimeout(1500);
  await page.reload();
  await expect(page.getByText('Playwright Smoke')).toBeVisible();
  await page.getByText('Playwright Smoke').click();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
});
