import { Menu, app, BrowserWindow, dialog, ipcMain } from 'electron';
import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import {
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
} from './storage';
import { configureWindowNavigation, getAppEntryUrl } from './navigation';
import {
  type Schema,
  nonEmptyStringSchema,
  notesCreateSchema,
  notesRestoreSchema,
  notesUpdateSchema,
  safeNotebookIdSchema,
  safeNoteIdSchema,
  settingsPatchSchema,
  tupleSchema,
} from './validators';

const isDev = !app.isPackaged;
const execFileAsync = promisify(execFile);
const ZIP_ARCHIVE_FILTERS = [{ name: 'ZIP Archives', extensions: ['zip'] }];
const ALLOWED_SPELLCHECK_LOCALES = ['pt-BR', 'es-ES', 'en-US'] as const;

type AsyncHandler<Payload> = (payload: Payload) => Promise<unknown>;
type AsyncVoidHandler = () => Promise<unknown>;
type SpellcheckLocale = (typeof ALLOWED_SPELLCHECK_LOCALES)[number];

function wrapIpcError(error: unknown): never {
  throw new Error(serializeAppError(error));
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

function resolveSpellcheckLocale(locale: unknown): SpellcheckLocale {
  return ALLOWED_SPELLCHECK_LOCALES.includes(locale as SpellcheckLocale)
    ? (locale as SpellcheckLocale)
    : 'en-US';
}

function applySpellcheckLocale(mainWindow: BrowserWindow, locale: unknown): void {
  const resolvedLocale = resolveSpellcheckLocale(locale);
  mainWindow.webContents.session.setSpellCheckerLanguages([resolvedLocale]);
}

function registerSpellcheckContextMenu(mainWindow: BrowserWindow): void {
  mainWindow.webContents.on('context-menu', (_event, params) => {
    const menuTemplate: Electron.MenuItemConstructorOptions[] = [];

    if (params.misspelledWord && params.dictionarySuggestions.length > 0) {
      for (const suggestion of params.dictionarySuggestions.slice(0, 6)) {
        menuTemplate.push({
          label: suggestion,
          click: () => mainWindow.webContents.replaceMisspelling(suggestion),
        });
      }
      menuTemplate.push({ type: 'separator' });
    }

    if (params.misspelledWord) {
      menuTemplate.push({
        label: 'Add to Dictionary',
        click: () =>
          mainWindow.webContents.session.addWordToSpellCheckerDictionary(
            params.misspelledWord
          ),
      });
      menuTemplate.push({ type: 'separator' });
    }

    menuTemplate.push({ role: 'undo' }, { role: 'redo' }, { type: 'separator' });
    menuTemplate.push({ role: 'cut' }, { role: 'copy' }, { role: 'paste' });
    menuTemplate.push({ role: 'selectAll' });

    Menu.buildFromTemplate(menuTemplate).popup({ window: mainWindow });
  });
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

  applySpellcheckLocale(mainWindow, 'en-US');
  registerSpellcheckContextMenu(mainWindow);
  configureWindowNavigation(mainWindow, getAppEntryUrl(isDev), isDev);
  return mainWindow;
}

async function loadMainWindow(mainWindow: BrowserWindow): Promise<void> {
  const appUrl = getAppEntryUrl(isDev);
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
  ipcMain.handle('settings:update', async (_event, ...rawArgs: unknown[]) => {
    try {
      const [patch] = tupleSchema(settingsPatchSchema).parse(rawArgs);
      const nextSettings = await updateSettings(dataDir(), patch);

      for (const mainWindow of BrowserWindow.getAllWindows()) {
        applySpellcheckLocale(mainWindow, nextSettings.spellcheckLocale);
      }

      return nextSettings;
    } catch (error) {
      wrapIpcError(error);
    }
  });
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
  const settings = await getSettings(dataDir());
  applySpellcheckLocale(mainWindow, settings.spellcheckLocale);
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
