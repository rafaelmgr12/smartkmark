import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import matter from 'gray-matter';
import { AppError, type Note, type NoteMeta, type NoteTag } from './storage-core';
import {
  NOTE_FILENAME_ID_LENGTH,
  NOTE_FILE_EXTENSION,
  NOTE_STATUS_VALUES,
  type NoteIndexEntry,
  type NoteLocation,
  type StoredNote,
  errorDetails,
  isRecord,
  pathExists,
  readUnionValue,
  resolveNoteFilePath,
  slugify,
} from './storage-shared';

function normalizeTags(value: unknown): NoteTag[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((tag) => {
      if (!isRecord(tag) || typeof tag.label !== 'string') {
        return null;
      }

      return {
        label: tag.label,
        color: typeof tag.color === 'string' ? tag.color : 'gray',
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
    status: readUnionValue(frontmatter.status, NOTE_STATUS_VALUES, 'active'),
    createdAt:
      typeof frontmatter.createdAt === 'string' ? frontmatter.createdAt : now,
    updatedAt:
      typeof frontmatter.updatedAt === 'string' ? frontmatter.updatedAt : now,
    ...(typeof frontmatter.deletedAt === 'string'
      ? { deletedAt: frontmatter.deletedAt }
      : {}),
    ...(typeof frontmatter.trashedFromNotebookId === 'string'
      ? { trashedFromNotebookId: frontmatter.trashedFromNotebookId }
      : {}),
    body,
  };
}

export function noteToFileContent(note: Note): string {
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

export function stableNoteFilename(note: Pick<Note, 'id' | 'title'>): string {
  const base = slugify(note.title) || 'note';
  return `${base}--${note.id.slice(0, NOTE_FILENAME_ID_LENGTH)}${NOTE_FILE_EXTENSION}`;
}

export async function readNoteFile(filePath: string, notebookId: string): Promise<Note> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const { data, content } = matter(raw);
    return buildNote(data as Record<string, unknown>, content, notebookId);
  } catch (error) {
    throw new AppError('CORRUPT_FILE', 'Unable to parse markdown note.', {
      details: errorDetails(error),
    });
  }
}

export function noteToMeta(note: Note): NoteMeta {
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

export function createNoteIndexEntry(note: Note): NoteIndexEntry {
  return {
    notebookId: note.notebookId,
    filename: stableNoteFilename(note),
    title: note.title,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

export async function readStoredNoteAtLocation(
  baseDir: string,
  location: NoteLocation
): Promise<StoredNote> {
  const note = await readNoteFile(
    resolveNoteFilePath(baseDir, location.notebookId, location.filename),
    location.notebookId
  );

  return { note, location };
}

export async function hydrateIndexedNote(
  baseDir: string,
  noteId: string,
  entry: NoteIndexEntry | undefined
): Promise<StoredNote | null> {
  if (!entry) {
    return null;
  }

  const location: NoteLocation = {
    notebookId: entry.notebookId,
    filename: entry.filename,
  };

  const filePath = resolveNoteFilePath(baseDir, location.notebookId, location.filename);
  if (!(await pathExists(filePath))) {
    return null;
  }

  try {
    const stored = await readStoredNoteAtLocation(baseDir, location);
    return stored.note.id === noteId ? stored : null;
  } catch {
    return null;
  }
}
