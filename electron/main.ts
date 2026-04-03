import { app, BrowserWindow, ipcMain } from 'electron';
import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  createNotebook,
  createNote,
  deleteNotebook,
  deleteNote,
  ensureBaseDir,
  getBaseDir,
  getNote,
  getSettings,
  listAllNotes,
  listNotebooks,
  moveNote,
  purgeDeletedNotes,
  purgeNote,
  renameNotebook,
  restoreNote,
  serializeAppError,
  updateNote,
  updateSettings,
} from './storage';

const isDev = !app.isPackaged;
const execFileAsync = promisify(execFile);

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

function registerHandler<Args extends unknown[], Result>(
  channel: string,
  handler: (...args: Args) => Promise<Result>
) {
  ipcMain.handle(channel, async (_event, ...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      throw new Error(serializeAppError(error));
    }
  });
}

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
      sandbox: false,
    },
  });

  if (isDev) {
    await window.loadURL('http://localhost:5173');
    window.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  await window.loadFile(path.join(__dirname, '../dist/index.html'));
}

app.whenReady().then(async () => {
  await ensureBaseDir(dataDir());
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

registerHandler('notebooks:list', async () => listNotebooks(dataDir()));
registerHandler('notebooks:create', async (name: string) =>
  createNotebook(dataDir(), name)
);
registerHandler('notebooks:rename', async (id: string, newName: string) =>
  renameNotebook(dataDir(), id, newName)
);
registerHandler('notebooks:delete', async (id: string) =>
  deleteNotebook(dataDir(), id)
);

registerHandler('notes:list', async () => listAllNotes(dataDir()));
registerHandler('notes:listTrash', async () =>
  listAllNotes(dataDir(), { onlyDeleted: true })
);
registerHandler('notes:get', async (notebookId: string, noteId: string) =>
  getNote(dataDir(), notebookId, noteId)
);
registerHandler(
  'notes:create',
  async (payload: { notebookId: string; title: string; body?: string }) =>
    createNote(dataDir(), payload)
);
registerHandler(
  'notes:update',
  async (payload: {
    id: string;
    notebookId: string;
    title?: string;
    body?: string;
    tags?: { label: string; color: string }[];
    pinned?: boolean;
    status?: 'active' | 'onHold' | 'completed' | 'dropped';
  }) => updateNote(dataDir(), payload)
);
registerHandler(
  'notes:delete',
  async (notebookId: string, noteId: string) =>
    deleteNote(dataDir(), notebookId, noteId)
);
registerHandler('notes:restore', async (noteId: string) =>
  restoreNote(dataDir(), noteId)
);
registerHandler('notes:purge', async (noteId: string) =>
  purgeNote(dataDir(), noteId)
);
registerHandler(
  'notes:move',
  async (noteId: string, fromNotebookId: string, toNotebookId: string) =>
    moveNote(dataDir(), noteId, fromNotebookId, toNotebookId)
);

registerHandler('profile:get', async () => getDesktopProfile());
registerHandler('settings:get', async () => getSettings(dataDir()));
registerHandler('settings:update', async (patch: Record<string, unknown>) =>
  updateSettings(
    dataDir(),
    patch as Parameters<typeof updateSettings>[1]
  )
);
registerHandler('storage:trashCleanup', async (olderThanDays?: number) =>
  purgeDeletedNotes(dataDir(), { olderThanDays })
);
