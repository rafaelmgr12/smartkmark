import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import matter from 'gray-matter';
import crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const isDev = !app.isPackaged;

function getBaseDir(): string {
  const docs =
    process.env.HOME || process.env.USERPROFILE || app.getPath('documents');
  return path.join(docs, 'Documents', 'SmartKMark');
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// ---------------------------------------------------------------------------
// Bootstrap — ensure base dir + default "Inbox" notebook exist
// ---------------------------------------------------------------------------

async function ensureBaseDir(): Promise<void> {
  const base = getBaseDir();
  await fs.mkdir(base, { recursive: true });

  const inboxDir = path.join(base, 'Inbox');
  try {
    await fs.access(inboxDir);
  } catch {
    await fs.mkdir(inboxDir, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// Notebook helpers
// ---------------------------------------------------------------------------

interface Notebook {
  id: string;
  name: string;
}

async function listNotebooks(): Promise<Notebook[]> {
  const base = getBaseDir();
  const entries = await fs.readdir(base, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => ({ id: e.name, name: e.name }));
}

// ---------------------------------------------------------------------------
// Note helpers
// ---------------------------------------------------------------------------

interface NoteTag {
  label: string;
  color: string;
}

interface NoteMeta {
  id: string;
  title: string;
  notebookId: string;
  tags: NoteTag[];
  pinned: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface Note extends NoteMeta {
  body: string;
}

function buildNoteMeta(
  frontmatter: Record<string, unknown>,
  body: string,
  notebookId: string
): Note {
  const now = new Date().toISOString();
  return {
    id: (frontmatter.id as string) || crypto.randomUUID(),
    title: (frontmatter.title as string) || 'Untitled',
    notebookId,
    tags: (frontmatter.tags as NoteTag[]) || [],
    pinned: (frontmatter.pinned as boolean) || false,
    status: (frontmatter.status as string) || 'active',
    createdAt: (frontmatter.createdAt as string) || now,
    updatedAt: (frontmatter.updatedAt as string) || now,
    body,
  };
}

function noteToFileContent(note: Note): string {
  const { body, ...meta } = note;
  // Remove notebookId from frontmatter — it's derived from the directory
  const { notebookId: _, ...storedMeta } = meta;
  return matter.stringify(body, storedMeta);
}

async function readNote(notebookId: string, filename: string): Promise<Note> {
  const filePath = path.join(getBaseDir(), notebookId, filename);
  const raw = await fs.readFile(filePath, 'utf-8');
  const { data, content } = matter(raw);
  return buildNoteMeta(data as Record<string, unknown>, content, notebookId);
}

async function writeNote(note: Note): Promise<void> {
  const dir = path.join(getBaseDir(), note.notebookId);
  await fs.mkdir(dir, { recursive: true });
  const filename = `${slugify(note.title) || note.id}.md`;
  await fs.writeFile(path.join(dir, filename), noteToFileContent(note), 'utf-8');
}

async function findNoteFile(
  notebookId: string,
  noteId: string
): Promise<string | null> {
  const dir = path.join(getBaseDir(), notebookId);
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return null;
  }
  for (const file of entries) {
    if (!file.endsWith('.md')) continue;
    const filePath = path.join(dir, file);
    const raw = await fs.readFile(filePath, 'utf-8');
    const { data } = matter(raw);
    if ((data as Record<string, unknown>).id === noteId) {
      return file;
    }
  }
  return null;
}

async function listAllNotes(): Promise<NoteMeta[]> {
  const notebooks = await listNotebooks();
  const all: NoteMeta[] = [];

  for (const nb of notebooks) {
    const dir = path.join(getBaseDir(), nb.id);
    let files: string[];
    try {
      files = await fs.readdir(dir);
    } catch {
      continue;
    }
    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      try {
        const note = await readNote(nb.id, file);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { body: _, ...meta } = note;
        all.push(meta);
      } catch {
        // skip corrupt files
      }
    }
  }

  // Sort by updatedAt desc
  all.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  return all;
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------

async function createWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    await window.loadURL('http://localhost:5173');
  } else {
    await window.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(async () => {
  await ensureBaseDir();
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

// ---------------------------------------------------------------------------
// IPC — Notebooks
// ---------------------------------------------------------------------------

ipcMain.handle('notebooks:list', async () => {
  return listNotebooks();
});

ipcMain.handle('notebooks:create', async (_, name: string) => {
  const id = name; // use the name as the directory name
  const dir = path.join(getBaseDir(), id);
  await fs.mkdir(dir, { recursive: true });
  return { id, name } as Notebook;
});

ipcMain.handle('notebooks:rename', async (_, id: string, newName: string) => {
  const base = getBaseDir();
  const oldDir = path.join(base, id);
  const newDir = path.join(base, newName);
  await fs.rename(oldDir, newDir);
  return { id: newName, name: newName } as Notebook;
});

ipcMain.handle('notebooks:delete', async (_, id: string) => {
  const dir = path.join(getBaseDir(), id);
  await fs.rm(dir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// IPC — Notes
// ---------------------------------------------------------------------------

ipcMain.handle('notes:list', async () => {
  return listAllNotes();
});

ipcMain.handle('notes:get', async (_, notebookId: string, noteId: string) => {
  const filename = await findNoteFile(notebookId, noteId);
  if (!filename) throw new Error(`Note ${noteId} not found in ${notebookId}`);
  return readNote(notebookId, filename);
});

ipcMain.handle(
  'notes:create',
  async (
    _,
    payload: { notebookId: string; title: string; body?: string }
  ) => {
    const now = new Date().toISOString();
    const note: Note = {
      id: crypto.randomUUID(),
      title: payload.title,
      notebookId: payload.notebookId,
      tags: [],
      pinned: false,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      body: payload.body || '',
    };
    await writeNote(note);
    return note;
  }
);

ipcMain.handle(
  'notes:update',
  async (
    _,
    payload: {
      id: string;
      notebookId: string;
      title?: string;
      body?: string;
      tags?: NoteTag[];
      pinned?: boolean;
      status?: string;
    }
  ) => {
    const filename = await findNoteFile(payload.notebookId, payload.id);
    if (!filename)
      throw new Error(
        `Note ${payload.id} not found in ${payload.notebookId}`
      );

    const existing = await readNote(payload.notebookId, filename);

    const updated: Note = {
      ...existing,
      title: payload.title ?? existing.title,
      body: payload.body ?? existing.body,
      tags: payload.tags ?? existing.tags,
      pinned: payload.pinned ?? existing.pinned,
      status: payload.status ?? existing.status,
      updatedAt: new Date().toISOString(),
    };

    // If title changed, delete old file first
    const oldSlug = slugify(existing.title) || existing.id;
    const newSlug = slugify(updated.title) || updated.id;
    if (oldSlug !== newSlug) {
      const oldPath = path.join(
        getBaseDir(),
        payload.notebookId,
        `${oldSlug}.md`
      );
      try {
        await fs.unlink(oldPath);
      } catch {
        // old file may not exist
      }
    }

    await writeNote(updated);
    return updated;
  }
);

ipcMain.handle(
  'notes:delete',
  async (_, notebookId: string, noteId: string) => {
    const filename = await findNoteFile(notebookId, noteId);
    if (!filename) return;
    const filePath = path.join(getBaseDir(), notebookId, filename);
    await fs.unlink(filePath);
  }
);

ipcMain.handle(
  'notes:move',
  async (_, noteId: string, fromNotebookId: string, toNotebookId: string) => {
    const filename = await findNoteFile(fromNotebookId, noteId);
    if (!filename)
      throw new Error(`Note ${noteId} not found in ${fromNotebookId}`);

    const note = await readNote(fromNotebookId, filename);

    // Delete from old location
    const oldPath = path.join(getBaseDir(), fromNotebookId, filename);
    await fs.unlink(oldPath);

    // Write to new location
    const movedNote: Note = {
      ...note,
      notebookId: toNotebookId,
      updatedAt: new Date().toISOString(),
    };
    await writeNote(movedNote);
    return movedNote;
  }
);
