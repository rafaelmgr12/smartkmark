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
const ZIP_ARCHIVE_FILTERS = [{ name: 'ZIP Archives', extensions: ['zip'] }];
const SETTINGS_PATCH_KEYS = [
  'theme',
  'layoutMode',
  'editorFontSize',
  'lineWrap',
  'previewOpen',
] as const satisfies readonly (keyof AppSettings)[];
const NOTES_CREATE_KEYS = ['notebookId', 'title', 'body'] as const;
const NOTES_UPDATE_KEYS = [
  'id',
  'notebookId',
  'title',
  'body',
  'tags',
  'pinned',
  'status',
] as const;
const PATH_SEPARATOR_PATTERN = /[\\/]/;

type Schema<T> = {
  parse: (input: unknown) => T;
};

type AsyncHandler<Payload> = (payload: Payload) => Promise<unknown>;
type AsyncVoidHandler = () => Promise<unknown>;

function schemaError(message: string): never {
  throw new AppError('VALIDATION_ERROR', message);
}

function parseObjectRecord(input: unknown, message: string): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    schemaError(message);
  }

  return input as Record<string, unknown>;
}

function assertOnlyAllowedKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  message: (key: string) => string
) {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      schemaError(message(key));
    }
  }
}

function parseUrl(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

function isSafeExternalUrl(rawUrl: string): boolean {
  const url = parseUrl(rawUrl);

  if (!url) {
    return false;
  }

  if (url.protocol === 'https:' || url.protocol === 'mailto:') {
    return true;
  }

  return isDev && url.protocol === 'http:' && url.hostname === 'localhost';
}

function isAllowedAppUrl(rawUrl: string, appUrl: URL): boolean {
  const url = parseUrl(rawUrl);

  if (!url) {
    return false;
  }

  if (isDev) {
    return url.origin === appUrl.origin;
  }

  return url.protocol === 'file:' && url.pathname === appUrl.pathname;
}

function getAppEntryUrl(): URL {
  return isDev
    ? new URL('http://localhost:5173')
    : pathToFileURL(path.join(__dirname, '../dist/index.html'));
}

function openExternalIfSafe(url: string) {
  if (isSafeExternalUrl(url)) {
    void shell.openExternal(url);
  }
}

function configureWindowNavigation(mainWindow: BrowserWindow, appUrl: URL) {
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isAllowedAppUrl(url, appUrl)) {
      return;
    }

    event.preventDefault();
    openExternalIfSafe(url);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalIfSafe(url);
    return { action: 'deny' };
  });
}

function wrapIpcError(error: unknown): never {
  throw new Error(serializeAppError(error));
}

const nonEmptyStringSchema: Schema<string> = {
  parse(input) {
    if (typeof input !== 'string' || input.trim().length === 0) {
      schemaError('Expected a non-empty string.');
    }

    return input;
  },
};

function parseSafeId(input: unknown, label: string): string {
  if (typeof input !== 'string' || input.trim().length === 0) {
    schemaError(`${label} must be a non-empty string.`);
  }

  if (path.isAbsolute(input) || PATH_SEPARATOR_PATTERN.test(input) || input.includes('..')) {
    schemaError(`${label} contains invalid path characters.`);
  }

  return input;
}

const safeNotebookIdSchema: Schema<string> = {
  parse(input) {
    return parseSafeId(input, 'Notebook ID');
  },
};

const safeNoteIdSchema: Schema<string> = {
  parse(input) {
    return parseSafeId(input, 'Note ID');
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
    const value = parseObjectRecord(input, 'Expected a note tag object.');
    assertOnlyAllowedKeys(value, ['label', 'color'], () => 'Unexpected fields in note tag payload.');

    return {
      label: typeof value.label === 'string' ? value.label : schemaError('Expected tag label string.'),
      color: typeof value.color === 'string' ? value.color : schemaError('Expected tag color string.'),
    };
  },
};

const settingsPatchSchema: Schema<Partial<AppSettings>> = {
  parse(input) {
    const value = parseObjectRecord(input, 'Expected settings patch object.');
    assertOnlyAllowedKeys(value, SETTINGS_PATCH_KEYS, (key) => `Unexpected settings field: ${key}.`);

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
  handler: AsyncHandler<Payload>
) {
  ipcMain.handle(channel, async (_event, ...rawArgs: unknown[]) => {
    try {
      const payload = schema.parse(rawArgs);
      return await handler(payload);
    } catch (error) {
      wrapIpcError(error);
    }
  });
}

function registerHandler(channel: string, handler: AsyncVoidHandler) {
  ipcMain.handle(channel, async () => {
    try {
      return await handler();
    } catch (error) {
      wrapIpcError(error);
    }
  });
}

const notesCreateSchema: Schema<{
  notebookId: string;
  title: string;
  body?: string;
}> = {
  parse(input) {
    const value = parseObjectRecord(input, 'Expected notes:create payload object.');
    assertOnlyAllowedKeys(value, NOTES_CREATE_KEYS, () => 'Unexpected fields in notes:create payload.');

    const notebookId = safeNotebookIdSchema.parse(value.notebookId);

    if (typeof value.title !== 'string' || value.title.trim().length === 0) {
      schemaError('notes:create title must be a non-empty string.');
    }

    if (value.body !== undefined && typeof value.body !== 'string') {
      schemaError('notes:create body must be a string when provided.');
    }

    return {
      notebookId,
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
    const value = parseObjectRecord(input, 'Expected notes:update payload object.');
    assertOnlyAllowedKeys(
      value,
      NOTES_UPDATE_KEYS,
      (key) => `Unexpected fields in notes:update payload: ${key}.`
    );

    const id = safeNoteIdSchema.parse(value.id);
    const notebookId = safeNotebookIdSchema.parse(value.notebookId);

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
      id,
      notebookId,
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
    const parsedNoteId = safeNoteIdSchema.parse(noteId);

    if (notebookId !== undefined) {
      return [parsedNoteId, safeNotebookIdSchema.parse(notebookId)];
    }

    return [parsedNoteId, undefined];
  },
};

function createMainWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
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

  configureWindowNavigation(mainWindow, getAppEntryUrl());
  return mainWindow;
}

async function loadMainWindow(mainWindow: BrowserWindow): Promise<void> {
  const appUrl = getAppEntryUrl();
  if (isDev) {
    await mainWindow.loadURL(appUrl.toString());
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  await mainWindow.loadURL(appUrl.toString());
}

async function exportBackup() {
  const result = await dialog.showSaveDialog({
    title: 'Export SmartKMark workspace backup',
    defaultPath: `smartkmark-workspace-${new Date().toISOString().slice(0, 10)}.zip`,
    filters: ZIP_ARCHIVE_FILTERS,
  });

  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  const exportedPath = await exportWorkspaceBackup(dataDir(), result.filePath);
  return { canceled: false, filePath: exportedPath };
}

async function importBackup() {
  const result = await dialog.showOpenDialog({
    title: 'Import SmartKMark workspace backup',
    properties: ['openFile'],
    filters: ZIP_ARCHIVE_FILTERS,
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  await importWorkspaceBackup(dataDir(), result.filePaths[0]);
  return { canceled: false };
}

async function createIncrementalWorkspaceBackup() {
  const backupPath = await createIncrementalBackup(dataDir());
  return { filePath: backupPath };
}

function registerNotebookHandlers() {
  registerValidatedHandler('notebooks:list', tupleSchema(), async () => listNotebooks(dataDir()));
  registerValidatedHandler('notebooks:create', tupleSchema(nonEmptyStringSchema), async ([name]) =>
    createNotebook(dataDir(), name)
  );
  registerValidatedHandler(
    'notebooks:rename',
    tupleSchema(safeNotebookIdSchema, nonEmptyStringSchema),
    async ([id, newName]) => renameNotebook(dataDir(), id, newName)
  );
  registerValidatedHandler('notebooks:delete', tupleSchema(safeNotebookIdSchema), async ([id]) =>
    deleteNotebook(dataDir(), id)
  );
}

function registerNoteHandlers() {
  registerValidatedHandler('notes:list', tupleSchema(), async () => listAllNotes(dataDir()));
  registerValidatedHandler('notes:listDeleted', tupleSchema(), async () =>
    listDeletedNotes(dataDir())
  );
  registerValidatedHandler(
    'notes:get',
    tupleSchema(safeNotebookIdSchema, safeNoteIdSchema),
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
    tupleSchema(safeNotebookIdSchema, safeNoteIdSchema),
    async ([notebookId, noteId]) => deleteNote(dataDir(), notebookId, noteId)
  );
  registerValidatedHandler('notes:restore', notesRestoreSchema, async ([noteId, notebookId]) =>
    restoreNote(dataDir(), noteId, notebookId)
  );
  registerValidatedHandler('notes:purge', tupleSchema(safeNoteIdSchema), async ([noteId]) =>
    purgeNote(dataDir(), noteId)
  );
  registerValidatedHandler(
    'notes:move',
    tupleSchema(safeNoteIdSchema, safeNotebookIdSchema, safeNotebookIdSchema),
    async ([noteId, fromNotebookId, toNotebookId]) =>
      moveNote(dataDir(), noteId, fromNotebookId, toNotebookId)
  );
  registerHandler('notes:rebuild-index', async () => rebuildNoteIndex(dataDir()));
}

function registerProfileHandlers() {
  registerValidatedHandler('profile:get', tupleSchema(), async () => getDesktopProfile());
}

function registerSettingsHandlers() {
  registerValidatedHandler('settings:get', tupleSchema(), async () => getSettings(dataDir()));
  registerValidatedHandler('settings:update', tupleSchema(settingsPatchSchema), async ([patch]) =>
    updateSettings(dataDir(), patch)
  );
}

function registerBackupHandlers() {
  registerHandler('backup:export', exportBackup);
  registerHandler('backup:import', importBackup);
  registerHandler('backup:createIncremental', createIncrementalWorkspaceBackup);
}

function registerIpcHandlers() {
  registerNotebookHandlers();
  registerNoteHandlers();
  registerProfileHandlers();
  registerSettingsHandlers();
  registerBackupHandlers();
}

async function openMainWindow() {
  const mainWindow = createMainWindow();
  await loadMainWindow(mainWindow);
}

async function bootstrapApp() {
  await ensureBaseDir(dataDir());
  await runOptionalTrashCleanup(dataDir(), {
    enabled: process.env.SMARTKMARK_ENABLE_TRASH_CLEANUP === '1',
  });
  await openMainWindow();
}

function registerApplicationEvents() {
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void openMainWindow();
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}

registerIpcHandlers();
registerApplicationEvents();

app.whenReady().then(bootstrapApp);
