import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  AppError,
  createNotebook,
  createIncrementalBackup,
  createNote,
  deleteNotebook,
  deleteNote,
  ensureBaseDir,
  exportWorkspaceBackup,
  getBaseDir,
  getNote,
  getSettings,
  importWorkspaceBackup,
  listAllNotes,
  listDeletedNotes,
  listNotebooks,
  moveNote,
  purgeNote,
  rebuildNoteIndex,
  renameNotebook,
  restoreNote,
  runOptionalTrashCleanup,
  serializeAppError,
  updateNote,
  updateSettings,
  type AppSettings,
  type NoteStatus,
  type NoteTag,
} from './storage';
import { pathToFileURL } from 'node:url';

const isDev = !app.isPackaged;
const execFileAsync = promisify(execFile);

type Schema<T> = {
  parse: (input: unknown) => T;
};

function schemaError(message: string): never {
  throw new AppError('VALIDATION_ERROR', message);
}

function isSafeExternalUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);

    if (url.protocol === 'https:') {
      return true;
    }

    if (url.protocol === 'mailto:') {
      return true;
    }

    if (isDev && url.protocol === 'http:' && url.hostname === 'localhost') {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

function isAllowedAppUrl(rawUrl: string, appUrl: URL): boolean {
  try {
    const url = new URL(rawUrl);

    if (isDev) {
      return url.origin === appUrl.origin;
    }

    return url.protocol === 'file:' && url.pathname === appUrl.pathname;
  } catch {
    return false;
  }
}

const nonEmptyStringSchema: Schema<string> = {
  parse(input) {
    if (typeof input !== 'string' || input.trim().length === 0) {
      schemaError('Expected a non-empty string.');
    }

    return input;
  },
};

const noteStatusSchema: Schema<NoteStatus> = {
  parse(input) {
    if (
      input !== 'active' &&
      input !== 'onHold' &&
      input !== 'completed' &&
      input !== 'dropped'
    ) {
      schemaError('Invalid note status.');
    }

    return input;
  },
};

const noteTagSchema: Schema<NoteTag> = {
  parse(input) {
    if (!input || typeof input !== 'object') {
      schemaError('Expected a note tag object.');
    }

    const value = input as Record<string, unknown>;
    const keys = Object.keys(value);

    if (keys.some((key) => key !== 'label' && key !== 'color')) {
      schemaError('Unexpected fields in note tag payload.');
    }

    return {
      label: typeof value.label === 'string' ? value.label : schemaError('Expected tag label string.'),
      color: typeof value.color === 'string' ? value.color : schemaError('Expected tag color string.'),
    };
  },
};

const settingsPatchSchema: Schema<Partial<AppSettings>> = {
  parse(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      schemaError('Expected settings patch object.');
    }

    const value = input as Record<string, unknown>;
    const allowedKeys: (keyof AppSettings)[] = [
      'theme',
      'layoutMode',
      'editorFontSize',
      'lineWrap',
      'previewOpen',
    ];

    for (const key of Object.keys(value)) {
      if (!allowedKeys.includes(key as keyof AppSettings)) {
        schemaError(`Unexpected settings field: ${key}.`);
      }
    }

    if (
      value.theme !== undefined &&
      value.theme !== 'workbench-dark' &&
      value.theme !== 'workbench-light'
    ) {
      schemaError('Invalid settings.theme value.');
    }

    if (
      value.layoutMode !== undefined &&
      value.layoutMode !== 'workbench' &&
      value.layoutMode !== 'writer' &&
      value.layoutMode !== 'editor'
    ) {
      schemaError('Invalid settings.layoutMode value.');
    }

    if (
      value.editorFontSize !== undefined &&
      value.editorFontSize !== 'sm' &&
      value.editorFontSize !== 'md' &&
      value.editorFontSize !== 'lg'
    ) {
      schemaError('Invalid settings.editorFontSize value.');
    }

    if (
      value.lineWrap !== undefined &&
      value.lineWrap !== 'wrap' &&
      value.lineWrap !== 'scroll'
    ) {
      schemaError('Invalid settings.lineWrap value.');
    }

    if (value.previewOpen !== undefined && typeof value.previewOpen !== 'boolean') {
      schemaError('Invalid settings.previewOpen value.');
    }

    return value as Partial<AppSettings>;
  },
};

function tupleSchema<T extends unknown[]>(...schemas: { [K in keyof T]: Schema<T[K]> }): Schema<T> {
  return {
    parse(input) {
      if (!Array.isArray(input) || input.length !== schemas.length) {
        schemaError(`Expected ${schemas.length} argument(s).`);
      }

      return schemas.map((schema, index) => schema.parse(input[index])) as T;
    },
  };
}

function normalizeProfileName(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized || null;
}

function getShortName(value: string | null | undefined): string {
  const normalized = normalizeProfileName(value);
  if (!normalized) {
    return 'Workspace';
  }

  const firstName = normalized.split(' ')[0].toLowerCase();
  return firstName.charAt(0).toUpperCase() + firstName.slice(1);
}

async function getDesktopProfile() {
  let fullName =
    normalizeProfileName(process.env.FULLNAME) ??
    normalizeProfileName(process.env.NAME);

  if (!fullName && process.platform === 'darwin') {
    try {
      const { stdout } = await execFileAsync('id', ['-F']);
      fullName = normalizeProfileName(stdout);
    } catch {
      fullName = null;
    }
  }

  const fallbackName =
    normalizeProfileName(process.env.USERNAME) ??
    normalizeProfileName(process.env.USER) ??
    normalizeProfileName(os.userInfo().username);

  return {
    fullName: fullName ?? fallbackName,
    shortName: getShortName(fullName ?? fallbackName),
  };
}

function dataDir(): string {
  return getBaseDir();
}

function registerValidatedHandler<Payload>(
  channel: string,
  schema: Schema<Payload>,
  handler: (payload: Payload) => Promise<unknown>
) {
  ipcMain.handle(channel, async (_event, ...rawArgs: unknown[]) => {
    try {
      const payload = schema.parse(rawArgs);
      return await handler(payload);
    } catch (error) {
      throw new Error(serializeAppError(error));
    }
  });
}

function registerHandler(channel: string, handler: () => Promise<unknown>) {
  ipcMain.handle(channel, async () => {
    try {
      return await handler();
    } catch (error) {
      throw new Error(serializeAppError(error));
    }
  });
}

const notesCreateSchema: Schema<{
  notebookId: string;
  title: string;
  body?: string;
}> = {
  parse(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      schemaError('Expected notes:create payload object.');
    }

    const value = input as Record<string, unknown>;
    const keys = Object.keys(value);

    if (keys.some((key) => key !== 'notebookId' && key !== 'title' && key !== 'body')) {
      schemaError('Unexpected fields in notes:create payload.');
    }

    if (typeof value.notebookId !== 'string' || value.notebookId.trim().length === 0) {
      schemaError('notes:create notebookId must be a non-empty string.');
    }

    if (typeof value.title !== 'string' || value.title.trim().length === 0) {
      schemaError('notes:create title must be a non-empty string.');
    }

    if (value.body !== undefined && typeof value.body !== 'string') {
      schemaError('notes:create body must be a string when provided.');
    }

    return {
      notebookId: value.notebookId,
      title: value.title,
      ...(value.body !== undefined ? { body: value.body } : {}),
    };
  },
};

const notesUpdateSchema: Schema<{
  id: string;
  notebookId: string;
  title?: string;
  body?: string;
  tags?: NoteTag[];
  pinned?: boolean;
  status?: NoteStatus;
}> = {
  parse(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      schemaError('Expected notes:update payload object.');
    }

    const value = input as Record<string, unknown>;
    const allowed = ['id', 'notebookId', 'title', 'body', 'tags', 'pinned', 'status'];

    for (const key of Object.keys(value)) {
      if (!allowed.includes(key)) {
        schemaError(`Unexpected fields in notes:update payload: ${key}.`);
      }
    }

    if (typeof value.id !== 'string' || value.id.trim().length === 0) {
      schemaError('notes:update id must be a non-empty string.');
    }

    if (typeof value.notebookId !== 'string' || value.notebookId.trim().length === 0) {
      schemaError('notes:update notebookId must be a non-empty string.');
    }

    if (value.title !== undefined && typeof value.title !== 'string') {
      schemaError('notes:update title must be a string when provided.');
    }

    if (value.body !== undefined && typeof value.body !== 'string') {
      schemaError('notes:update body must be a string when provided.');
    }

    if (value.pinned !== undefined && typeof value.pinned !== 'boolean') {
      schemaError('notes:update pinned must be a boolean when provided.');
    }

    if (value.status !== undefined) {
      noteStatusSchema.parse(value.status);
    }

    if (value.tags !== undefined) {
      if (!Array.isArray(value.tags)) {
        schemaError('notes:update tags must be an array when provided.');
      }

      value.tags.forEach((tag) => noteTagSchema.parse(tag));
    }

    return {
      id: value.id,
      notebookId: value.notebookId,
      ...(value.title !== undefined ? { title: value.title } : {}),
      ...(value.body !== undefined ? { body: value.body } : {}),
      ...(value.tags !== undefined ? { tags: value.tags as NoteTag[] } : {}),
      ...(value.pinned !== undefined ? { pinned: value.pinned } : {}),
      ...(value.status !== undefined ? { status: value.status as NoteStatus } : {}),
    };
  },
};

const notesRestoreSchema: Schema<[string, string | undefined]> = {
  parse(input) {
    if (!Array.isArray(input) || input.length < 1 || input.length > 2) {
      schemaError('Expected 1 or 2 argument(s).');
    }

    const [noteId, notebookId] = input;
    const parsedNoteId = nonEmptyStringSchema.parse(noteId);

    if (notebookId !== undefined && typeof notebookId !== 'string') {
      schemaError('notes:restore notebookId must be a string when provided.');
    }

    return [parsedNoteId, notebookId?.trim() || undefined];
  },
};

async function createWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 720,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#071119',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const appUrl = isDev
    ? new URL('http://localhost:5173')
    : pathToFileURL(path.join(__dirname, '../dist/index.html'));

  window.webContents.on('will-navigate', (event, url) => {
    if (isAllowedAppUrl(url, appUrl)) {
      return;
    }

    event.preventDefault();

    if (isSafeExternalUrl(url)) {
      void shell.openExternal(url);
    }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) {
      void shell.openExternal(url);
    }

    return { action: 'deny' };
  });

  if (isDev) {
    await window.loadURL(appUrl.toString());
    window.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  await window.loadURL(appUrl.toString());
}

app.whenReady().then(async () => {
  await ensureBaseDir(dataDir());
  await runOptionalTrashCleanup(dataDir(), {
    enabled: process.env.SMARTKMARK_ENABLE_TRASH_CLEANUP === '1',
  });
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

registerValidatedHandler('notebooks:list', tupleSchema(), async () => listNotebooks(dataDir()));
registerValidatedHandler('notebooks:create', tupleSchema(nonEmptyStringSchema), async ([name]) =>
  createNotebook(dataDir(), name)
);
registerValidatedHandler(
  'notebooks:rename',
  tupleSchema(nonEmptyStringSchema, nonEmptyStringSchema),
  async ([id, newName]) => renameNotebook(dataDir(), id, newName)
);
registerValidatedHandler('notebooks:delete', tupleSchema(nonEmptyStringSchema), async ([id]) =>
  deleteNotebook(dataDir(), id)
);

registerValidatedHandler('notes:list', tupleSchema(), async () => listAllNotes(dataDir()));
registerValidatedHandler('notes:listDeleted', tupleSchema(), async () =>
  listDeletedNotes(dataDir())
);
registerValidatedHandler(
  'notes:get',
  tupleSchema(nonEmptyStringSchema, nonEmptyStringSchema),
  async ([notebookId, noteId]) => getNote(dataDir(), notebookId, noteId)
);
registerValidatedHandler('notes:create', tupleSchema(notesCreateSchema), async ([payload]) =>
  createNote(dataDir(), payload)
);
registerValidatedHandler('notes:update', tupleSchema(notesUpdateSchema), async ([payload]) =>
  updateNote(dataDir(), payload)
);
registerValidatedHandler(
  'notes:delete',
  tupleSchema(nonEmptyStringSchema, nonEmptyStringSchema),
  async ([notebookId, noteId]) => deleteNote(dataDir(), notebookId, noteId)
);
registerValidatedHandler('notes:restore', notesRestoreSchema, async ([noteId, notebookId]) =>
  restoreNote(dataDir(), noteId, notebookId)
);
registerValidatedHandler('notes:purge', tupleSchema(nonEmptyStringSchema), async ([noteId]) =>
  purgeNote(dataDir(), noteId)
);
registerValidatedHandler(
  'notes:move',
  tupleSchema(nonEmptyStringSchema, nonEmptyStringSchema, nonEmptyStringSchema),
  async ([noteId, fromNotebookId, toNotebookId]) =>
    moveNote(dataDir(), noteId, fromNotebookId, toNotebookId)
);
registerHandler('notes:rebuild-index', async () => rebuildNoteIndex(dataDir()));

registerValidatedHandler('profile:get', tupleSchema(), async () => getDesktopProfile());
registerValidatedHandler('settings:get', tupleSchema(), async () => getSettings(dataDir()));
registerValidatedHandler('settings:update', tupleSchema(settingsPatchSchema), async ([patch]) =>
  updateSettings(dataDir(), patch)
);
registerHandler('backup:export', async () => {
  const result = await dialog.showSaveDialog({
    title: 'Export SmartKMark workspace backup',
    defaultPath: `smartkmark-workspace-${new Date().toISOString().slice(0, 10)}.zip`,
    filters: [{ name: 'ZIP Archives', extensions: ['zip'] }],
  });

  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  const exportedPath = await exportWorkspaceBackup(dataDir(), result.filePath);
  return { canceled: false, filePath: exportedPath };
});

registerHandler('backup:import', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Import SmartKMark workspace backup',
    properties: ['openFile'],
    filters: [{ name: 'ZIP Archives', extensions: ['zip'] }],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  await importWorkspaceBackup(dataDir(), result.filePaths[0]);
  return { canceled: false };
});

registerHandler('backup:createIncremental', async () => {
  const backupPath = await createIncrementalBackup(dataDir());
  return { filePath: backupPath };
});
