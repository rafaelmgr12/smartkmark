import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
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
  renameNotebook,
  serializeAppError,
  updateNote,
  updateSettings,
} from './storage';

const isDev = !app.isPackaged;

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
registerHandler(
  'notes:move',
  async (noteId: string, fromNotebookId: string, toNotebookId: string) =>
    moveNote(dataDir(), noteId, fromNotebookId, toNotebookId)
);

registerHandler('settings:get', async () => getSettings(dataDir()));
registerHandler('settings:update', async (patch: Record<string, unknown>) =>
  updateSettings(
    dataDir(),
    patch as Parameters<typeof updateSettings>[1]
  )
);
