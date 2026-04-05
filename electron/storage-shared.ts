import fs from 'node:fs/promises';
import path from 'node:path';
import {
  assertSafePathSegment,
  resolvePathWithinBaseDir,
  type Note,
  type Notebook,
} from './storage-core';

export const SETTINGS_FILE = 'settings.json';
export const NOTE_INDEX_FILE = '.index.json';
export const NOTE_FILE_EXTENSION = '.md';
export const INBOX_NOTEBOOK_ID = 'Inbox';
export const NOTE_FILENAME_ID_LENGTH = 8;
export const JSON_INDENT = 2;
export const SETTINGS_THEME_VALUES = ['workbench-dark', 'workbench-light'] as const;
export const SETTINGS_LAYOUT_VALUES = ['workbench', 'writer', 'editor'] as const;
export const SETTINGS_FONT_SIZE_VALUES = ['sm', 'md', 'lg'] as const;
export const SETTINGS_LINE_WRAP_VALUES = ['wrap', 'scroll'] as const;
export const NOTE_STATUS_VALUES = ['active', 'onHold', 'completed', 'dropped'] as const;
export const TRASH_NOTEBOOK_ID = '.trash';
export const TRASH_NOTEBOOKS_DIR = '.notebooks';
export const DEFAULT_TRASH_RETENTION_DAYS = 30;

export interface NoteIndexEntry {
  notebookId: string;
  filename: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export type NoteIndex = Record<string, NoteIndexEntry>;

export interface DeletedNotebookRecord {
  id: string;
  name: string;
  deletedAt: string;
}

export interface WorkspacePaths {
  baseDir: string;
  settingsFile: string;
  noteIndexFile: string;
  trashNotebookDir: string;
  trashedNotebookRecordsDir: string;
  notebook: (notebookId: string) => string;
  noteFile: (notebookId: string, filename: string) => string;
  trashedNotebookRecord: (notebookId: string) => string;
}

export interface NoteLocation {
  notebookId: string;
  filename: string;
}

export interface StoredNote {
  note: Note;
  location: NoteLocation;
}

export interface NoteQueryOptions {
  includeDeleted?: boolean;
  deletedOnly?: boolean;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isErrnoCode(error: unknown, code: string): boolean {
  return (error as NodeJS.ErrnoException | undefined)?.code === code;
}

export function errorDetails(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}

export function readUnionValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T
): T {
  return typeof value === 'string' && allowed.includes(value as T)
    ? (value as T)
    : fallback;
}

export async function readJsonFile<T>(
  filePath: string,
  parse: (value: unknown) => T | null
): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return parse(JSON.parse(raw));
  } catch (error) {
    if (isErrnoCode(error, 'ENOENT')) {
      return null;
    }

    return null;
  }
}

export async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(value, null, JSON_INDENT), 'utf-8');
}

export function workspacePaths(baseDir: string): WorkspacePaths {
  const resolvedBaseDir = path.resolve(baseDir);

  const notebook = (notebookId: string) =>
    resolvePathWithinBaseDir(
      resolvedBaseDir,
      assertSafePathSegment(notebookId, 'Notebook ID')
    );

  const trashNotebookDir = notebook(TRASH_NOTEBOOK_ID);
  const trashedNotebookRecordsDir = resolvePathWithinBaseDir(
    trashNotebookDir,
    TRASH_NOTEBOOKS_DIR
  );

  return {
    baseDir: resolvedBaseDir,
    settingsFile: resolvePathWithinBaseDir(resolvedBaseDir, SETTINGS_FILE),
    noteIndexFile: resolvePathWithinBaseDir(resolvedBaseDir, NOTE_INDEX_FILE),
    trashNotebookDir,
    trashedNotebookRecordsDir,
    notebook,
    noteFile(notebookId: string, filename: string) {
      return resolvePathWithinBaseDir(notebook(notebookId), filename);
    },
    trashedNotebookRecord(notebookId: string) {
      const safeNotebookId = assertSafePathSegment(notebookId, 'Notebook ID');
      return resolvePathWithinBaseDir(
        trashedNotebookRecordsDir,
        `${safeNotebookId}.json`
      );
    },
  };
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

export async function ensureBaseDir(baseDir: string): Promise<void> {
  const paths = workspacePaths(baseDir);

  await fs.mkdir(paths.baseDir, { recursive: true });
  await fs.mkdir(paths.notebook(INBOX_NOTEBOOK_ID), { recursive: true });
  await fs.mkdir(paths.trashedNotebookRecordsDir, { recursive: true });
}

export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export function resolveNotebookPath(baseDir: string, notebookId: string): string {
  return workspacePaths(baseDir).notebook(notebookId);
}

export function resolveNoteFilePath(
  baseDir: string,
  notebookId: string,
  filename: string
): string {
  return workspacePaths(baseDir).noteFile(notebookId, filename);
}

export function trashedNotebookRecordsPath(baseDir: string): string {
  return workspacePaths(baseDir).trashedNotebookRecordsDir;
}

export function trashedNotebookRecordPath(baseDir: string, notebookId: string): string {
  return workspacePaths(baseDir).trashedNotebookRecord(notebookId);
}

export async function readNotebookDirectories(
  baseDir: string,
  options?: { includeTrash?: boolean }
): Promise<Notebook[]> {
  const entries = await fs.readdir(baseDir, { withFileTypes: true });

  return entries
    .filter(
      (entry) =>
        entry.isDirectory() &&
        (!entry.name.startsWith('.') ||
          (options?.includeTrash && entry.name === TRASH_NOTEBOOK_ID))
    )
    .map((entry) => ({ id: entry.name, name: entry.name }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function listMarkdownFiles(notebookPath: string): Promise<string[]> {
  try {
    const files = await fs.readdir(notebookPath);
    return files.filter((file) => file.endsWith(NOTE_FILE_EXTENSION));
  } catch {
    return [];
  }
}
