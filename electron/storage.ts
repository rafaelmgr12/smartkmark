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
  deletedAt?: string;
  trashedFromNotebookId?: string;
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
const NOTE_INDEX_FILE = '.index.json';
const NOTEBOOK_NAME_PATTERN = /[<>:"/\\|?*]/g;
const PATH_SEPARATOR_PATTERN = /[\\/]/;
export const TRASH_NOTEBOOK_ID = '.trash';
const TRASH_NOTEBOOKS_DIR = '.notebooks';
const DEFAULT_TRASH_RETENTION_DAYS = 30;
const execFileAsync = promisify(execFile);

interface NoteIndexEntry {
  notebookId: string;
  filename: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

type NoteIndex = Record<string, NoteIndexEntry>;

interface DeletedNotebookRecord {
  id: string;
  name: string;
  deletedAt: string;
}

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

export function assertSafePathSegment(value: string, label: string): string {
  if (value.trim().length === 0) {
    throw new AppError('VALIDATION_ERROR', `${label} must be a non-empty string.`);
  }

  if (value === '.' || value === '..' || value.includes('..')) {
    throw new AppError('VALIDATION_ERROR', `${label} contains invalid path traversal characters.`);
  }

  if (path.isAbsolute(value) || PATH_SEPARATOR_PATTERN.test(value)) {
    throw new AppError('VALIDATION_ERROR', `${label} must not contain path separators.`);
  }

  return value;
}

export function resolvePathWithinBaseDir(baseDir: string, ...segments: string[]): string {
  const resolvedBaseDir = path.resolve(baseDir);
  const resolvedPath = path.resolve(resolvedBaseDir, ...segments);
  const relativePath = path.relative(resolvedBaseDir, resolvedPath);
  const escapesBaseDir =
    relativePath.startsWith('..') || path.isAbsolute(relativePath);

  if (escapesBaseDir) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Resolved path escapes the SmartKMark data directory.'
    );
  }

  return resolvedPath;
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
  const trashDir = path.join(baseDir, TRASH_NOTEBOOK_ID);
  await fs.mkdir(inboxDir, { recursive: true });
  await fs.mkdir(path.join(trashDir, TRASH_NOTEBOOKS_DIR), { recursive: true });
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

function assertPathWithinRoot(rootDir: string, targetPath: string, message: string): void {
  const resolvedRootDir = path.resolve(rootDir);
  const resolvedTargetPath = path.resolve(targetPath);
  const relativePath = path.relative(resolvedRootDir, resolvedTargetPath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new AppError('VALIDATION_ERROR', message);
  }
}

async function validateExtractedTree(
  rootDir: string,
  currentDir = rootDir,
  resolvedRootDir?: string
): Promise<void> {
  const safeRootDir = resolvedRootDir ?? (await fs.realpath(rootDir));
  const entries = await fs.readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(currentDir, entry.name);
    const relativePath = path.relative(rootDir, entryPath);
    const stats = await fs.lstat(entryPath);

    assertSafeRelativePath(relativePath);

    if (stats.isSymbolicLink()) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Backup archive contains symbolic links, which are not allowed.'
      );
    }

    const realEntryPath = await fs.realpath(entryPath);
    assertPathWithinRoot(
      safeRootDir,
      realEntryPath,
      'Backup archive contains content outside the extraction directory.'
    );

    if (stats.isDirectory()) {
      await validateExtractedTree(rootDir, entryPath, safeRootDir);
    }
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

    if (
      entry.isFile() &&
      entry.name !== SETTINGS_FILE &&
      entry.name !== NOTE_INDEX_FILE
    ) {
      throw new AppError(
        'VALIDATION_ERROR',
        `Unexpected file in workspace root: "${entry.name}".`
      );
    }
  }
}

async function resolveExtractedWorkspaceDir(extractRoot: string): Promise<string> {
  await validateExtractedTree(extractRoot);

  const rootEntries = await fs.readdir(extractRoot, { withFileTypes: true });
  const candidate =
    rootEntries.length === 1 && rootEntries[0]?.isDirectory()
      ? path.join(extractRoot, rootEntries[0].name)
      : extractRoot;

  await validateWorkspaceStructure(candidate);
  return candidate;
}

async function copyValidatedWorkspaceTree(
  sourceDir: string,
  targetDir: string
): Promise<void> {
  await fs.mkdir(targetDir, { recursive: true });

  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await copyValidatedWorkspaceTree(sourcePath, targetPath);
      continue;
    }

    if (!entry.isFile()) {
      throw new AppError(
        'VALIDATION_ERROR',
        `Backup archive contains an unsupported entry: "${entry.name}".`
      );
    }

    await fs.copyFile(sourcePath, targetPath);
  }
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
    await copyValidatedWorkspaceTree(workspaceDir, stagedDir);
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
  const notebookPath = resolveNotebookPath(baseDir, notebookId);
  if (!(await pathExists(notebookPath))) {
    throw new AppError('NOT_FOUND', `Notebook "${notebookId}" was not found.`);
  }
}

function resolveNotebookPath(baseDir: string, notebookId: string): string {
  const safeNotebookId = assertSafePathSegment(notebookId, 'Notebook ID');
  return resolvePathWithinBaseDir(baseDir, safeNotebookId);
}

function resolveNoteFilePath(
  baseDir: string,
  notebookId: string,
  filename: string
): string {
  const notebookPath = resolveNotebookPath(baseDir, notebookId);
  return resolvePathWithinBaseDir(notebookPath, filename);
}

function trashNotebookPath(baseDir: string): string {
  return resolveNotebookPath(baseDir, TRASH_NOTEBOOK_ID);
}

function trashedNotebookRecordsPath(baseDir: string): string {
  return resolvePathWithinBaseDir(trashNotebookPath(baseDir), TRASH_NOTEBOOKS_DIR);
}

function trashedNotebookRecordPath(baseDir: string, notebookId: string): string {
  const safeNotebookId = assertSafePathSegment(notebookId, 'Notebook ID');
  return resolvePathWithinBaseDir(
    trashedNotebookRecordsPath(baseDir),
    `${safeNotebookId}.json`
  );
}

async function writeDeletedNotebookRecord(
  baseDir: string,
  notebook: Notebook,
  deletedAt: string
): Promise<void> {
  const record: DeletedNotebookRecord = {
    id: notebook.id,
    name: notebook.name,
    deletedAt,
  };

  await fs.mkdir(trashedNotebookRecordsPath(baseDir), { recursive: true });
  await fs.writeFile(
    trashedNotebookRecordPath(baseDir, notebook.id),
    JSON.stringify(record, null, 2),
    'utf-8'
  );
}

async function clearDeletedNotebookRecord(
  baseDir: string,
  notebookId: string
): Promise<void> {
  await fs
    .unlink(trashedNotebookRecordPath(baseDir, notebookId))
    .catch(() => undefined);
}

function noteIndexPath(baseDir: string): string {
  return path.join(baseDir, NOTE_INDEX_FILE);
}

async function readNoteIndex(baseDir: string): Promise<NoteIndex | null> {
  try {
    const raw = await fs.readFile(noteIndexPath(baseDir), 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const index: NoteIndex = {};
    for (const [noteId, value] of Object.entries(parsed)) {
      if (!value || typeof value !== 'object') {
        return null;
      }

      const candidate = value as Record<string, unknown>;
      if (
        typeof candidate.notebookId !== 'string' ||
        typeof candidate.filename !== 'string' ||
        typeof candidate.title !== 'string' ||
        typeof candidate.createdAt !== 'string' ||
        typeof candidate.updatedAt !== 'string'
      ) {
        return null;
      }

      index[noteId] = {
        notebookId: candidate.notebookId,
        filename: candidate.filename,
        title: candidate.title,
        createdAt: candidate.createdAt,
        updatedAt: candidate.updatedAt,
      };
    }

    return index;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }

    return null;
  }
}

async function writeNoteIndex(baseDir: string, index: NoteIndex): Promise<void> {
  await fs.writeFile(noteIndexPath(baseDir), JSON.stringify(index, null, 2), 'utf-8');
}

export async function listNotebooks(baseDir: string): Promise<Notebook[]> {
  try {
    const entries = await fs.readdir(baseDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
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
  const notebookPath = resolveNotebookPath(baseDir, notebookName);

  if (await pathExists(notebookPath)) {
    throw new AppError(
      'CONFLICT',
      `Notebook "${notebookName}" already exists.`
    );
  }

  try {
    await fs.mkdir(notebookPath, { recursive: false });
    await clearDeletedNotebookRecord(baseDir, notebookName);
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
  const currentPath = resolveNotebookPath(baseDir, id);
  const nextPath = resolveNotebookPath(baseDir, nextName);

  if (id === TRASH_NOTEBOOK_ID) {
    throw new AppError('VALIDATION_ERROR', 'The trash notebook cannot be renamed.');
  }

  if (!(await pathExists(currentPath))) {
    throw new AppError('NOT_FOUND', `Notebook "${id}" was not found.`);
  }

  if (id !== nextName && (await pathExists(nextPath))) {
    throw new AppError('CONFLICT', `Notebook "${nextName}" already exists.`);
  }

  try {
    await fs.rename(currentPath, nextPath);
    const index = await ensureNoteIndex(baseDir);
    for (const entry of Object.values(index)) {
      if (entry.notebookId === id) {
        entry.notebookId = nextName;
      }
    }
    await writeNoteIndex(baseDir, index);
    await clearDeletedNotebookRecord(baseDir, id);
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
  const notebookPath = resolveNotebookPath(baseDir, id);
  const deletedAt = new Date().toISOString();

  if (!(await pathExists(notebookPath))) {
    return;
  }

  if (id === TRASH_NOTEBOOK_ID) {
    throw new AppError('VALIDATION_ERROR', 'The trash notebook cannot be deleted.');
  }

  try {
    const files = await fs.readdir(notebookPath);
    await writeDeletedNotebookRecord(baseDir, { id, name: id }, deletedAt);

    for (const file of files) {
      if (!file.endsWith('.md')) {
        continue;
      }

      try {
        const note = await readNoteFile(resolveNoteFilePath(baseDir, id, file), id);
        await deleteNote(baseDir, id, note.id, deletedAt);
      } catch {
        continue;
      }
    }

    await fs.rm(notebookPath, { recursive: true, force: true });
    const notebooks = await listNotebooks(baseDir);
    if (notebooks.length === 0) {
      await fs.mkdir(resolveNotebookPath(baseDir, 'Inbox'), { recursive: true });
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
    ...(typeof frontmatter.deletedAt === 'string'
      ? { deletedAt: frontmatter.deletedAt }
      : {}),
    ...(typeof frontmatter.trashedFromNotebookId === 'string'
      ? { trashedFromNotebookId: frontmatter.trashedFromNotebookId }
      : {}),
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
    ...(note.deletedAt ? { deletedAt: note.deletedAt } : {}),
    ...(note.trashedFromNotebookId
      ? { trashedFromNotebookId: note.trashedFromNotebookId }
      : {}),
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

function noteToMeta(note: Note): NoteMeta {
  return {
    id: note.id,
    title: note.title,
    notebookId: note.notebookId,
    tags: note.tags,
    pinned: note.pinned,
    status: note.status,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    deletedAt: note.deletedAt,
    trashedFromNotebookId: note.trashedFromNotebookId,
  };
}

export async function rebuildNoteIndex(baseDir: string): Promise<NoteIndex> {
  const entries = await fs.readdir(baseDir, { withFileTypes: true });
  const notebooks = entries
    .filter(
      (entry) =>
        entry.isDirectory() &&
        (!entry.name.startsWith('.') || entry.name === TRASH_NOTEBOOK_ID)
    )
    .map((entry) => ({ id: entry.name, name: entry.name }));
  const index: NoteIndex = {};

  for (const notebook of notebooks) {
    const notebookPath = resolveNotebookPath(baseDir, notebook.id);
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
        const note = await readNoteFile(
          resolveNoteFilePath(baseDir, notebook.id, file),
          notebook.id
        );
        index[note.id] = {
          notebookId: notebook.id,
          filename: file,
          title: note.title,
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
        };
      } catch {
        continue;
      }
    }
  }

  await writeNoteIndex(baseDir, index);
  return index;
}

async function ensureNoteIndex(baseDir: string): Promise<NoteIndex> {
  const current = await readNoteIndex(baseDir);
  if (current) {
    return current;
  }

  return rebuildNoteIndex(baseDir);
}

async function upsertIndexEntry(baseDir: string, note: Note): Promise<void> {
  const index = await ensureNoteIndex(baseDir);
  index[note.id] = {
    notebookId: note.notebookId,
    filename: stableNoteFilename(note),
    title: note.title,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
  await writeNoteIndex(baseDir, index);
}

async function removeIndexEntry(baseDir: string, noteId: string): Promise<void> {
  const index = await ensureNoteIndex(baseDir);
  delete index[noteId];
  await writeNoteIndex(baseDir, index);
}

export async function findNoteFile(
  baseDir: string,
  notebookId: string,
  noteId: string
): Promise<string | null> {
  const resolveFromIndex = async (): Promise<string | null> => {
    const index = await ensureNoteIndex(baseDir);
    const entry = index[noteId];
    if (!entry || entry.notebookId !== notebookId) {
      return null;
    }

    const filePath = resolveNoteFilePath(baseDir, notebookId, entry.filename);
    if (!(await pathExists(filePath))) {
      return null;
    }

    try {
      const note = await readNoteFile(filePath, notebookId);
      return note.id === noteId ? entry.filename : null;
    } catch {
      return null;
    }
  };

  const indexed = await resolveFromIndex();
  if (indexed) {
    return indexed;
  }

  const rebuilt = await rebuildNoteIndex(baseDir);
  const entry = rebuilt[noteId];
  return entry?.notebookId === notebookId ? entry.filename : null;
}

export async function listAllNotes(
  baseDir: string,
  options?: { includeDeleted?: boolean; deletedOnly?: boolean }
): Promise<NoteMeta[]> {
  const fromIndex = async (index: NoteIndex): Promise<NoteMeta[] | null> => {
    const notes: NoteMeta[] = [];

    for (const [noteId, entry] of Object.entries(index)) {
      const filePath = resolveNoteFilePath(baseDir, entry.notebookId, entry.filename);
      if (!(await pathExists(filePath))) {
        return null;
      }

      try {
        const note = await readNoteFile(filePath, entry.notebookId);
        if (note.id !== noteId) {
          return null;
        }

        const isDeleted = typeof note.deletedAt === 'string';
        if (options?.deletedOnly && !isDeleted) {
          continue;
        }
        if (!options?.includeDeleted && !options?.deletedOnly && isDeleted) {
          continue;
        }

        notes.push(noteToMeta(note));
      } catch {
        return null;
      }
    }

    return notes;
  };

  const currentIndex = await ensureNoteIndex(baseDir);
  const indexedNotes = await fromIndex(currentIndex);
  const notes = indexedNotes ?? (await fromIndex(await rebuildNoteIndex(baseDir))) ?? [];

  return notes.sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  );
}

export async function listDeletedNotes(baseDir: string): Promise<NoteMeta[]> {
  return listAllNotes(baseDir, { deletedOnly: true });
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

  return readNoteFile(resolveNoteFilePath(baseDir, notebookId, filename), notebookId);
}

async function writeNote(
  baseDir: string,
  note: Note,
  options?: { currentFilename?: string | null }
): Promise<Note> {
  const notebookPath = resolveNotebookPath(baseDir, note.notebookId);
  const nextFilename = stableNoteFilename(note);
  const nextPath = resolveNoteFilePath(baseDir, note.notebookId, nextFilename);
  const currentPath = options?.currentFilename
    ? resolveNoteFilePath(baseDir, note.notebookId, options.currentFilename)
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

async function moveStoredNote(
  baseDir: string,
  currentNotebookId: string,
  currentFilename: string,
  note: Note
): Promise<Note> {
  const currentPath = resolveNoteFilePath(baseDir, currentNotebookId, currentFilename);
  const nextNotebookPath = resolveNotebookPath(baseDir, note.notebookId);
  const nextFilename = stableNoteFilename(note);
  const nextPath = resolveNoteFilePath(baseDir, note.notebookId, nextFilename);

  try {
    await fs.mkdir(nextNotebookPath, { recursive: true });
    await fs.writeFile(nextPath, noteToFileContent(note), 'utf-8');

    if (currentPath !== nextPath && (await pathExists(currentPath))) {
      await fs.unlink(currentPath);
    }

    return note;
  } catch (error) {
    throw new AppError('WRITE_ERROR', 'Unable to move note.', {
      details: error instanceof Error ? error.message : undefined,
    });
  }
}

export async function createNote(
  baseDir: string,
  payload: { notebookId: string; title: string; body?: string }
): Promise<Note> {
  if (payload.notebookId === TRASH_NOTEBOOK_ID) {
    throw new AppError('VALIDATION_ERROR', 'Notes cannot be created directly in trash.');
  }

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

  const created = await writeNote(baseDir, note);
  await upsertIndexEntry(baseDir, created);
  return created;
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
  if (payload.notebookId === TRASH_NOTEBOOK_ID) {
    throw new AppError('VALIDATION_ERROR', 'Trash notes cannot be edited in place.');
  }

  const currentFilename = await findNoteFile(baseDir, payload.notebookId, payload.id);
  if (!currentFilename) {
    throw new AppError('NOT_FOUND', `Note "${payload.id}" was not found.`);
  }

  const existing = await readNoteFile(
    resolveNoteFilePath(baseDir, payload.notebookId, currentFilename),
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

  const saved = await writeNote(baseDir, updated, { currentFilename });
  await upsertIndexEntry(baseDir, saved);
  return saved;
}

export async function deleteNote(
  baseDir: string,
  notebookId: string,
  noteId: string,
  deletedAt = new Date().toISOString()
): Promise<void> {
  const filename = await findNoteFile(baseDir, notebookId, noteId);
  if (!filename) {
    return;
  }

  try {
    const note = await readNoteFile(resolveNoteFilePath(baseDir, notebookId, filename), notebookId);
    if (note.deletedAt && notebookId === TRASH_NOTEBOOK_ID) {
      return;
    }

    const trashed = await moveStoredNote(baseDir, notebookId, filename, {
      ...note,
      notebookId: TRASH_NOTEBOOK_ID,
      deletedAt,
      trashedFromNotebookId: note.trashedFromNotebookId ?? notebookId,
      updatedAt: deletedAt,
    });
    await upsertIndexEntry(baseDir, trashed);
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
  if (fromNotebookId === TRASH_NOTEBOOK_ID || toNotebookId === TRASH_NOTEBOOK_ID) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Use the trash actions to restore or remove deleted notes.'
    );
  }

  await ensureNotebookExists(baseDir, toNotebookId);

  const filename = await findNoteFile(baseDir, fromNotebookId, noteId);
  if (!filename) {
    throw new AppError('NOT_FOUND', `Note "${noteId}" was not found.`);
  }

  const note = await readNoteFile(
    resolveNoteFilePath(baseDir, fromNotebookId, filename),
    fromNotebookId
  );

  const moved: Note = {
    ...note,
    notebookId: toNotebookId,
    deletedAt: undefined,
    trashedFromNotebookId: undefined,
    updatedAt: new Date().toISOString(),
  };

  const saved = await moveStoredNote(baseDir, fromNotebookId, filename, moved);
  await upsertIndexEntry(baseDir, saved);
  return saved;
}

export async function restoreNote(
  baseDir: string,
  noteId: string,
  targetNotebookId?: string
): Promise<Note> {
  const filename = await findNoteFile(baseDir, TRASH_NOTEBOOK_ID, noteId);
  if (!filename) {
    throw new AppError('NOT_FOUND', `Note "${noteId}" was not found in trash.`);
  }

  const trashed = await readNoteFile(
    resolveNoteFilePath(baseDir, TRASH_NOTEBOOK_ID, filename),
    TRASH_NOTEBOOK_ID
  );
  const destinationNotebookId =
    targetNotebookId?.trim() || trashed.trashedFromNotebookId || 'Inbox';

  if (destinationNotebookId === TRASH_NOTEBOOK_ID) {
    throw new AppError('VALIDATION_ERROR', 'A trashed note must be restored elsewhere.');
  }

  await fs.mkdir(resolveNotebookPath(baseDir, destinationNotebookId), { recursive: true });

  const restored = await moveStoredNote(baseDir, TRASH_NOTEBOOK_ID, filename, {
    ...trashed,
    notebookId: destinationNotebookId,
    deletedAt: undefined,
    trashedFromNotebookId: undefined,
    updatedAt: new Date().toISOString(),
  });

  await upsertIndexEntry(baseDir, restored);
  await clearDeletedNotebookRecord(baseDir, destinationNotebookId);
  return restored;
}

export async function purgeNote(baseDir: string, noteId: string): Promise<void> {
  const filename = await findNoteFile(baseDir, TRASH_NOTEBOOK_ID, noteId);
  if (!filename) {
    return;
  }

  try {
    await fs.unlink(resolveNoteFilePath(baseDir, TRASH_NOTEBOOK_ID, filename));
    await removeIndexEntry(baseDir, noteId);
  } catch (error) {
    throw new AppError('WRITE_ERROR', 'Unable to permanently delete note.', {
      details: error instanceof Error ? error.message : undefined,
    });
  }
}

async function purgeDeletedNotebookRecords(
  baseDir: string,
  cutoffTime: number
): Promise<void> {
  let files: string[] = [];

  try {
    files = await fs.readdir(trashedNotebookRecordsPath(baseDir));
  } catch {
    return;
  }

  for (const file of files) {
    if (!file.endsWith('.json')) {
      continue;
    }

    try {
      const raw = await fs.readFile(
        path.join(trashedNotebookRecordsPath(baseDir), file),
        'utf-8'
      );
      const record = JSON.parse(raw) as Partial<DeletedNotebookRecord>;
      const deletedAt =
        typeof record.deletedAt === 'string' ? new Date(record.deletedAt).getTime() : 0;

      if (deletedAt <= cutoffTime) {
        await fs.unlink(path.join(trashedNotebookRecordsPath(baseDir), file));
      }
    } catch {
      continue;
    }
  }
}

export async function purgeDeletedNotes(
  baseDir: string,
  options?: { olderThanDays?: number; now?: Date }
): Promise<number> {
  const retentionDays = options?.olderThanDays ?? DEFAULT_TRASH_RETENTION_DAYS;
  const referenceTime = options?.now?.getTime() ?? Date.now();
  const cutoffTime = referenceTime - retentionDays * 24 * 60 * 60 * 1000;
  const deletedNotes = await listDeletedNotes(baseDir);
  let purged = 0;

  for (const note of deletedNotes) {
    const deletedAt = note.deletedAt ? new Date(note.deletedAt).getTime() : 0;
    if (deletedAt <= cutoffTime) {
      await purgeNote(baseDir, note.id);
      purged += 1;
    }
  }

  await purgeDeletedNotebookRecords(baseDir, cutoffTime);
  return purged;
}

export async function runOptionalTrashCleanup(
  baseDir: string,
  options?: { enabled?: boolean; olderThanDays?: number; now?: Date }
): Promise<number> {
  if (!options?.enabled) {
    return 0;
  }

  return purgeDeletedNotes(baseDir, {
    olderThanDays: options.olderThanDays,
    now: options.now,
  });
}
