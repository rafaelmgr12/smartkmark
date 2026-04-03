import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export interface Notebook {
  id: string;
  name: string;
}

export interface NoteTag {
  label: string;
  color: string;
}

export type NoteStatus = 'active' | 'onHold' | 'completed' | 'dropped';

export interface NoteMeta {
  id: string;
  title: string;
  notebookId: string;
  tags: NoteTag[];
  pinned: boolean;
  status: NoteStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Note extends NoteMeta {
  body: string;
}

export type DesktopErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'READ_ERROR'
  | 'WRITE_ERROR'
  | 'CORRUPT_FILE'
  | 'UNKNOWN_ERROR';

export interface DesktopError {
  code: DesktopErrorCode;
  message: string;
  details?: string;
  recoverable?: boolean;
}

export interface AppSettings {
  theme: 'workbench-dark' | 'workbench-light';
  layoutMode: 'workbench' | 'writer' | 'editor';
  editorFontSize: 'sm' | 'md' | 'lg';
  lineWrap: 'wrap' | 'scroll';
  previewOpen: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'workbench-dark',
  layoutMode: 'workbench',
  editorFontSize: 'md',
  lineWrap: 'wrap',
  previewOpen: false,
};

const SETTINGS_FILE = 'settings.json';
const NOTEBOOK_NAME_PATTERN = /[<>:"/\\|?*]/g;
const execFileAsync = promisify(execFile);

export class AppError extends Error {
  code: DesktopErrorCode;
  details?: string;
  recoverable?: boolean;

  constructor(
    code: DesktopErrorCode,
    message: string,
    options?: { details?: string; recoverable?: boolean }
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = options?.details;
    this.recoverable = options?.recoverable;
  }
}

export function serializeAppError(error: unknown): string {
  if (error instanceof AppError) {
    return JSON.stringify({
      code: error.code,
      message: error.message,
      details: error.details,
      recoverable: error.recoverable ?? true,
    } satisfies DesktopError);
  }

  if (error instanceof Error) {
    return JSON.stringify({
      code: 'UNKNOWN_ERROR',
      message: error.message,
      recoverable: true,
    } satisfies DesktopError);
  }

  return JSON.stringify({
    code: 'UNKNOWN_ERROR',
    message: 'Unknown desktop error.',
    recoverable: true,
  } satisfies DesktopError);
}

export function getBaseDir(): string {
  const override = process.env.SMARTKMARK_DATA_DIR;
  if (override) {
    return path.resolve(override);
  }

  const docsRoot = process.env.HOME || process.env.USERPROFILE;
  if (docsRoot) {
    return path.join(docsRoot, 'Documents', 'SmartKMark');
  }

  throw new AppError(
    'READ_ERROR',
    'Unable to resolve the SmartKMark data directory.',
    { recoverable: false }
  );
}

export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function sanitizeNotebookName(value: string): string {
  const sanitized = value
    .split('')
    .filter((character) => character >= ' ')
    .join('')
    .replace(NOTEBOOK_NAME_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+|\.+$/g, '');

  if (!sanitized) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Notebook name must contain visible characters.'
    );
  }

  if (sanitized.length > 80) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Notebook name must be 80 characters or fewer.'
    );
  }

  return sanitized;
}

export async function ensureBaseDir(baseDir: string): Promise<void> {
  await fs.mkdir(baseDir, { recursive: true });
  const inboxDir = path.join(baseDir, 'Inbox');
  await fs.mkdir(inboxDir, { recursive: true });
}

function settingsPath(baseDir: string): string {
  return path.join(baseDir, SETTINGS_FILE);
}

function normalizeSettings(value: unknown): AppSettings {
  if (!value || typeof value !== 'object') {
    return DEFAULT_SETTINGS;
  }

  const raw = value as Partial<AppSettings>;

  return {
    theme:
      raw.theme === 'workbench-dark' || raw.theme === 'workbench-light'
        ? raw.theme
        : DEFAULT_SETTINGS.theme,
    layoutMode:
      raw.layoutMode === 'workbench' ||
      raw.layoutMode === 'writer' ||
      raw.layoutMode === 'editor'
        ? raw.layoutMode
        : DEFAULT_SETTINGS.layoutMode,
    editorFontSize:
      raw.editorFontSize === 'sm' ||
      raw.editorFontSize === 'md' ||
      raw.editorFontSize === 'lg'
        ? raw.editorFontSize
        : DEFAULT_SETTINGS.editorFontSize,
    lineWrap:
      raw.lineWrap === 'wrap' || raw.lineWrap === 'scroll'
        ? raw.lineWrap
        : DEFAULT_SETTINGS.lineWrap,
    previewOpen:
      typeof raw.previewOpen === 'boolean'
        ? raw.previewOpen
        : DEFAULT_SETTINGS.previewOpen,
  };
}

export async function getSettings(baseDir: string): Promise<AppSettings> {
  try {
    const raw = await fs.readFile(settingsPath(baseDir), 'utf-8');
    return normalizeSettings(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return DEFAULT_SETTINGS;
    }

    return DEFAULT_SETTINGS;
  }
}

export async function updateSettings(
  baseDir: string,
  patch: Partial<AppSettings>
): Promise<AppSettings> {
  const current = await getSettings(baseDir);
  const next = normalizeSettings({ ...current, ...patch });

  try {
    await fs.writeFile(settingsPath(baseDir), JSON.stringify(next, null, 2));
    return next;
  } catch (error) {
    throw new AppError('WRITE_ERROR', 'Unable to save application settings.', {
      details: error instanceof Error ? error.message : undefined,
    });
  }
}

function getTimestampLabel(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

async function zipDirectory(sourceDir: string, targetZipPath: string): Promise<void> {
  await fs.mkdir(path.dirname(targetZipPath), { recursive: true });

  try {
    await execFileAsync('zip', ['-r', '-q', targetZipPath, '.'], {
      cwd: sourceDir,
    });
  } catch (error) {
    throw new AppError('WRITE_ERROR', 'Unable to export workspace backup zip.', {
      details: error instanceof Error ? error.message : undefined,
    });
  }
}

async function unzipArchive(sourceZipPath: string, destinationDir: string): Promise<void> {
  try {
    await execFileAsync('unzip', ['-q', sourceZipPath, '-d', destinationDir]);
  } catch (error) {
    throw new AppError('READ_ERROR', 'Unable to read backup zip file.', {
      details: error instanceof Error ? error.message : undefined,
    });
  }
}

function assertSafeRelativePath(relativePath: string): void {
  const normalized = relativePath.replace(/\\/g, '/');
  if (
    normalized.startsWith('/') ||
    normalized.startsWith('../') ||
    normalized.includes('/../')
  ) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Backup archive contains an invalid file path.'
    );
  }
}

async function validateWorkspaceStructure(candidateDir: string): Promise<void> {
  const entries = await fs.readdir(candidateDir, { withFileTypes: true });
  const notebookDirs = entries.filter((entry) => entry.isDirectory());
  const settingsFiles = entries.filter(
    (entry) => entry.isFile() && entry.name === SETTINGS_FILE
  );

  if (entries.length === 0 || notebookDirs.length === 0) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Backup archive does not contain a valid workspace structure.'
    );
  }

  if (settingsFiles.length > 1) {
    throw new AppError('VALIDATION_ERROR', 'Backup contains duplicate settings.');
  }

  for (const entry of entries) {
    assertSafeRelativePath(entry.name);

    if (entry.isFile() && entry.name !== SETTINGS_FILE) {
      throw new AppError(
        'VALIDATION_ERROR',
        `Unexpected file in workspace root: "${entry.name}".`
      );
    }
  }
}

async function resolveExtractedWorkspaceDir(extractRoot: string): Promise<string> {
  const rootEntries = await fs.readdir(extractRoot, { withFileTypes: true });
  const candidate =
    rootEntries.length === 1 && rootEntries[0]?.isDirectory()
      ? path.join(extractRoot, rootEntries[0].name)
      : extractRoot;

  await validateWorkspaceStructure(candidate);
  return candidate;
}

export async function exportWorkspaceBackup(
  baseDir: string,
  targetZipPath: string
): Promise<string> {
  await ensureBaseDir(baseDir);
  await zipDirectory(baseDir, path.resolve(targetZipPath));
  return path.resolve(targetZipPath);
}

export async function createIncrementalBackup(baseDir: string): Promise<string> {
  const backupRoot = path.join(path.dirname(baseDir), 'SmartKMark Backups');
  const backupName = `smartkmark-backup-${getTimestampLabel()}.zip`;
  const targetPath = path.join(backupRoot, backupName);
  return exportWorkspaceBackup(baseDir, targetPath);
}

export async function importWorkspaceBackup(
  baseDir: string,
  sourceZipPath: string
): Promise<void> {
  const tempRoot = await fs.mkdtemp(path.join(baseDir, '..', 'smartkmark-restore-'));
  const extractedDir = path.join(tempRoot, 'extracted');
  const stagedDir = path.join(tempRoot, 'staged');
  const previousDir = `${baseDir}.rollback-${Date.now()}`;

  await fs.mkdir(extractedDir, { recursive: true });

  try {
    await unzipArchive(path.resolve(sourceZipPath), extractedDir);
    const workspaceDir = await resolveExtractedWorkspaceDir(extractedDir);
    await fs.cp(workspaceDir, stagedDir, { recursive: true });
    await ensureBaseDir(stagedDir);
  } catch (error) {
    await fs.rm(tempRoot, { recursive: true, force: true });
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError('READ_ERROR', 'Unable to prepare backup import.', {
      details: error instanceof Error ? error.message : undefined,
    });
  }

  let replaced = false;

  try {
    await fs.rename(baseDir, previousDir);
    replaced = true;
    await fs.rename(stagedDir, baseDir);
    await fs.rm(previousDir, { recursive: true, force: true });
    await fs.rm(tempRoot, { recursive: true, force: true });
  } catch (error) {
    if (replaced) {
      await fs.rm(baseDir, { recursive: true, force: true }).catch(() => undefined);
      await fs.rename(previousDir, baseDir).catch(() => undefined);
    }

    await fs.rm(tempRoot, { recursive: true, force: true });
    throw new AppError('WRITE_ERROR', 'Unable to restore workspace backup.', {
      details: error instanceof Error ? error.message : undefined,
    });
  }
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function ensureNotebookExists(
  baseDir: string,
  notebookId: string
): Promise<void> {
  const notebookPath = path.join(baseDir, notebookId);
  if (!(await pathExists(notebookPath))) {
    throw new AppError('NOT_FOUND', `Notebook "${notebookId}" was not found.`);
  }
}

export async function listNotebooks(baseDir: string): Promise<Notebook[]> {
  try {
    const entries = await fs.readdir(baseDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({ id: entry.name, name: entry.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    throw new AppError('READ_ERROR', 'Unable to list notebooks.', {
      details: error instanceof Error ? error.message : undefined,
    });
  }
}

export async function createNotebook(
  baseDir: string,
  name: string
): Promise<Notebook> {
  const notebookName = sanitizeNotebookName(name);
  const notebookPath = path.join(baseDir, notebookName);

  if (await pathExists(notebookPath)) {
    throw new AppError(
      'CONFLICT',
      `Notebook "${notebookName}" already exists.`
    );
  }

  try {
    await fs.mkdir(notebookPath, { recursive: false });
    return { id: notebookName, name: notebookName };
  } catch (error) {
    throw new AppError('WRITE_ERROR', 'Unable to create notebook.', {
      details: error instanceof Error ? error.message : undefined,
    });
  }
}

export async function renameNotebook(
  baseDir: string,
  id: string,
  newName: string
): Promise<Notebook> {
  const nextName = sanitizeNotebookName(newName);
  const currentPath = path.join(baseDir, id);
  const nextPath = path.join(baseDir, nextName);

  if (!(await pathExists(currentPath))) {
    throw new AppError('NOT_FOUND', `Notebook "${id}" was not found.`);
  }

  if (id !== nextName && (await pathExists(nextPath))) {
    throw new AppError('CONFLICT', `Notebook "${nextName}" already exists.`);
  }

  try {
    await fs.rename(currentPath, nextPath);
    return { id: nextName, name: nextName };
  } catch (error) {
    throw new AppError('WRITE_ERROR', 'Unable to rename notebook.', {
      details: error instanceof Error ? error.message : undefined,
    });
  }
}

export async function deleteNotebook(
  baseDir: string,
  id: string
): Promise<void> {
  const notebookPath = path.join(baseDir, id);

  if (!(await pathExists(notebookPath))) {
    return;
  }

  try {
    await fs.rm(notebookPath, { recursive: true, force: true });
    const notebooks = await listNotebooks(baseDir);
    if (notebooks.length === 0) {
      await fs.mkdir(path.join(baseDir, 'Inbox'), { recursive: true });
    }
  } catch (error) {
    throw new AppError('WRITE_ERROR', 'Unable to delete notebook.', {
      details: error instanceof Error ? error.message : undefined,
    });
  }
}

function normalizeTags(value: unknown): NoteTag[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((tag) => {
      if (!tag || typeof tag !== 'object') {
        return null;
      }

      const candidate = tag as Record<string, unknown>;
      if (typeof candidate.label !== 'string') {
        return null;
      }

      return {
        label: candidate.label,
        color: typeof candidate.color === 'string' ? candidate.color : 'gray',
      };
    })
    .filter((tag): tag is NoteTag => tag !== null);
}

function buildNote(
  frontmatter: Record<string, unknown>,
  body: string,
  notebookId: string
): Note {
  const now = new Date().toISOString();

  return {
    id:
      typeof frontmatter.id === 'string' && frontmatter.id
        ? frontmatter.id
        : crypto.randomUUID(),
    title:
      typeof frontmatter.title === 'string' && frontmatter.title
        ? frontmatter.title
        : 'Untitled',
    notebookId,
    tags: normalizeTags(frontmatter.tags),
    pinned: Boolean(frontmatter.pinned),
    status:
      frontmatter.status === 'onHold' ||
      frontmatter.status === 'completed' ||
      frontmatter.status === 'dropped'
        ? frontmatter.status
        : 'active',
    createdAt:
      typeof frontmatter.createdAt === 'string'
        ? frontmatter.createdAt
        : now,
    updatedAt:
      typeof frontmatter.updatedAt === 'string'
        ? frontmatter.updatedAt
        : now,
    body,
  };
}

function noteToFileContent(note: Note): string {
  return matter.stringify(note.body, {
    id: note.id,
    title: note.title,
    tags: note.tags,
    pinned: note.pinned,
    status: note.status,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  });
}

function stableNoteFilename(note: Pick<Note, 'id' | 'title'>): string {
  const base = slugify(note.title) || 'note';
  return `${base}--${note.id.slice(0, 8)}.md`;
}

async function readNoteFile(filePath: string, notebookId: string): Promise<Note> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const { data, content } = matter(raw);
    return buildNote(data as Record<string, unknown>, content, notebookId);
  } catch (error) {
    throw new AppError('CORRUPT_FILE', 'Unable to parse markdown note.', {
      details: error instanceof Error ? error.message : undefined,
    });
  }
}

export async function findNoteFile(
  baseDir: string,
  notebookId: string,
  noteId: string
): Promise<string | null> {
  const notebookPath = path.join(baseDir, notebookId);

  let files: string[];
  try {
    files = await fs.readdir(notebookPath);
  } catch {
    return null;
  }

  for (const file of files) {
    if (!file.endsWith('.md')) {
      continue;
    }

    try {
      const note = await readNoteFile(path.join(notebookPath, file), notebookId);
      if (note.id === noteId) {
        return file;
      }
    } catch {
      continue;
    }
  }

  return null;
}

export async function listAllNotes(baseDir: string): Promise<NoteMeta[]> {
  const notebooks = await listNotebooks(baseDir);
  const notes: NoteMeta[] = [];

  for (const notebook of notebooks) {
    const notebookPath = path.join(baseDir, notebook.id);
    let files: string[] = [];

    try {
      files = await fs.readdir(notebookPath);
    } catch {
      continue;
    }

    for (const file of files) {
      if (!file.endsWith('.md')) {
        continue;
      }

      try {
        const note = await readNoteFile(path.join(notebookPath, file), notebook.id);
        notes.push({
          id: note.id,
          title: note.title,
          notebookId: note.notebookId,
          tags: note.tags,
          pinned: note.pinned,
          status: note.status,
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
        });
      } catch {
        continue;
      }
    }
  }

  return notes.sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  );
}

export async function getNote(
  baseDir: string,
  notebookId: string,
  noteId: string
): Promise<Note> {
  const filename = await findNoteFile(baseDir, notebookId, noteId);
  if (!filename) {
    throw new AppError('NOT_FOUND', `Note "${noteId}" was not found.`);
  }

  return readNoteFile(path.join(baseDir, notebookId, filename), notebookId);
}

async function writeNote(
  baseDir: string,
  note: Note,
  options?: { currentFilename?: string | null }
): Promise<Note> {
  const notebookPath = path.join(baseDir, note.notebookId);
  const nextFilename = stableNoteFilename(note);
  const nextPath = path.join(notebookPath, nextFilename);
  const currentPath = options?.currentFilename
    ? path.join(notebookPath, options.currentFilename)
    : null;

  try {
    await fs.mkdir(notebookPath, { recursive: true });
    await fs.writeFile(nextPath, noteToFileContent(note), 'utf-8');

    if (currentPath && currentPath !== nextPath && (await pathExists(currentPath))) {
      await fs.unlink(currentPath);
    }

    return note;
  } catch (error) {
    throw new AppError('WRITE_ERROR', 'Unable to save note.', {
      details: error instanceof Error ? error.message : undefined,
    });
  }
}

export async function createNote(
  baseDir: string,
  payload: { notebookId: string; title: string; body?: string }
): Promise<Note> {
  await ensureNotebookExists(baseDir, payload.notebookId);

  const now = new Date().toISOString();
  const note: Note = {
    id: crypto.randomUUID(),
    title: payload.title.trim() || 'Untitled',
    notebookId: payload.notebookId,
    tags: [],
    pinned: false,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    body: payload.body ?? '',
  };

  return writeNote(baseDir, note);
}

export async function updateNote(
  baseDir: string,
  payload: {
    id: string;
    notebookId: string;
    title?: string;
    body?: string;
    tags?: NoteTag[];
    pinned?: boolean;
    status?: NoteStatus;
  }
): Promise<Note> {
  const currentFilename = await findNoteFile(baseDir, payload.notebookId, payload.id);
  if (!currentFilename) {
    throw new AppError('NOT_FOUND', `Note "${payload.id}" was not found.`);
  }

  const existing = await readNoteFile(
    path.join(baseDir, payload.notebookId, currentFilename),
    payload.notebookId
  );

  const updated: Note = {
    ...existing,
    title: payload.title?.trim() || existing.title,
    body: payload.body ?? existing.body,
    tags: payload.tags ?? existing.tags,
    pinned: payload.pinned ?? existing.pinned,
    status: payload.status ?? existing.status,
    updatedAt: new Date().toISOString(),
  };

  return writeNote(baseDir, updated, { currentFilename });
}

export async function deleteNote(
  baseDir: string,
  notebookId: string,
  noteId: string
): Promise<void> {
  const filename = await findNoteFile(baseDir, notebookId, noteId);
  if (!filename) {
    return;
  }

  try {
    await fs.unlink(path.join(baseDir, notebookId, filename));
  } catch (error) {
    throw new AppError('WRITE_ERROR', 'Unable to delete note.', {
      details: error instanceof Error ? error.message : undefined,
    });
  }
}

export async function moveNote(
  baseDir: string,
  noteId: string,
  fromNotebookId: string,
  toNotebookId: string
): Promise<Note> {
  await ensureNotebookExists(baseDir, toNotebookId);

  const filename = await findNoteFile(baseDir, fromNotebookId, noteId);
  if (!filename) {
    throw new AppError('NOT_FOUND', `Note "${noteId}" was not found.`);
  }

  const note = await readNoteFile(path.join(baseDir, fromNotebookId, filename), fromNotebookId);

  try {
    await fs.unlink(path.join(baseDir, fromNotebookId, filename));
  } catch (error) {
    throw new AppError('WRITE_ERROR', 'Unable to move note.', {
      details: error instanceof Error ? error.message : undefined,
    });
  }

  const moved: Note = {
    ...note,
    notebookId: toNotebookId,
    updatedAt: new Date().toISOString(),
  };

  return writeNote(baseDir, moved);
}
