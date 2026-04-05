import path from 'node:path';

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
  spellcheckLocale: 'pt-BR' | 'es-ES' | 'en-US';
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'workbench-dark',
  layoutMode: 'workbench',
  editorFontSize: 'md',
  lineWrap: 'wrap',
  previewOpen: false,
  spellcheckLocale: 'pt-BR',
};

const NOTEBOOK_NAME_PATTERN = /[<>:"/\\|?*]/g;
const PATH_SEPARATOR_PATTERN = /[\\/]/;

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
