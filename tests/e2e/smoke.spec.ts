import { expect, test } from '@playwright/test';

test('renderer smoke covers notebook rename, note move, metadata edits, and theme persistence', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const NOTEBOOKS_KEY = 'smartkmark-e2e-notebooks';
    const NOTES_KEY = 'smartkmark-e2e-notes';
    const SETTINGS_KEY = 'smartkmark-e2e-settings';

    const readNotebooks = () =>
      JSON.parse(
        window.localStorage.getItem(NOTEBOOKS_KEY) ??
          JSON.stringify([{ id: 'Inbox', name: 'Inbox' }])
      ) as Array<{ id: string; name: string }>;

    const writeNotebooks = (notebooks: unknown) =>
      window.localStorage.setItem(NOTEBOOKS_KEY, JSON.stringify(notebooks));

    const readNotes = () =>
      JSON.parse(window.localStorage.getItem(NOTES_KEY) ?? '[]') as Array<{
        id: string;
        title: string;
        notebookId: string;
        tags: Array<{ label: string; color: string }>;
        pinned: boolean;
        status: 'active' | 'onHold' | 'completed' | 'dropped';
        createdAt: string;
        updatedAt: string;
        body: string;
      }>;

    const writeNotes = (notes: unknown) =>
      window.localStorage.setItem(NOTES_KEY, JSON.stringify(notes));

    const readSettings = () =>
      JSON.parse(
        window.localStorage.getItem(SETTINGS_KEY) ??
          '{"theme":"workbench-dark","layoutMode":"workbench","editorFontSize":"md","lineWrap":"wrap","previewOpen":true}'
      );

    const writeSettings = (settings: unknown) =>
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

    Object.defineProperty(window, 'desktopApi', {
      configurable: true,
      value: {
        listNotebooks: async () => readNotebooks(),
        createNotebook: async (name: string) => {
          const notebooks = readNotebooks();
          const created = { id: name, name };
          writeNotebooks([...notebooks, created]);
          return created;
        },
        renameNotebook: async (id: string, name: string) => {
          const notebooks = readNotebooks().map((notebook) =>
            notebook.id === id ? { id: name, name } : notebook
          );
          const notes = readNotes().map((note) =>
            note.notebookId === id ? { ...note, notebookId: name } : note
          );
          writeNotebooks(notebooks);
          writeNotes(notes);
          return { id: name, name };
        },
        deleteNotebook: async (id: string) => {
          writeNotebooks(readNotebooks().filter((notebook) => notebook.id !== id));
          writeNotes(readNotes().filter((note) => note.notebookId !== id));
        },
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
          writeNotes([...readNotes(), note]);
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
          writeNotes(notes);
          return note;
        },
        getProfile: async () => ({
          fullName: 'Rafael Ribeiro',
          shortName: 'rafael',
        }),
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
  await expect(
    page.getByRole('heading', { name: 'Developer Workbench' })
  ).toBeVisible();

  await page
    .getByRole('button', { name: 'Create notebook', exact: true })
    .click();
  await page.getByLabel('New notebook name').fill('Drafts');
  await page.getByLabel('New notebook name').press('Enter');
  await expect(
    page.getByRole('button', { name: 'Drafts', exact: true })
  ).toBeVisible();

  await page.getByTitle('Rename Drafts').click();
  await page.getByLabel('Rename Drafts').fill('Backend Notes');
  await page.getByLabel('Rename Drafts').press('Enter');
  await expect(
    page.getByRole('button', { name: 'Backend Notes', exact: true })
  ).toBeVisible();

  await page.getByRole('button', { name: 'Create note', exact: true }).click();
  await page.getByPlaceholder('Note title...').fill('Playwright Smoke');
  await expect(page.locator('.cm-content')).toBeVisible();
  await page.locator('.cm-content').click();
  await page.keyboard.type('# Hello from renderer smoke');
  await page.waitForTimeout(1200);

  await page.getByLabel('Move note to notebook').selectOption('Backend Notes');
  await expect(
    page.getByRole('button', { name: 'Backend Notes', exact: true })
  ).toBeVisible();

  await page.getByLabel('Note status').selectOption('completed');
  await page.getByLabel('New tag name').fill('api');
  await page.getByLabel('New tag color').selectOption('green');
  await page.getByTitle('Add tag').click();
  await expect(
    page.getByRole('button', { name: 'Remove api tag', exact: true })
  ).toBeVisible();

  await page.getByRole('button', { name: 'Toggle theme' }).click();
  await expect(page.locator('html')).toHaveAttribute(
    'data-theme',
    'workbench-light'
  );
  await page.getByLabel('Layout').selectOption('writer');
  await expect(
    page.getByText('Developer Workbench', { exact: true }).first()
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Backend Notes', exact: true })
  ).toBeHidden();
  await page.getByLabel('Layout').selectOption('editor');
  await expect(page.getByLabel('Layout')).toHaveValue('editor');
  await expect(page.getByText('Notes', { exact: true })).toBeHidden();
  await page.getByLabel('Layout').selectOption('workbench');

  await page.reload();

  await expect(page.locator('html')).toHaveAttribute(
    'data-theme',
    'workbench-light'
  );
  await expect(page.getByLabel('Layout')).toHaveValue('workbench');
  await expect(
    page.getByRole('button', { name: 'Backend Notes', exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Playwright Smoke/i }).first()
  ).toBeVisible();
  await page.getByRole('button', { name: /Playwright Smoke/i }).first().click();
  await expect(page.getByLabel('Move note to notebook')).toHaveValue(
    'Backend Notes'
  );
  await expect(page.getByLabel('Note status')).toHaveValue('completed');
  await expect(
    page.getByRole('button', { name: 'Remove api tag', exact: true })
  ).toBeVisible();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
});
