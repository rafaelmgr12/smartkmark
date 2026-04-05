import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  AppError,
  sanitizeNotebookName,
  type Note,
  type NoteStatus,
  type NoteTag,
  type Notebook,
} from './storage-core';
import {
  DEFAULT_TRASH_RETENTION_DAYS,
  INBOX_NOTEBOOK_ID,
  TRASH_NOTEBOOK_ID,
  type DeletedNotebookRecord,
  type NoteLocation,
  type StoredNote,
  errorDetails,
  isRecord,
  listMarkdownFiles,
  pathExists,
  readJsonFile,
  readNotebookDirectories,
  resolveNotebookPath,
  resolveNoteFilePath,
  trashedNotebookRecordPath,
  trashedNotebookRecordsPath,
  writeJsonFile,
} from './storage-shared';
import { noteToFileContent, stableNoteFilename, readStoredNoteAtLocation } from './storage-note-files';
import {
  listDeletedNotes,
  removeIndexEntry,
  replaceNotebookIdInIndex,
  resolveStoredNote,
  upsertIndexEntry,
} from './storage-index';

function parseDeletedNotebookRecord(value: unknown): DeletedNotebookRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.deletedAt !== 'string'
  ) {
    return null;
  }

  return {
    id: value.id,
    name: value.name,
    deletedAt: value.deletedAt,
  };
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
  await writeJsonFile(trashedNotebookRecordPath(baseDir, notebook.id), record);
}

async function clearDeletedNotebookRecord(
  baseDir: string,
  notebookId: string
): Promise<void> {
  await fs.unlink(trashedNotebookRecordPath(baseDir, notebookId)).catch(() => undefined);
}

async function persistNoteFile(
  baseDir: string,
  note: Note,
  options: { source?: NoteLocation | null; errorMessage: string }
): Promise<Note> {
  const notebookPath = resolveNotebookPath(baseDir, note.notebookId);
  const nextFilename = stableNoteFilename(note);
  const nextPath = resolveNoteFilePath(baseDir, note.notebookId, nextFilename);
  const currentPath = options.source
    ? resolveNoteFilePath(
        baseDir,
        options.source.notebookId,
        options.source.filename
      )
    : null;

  try {
    await fs.mkdir(notebookPath, { recursive: true });
    await fs.writeFile(nextPath, noteToFileContent(note), 'utf-8');

    if (currentPath && currentPath !== nextPath && (await pathExists(currentPath))) {
      await fs.unlink(currentPath);
    }

    return note;
  } catch (error) {
    throw new AppError('WRITE_ERROR', options.errorMessage, {
      details: errorDetails(error),
    });
  }
}

async function persistNote(
  baseDir: string,
  note: Note,
  options: { source?: NoteLocation | null; errorMessage: string }
): Promise<Note> {
  const saved = await persistNoteFile(baseDir, note, options);
  await upsertIndexEntry(baseDir, saved);
  return saved;
}

async function moveNoteToTrash(
  baseDir: string,
  stored: StoredNote,
  deletedAt: string
): Promise<void> {
  if (stored.note.deletedAt && stored.location.notebookId === TRASH_NOTEBOOK_ID) {
    return;
  }

  await persistNote(
    baseDir,
    {
      ...stored.note,
      notebookId: TRASH_NOTEBOOK_ID,
      deletedAt,
      trashedFromNotebookId:
        stored.note.trashedFromNotebookId ?? stored.location.notebookId,
      updatedAt: deletedAt,
    },
    {
      source: stored.location,
      errorMessage: 'Unable to delete note.',
    }
  );
}

export async function listNotebooks(baseDir: string): Promise<Notebook[]> {
  try {
    return await readNotebookDirectories(baseDir);
  } catch (error) {
    throw new AppError('READ_ERROR', 'Unable to list notebooks.', {
      details: errorDetails(error),
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
    throw new AppError('CONFLICT', `Notebook "${notebookName}" already exists.`);
  }

  try {
    await fs.mkdir(notebookPath, { recursive: false });
    await clearDeletedNotebookRecord(baseDir, notebookName);
    return { id: notebookName, name: notebookName };
  } catch (error) {
    throw new AppError('WRITE_ERROR', 'Unable to create notebook.', {
      details: errorDetails(error),
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
    await replaceNotebookIdInIndex(baseDir, id, nextName);
    await Promise.all([
      clearDeletedNotebookRecord(baseDir, id),
      clearDeletedNotebookRecord(baseDir, nextName),
    ]);
    return { id: nextName, name: nextName };
  } catch (error) {
    throw new AppError('WRITE_ERROR', 'Unable to rename notebook.', {
      details: errorDetails(error),
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
    const files = await listMarkdownFiles(notebookPath);
    await writeDeletedNotebookRecord(baseDir, { id, name: id }, deletedAt);

    for (const filename of files) {
      try {
        const stored = await readStoredNoteAtLocation(baseDir, {
          notebookId: id,
          filename,
        });
        await moveNoteToTrash(baseDir, stored, deletedAt);
      } catch {
        continue;
      }
    }

    await fs.rm(notebookPath, { recursive: true, force: true });

    const notebooks = await listNotebooks(baseDir);
    if (notebooks.length === 0) {
      await fs.mkdir(resolveNotebookPath(baseDir, INBOX_NOTEBOOK_ID), {
        recursive: true,
      });
    }
  } catch (error) {
    throw new AppError('WRITE_ERROR', 'Unable to delete notebook.', {
      details: errorDetails(error),
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
  return persistNote(
    baseDir,
    {
      id: crypto.randomUUID(),
      title: payload.title.trim() || 'Untitled',
      notebookId: payload.notebookId,
      tags: [],
      pinned: false,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      body: payload.body ?? '',
    },
    {
      errorMessage: 'Unable to save note.',
    }
  );
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

  const stored = await resolveStoredNote(baseDir, payload.notebookId, payload.id);
  if (!stored) {
    throw new AppError('NOT_FOUND', `Note "${payload.id}" was not found.`);
  }

  return persistNote(
    baseDir,
    {
      ...stored.note,
      title: payload.title?.trim() || stored.note.title,
      body: payload.body ?? stored.note.body,
      tags: payload.tags ?? stored.note.tags,
      pinned: payload.pinned ?? stored.note.pinned,
      status: payload.status ?? stored.note.status,
      updatedAt: new Date().toISOString(),
    },
    {
      source: stored.location,
      errorMessage: 'Unable to save note.',
    }
  );
}

export async function deleteNote(
  baseDir: string,
  notebookId: string,
  noteId: string,
  deletedAt = new Date().toISOString()
): Promise<void> {
  const stored = await resolveStoredNote(baseDir, notebookId, noteId);
  if (!stored) {
    return;
  }

  await moveNoteToTrash(baseDir, stored, deletedAt);
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

  const stored = await resolveStoredNote(baseDir, fromNotebookId, noteId);
  if (!stored) {
    throw new AppError('NOT_FOUND', `Note "${noteId}" was not found.`);
  }

  return persistNote(
    baseDir,
    {
      ...stored.note,
      notebookId: toNotebookId,
      deletedAt: undefined,
      trashedFromNotebookId: undefined,
      updatedAt: new Date().toISOString(),
    },
    {
      source: stored.location,
      errorMessage: 'Unable to move note.',
    }
  );
}

export async function restoreNote(
  baseDir: string,
  noteId: string,
  targetNotebookId?: string
): Promise<Note> {
  const stored = await resolveStoredNote(baseDir, TRASH_NOTEBOOK_ID, noteId);
  if (!stored) {
    throw new AppError('NOT_FOUND', `Note "${noteId}" was not found in trash.`);
  }

  const destinationNotebookId =
    targetNotebookId?.trim() ||
    stored.note.trashedFromNotebookId ||
    INBOX_NOTEBOOK_ID;

  if (destinationNotebookId === TRASH_NOTEBOOK_ID) {
    throw new AppError('VALIDATION_ERROR', 'A trashed note must be restored elsewhere.');
  }

  await fs.mkdir(resolveNotebookPath(baseDir, destinationNotebookId), {
    recursive: true,
  });

  const restored = await persistNote(
    baseDir,
    {
      ...stored.note,
      notebookId: destinationNotebookId,
      deletedAt: undefined,
      trashedFromNotebookId: undefined,
      updatedAt: new Date().toISOString(),
    },
    {
      source: stored.location,
      errorMessage: 'Unable to restore note.',
    }
  );

  await clearDeletedNotebookRecord(baseDir, destinationNotebookId);
  return restored;
}

export async function purgeNote(baseDir: string, noteId: string): Promise<void> {
  const stored = await resolveStoredNote(baseDir, TRASH_NOTEBOOK_ID, noteId);
  if (!stored) {
    return;
  }

  try {
    await fs.unlink(
      resolveNoteFilePath(
        baseDir,
        stored.location.notebookId,
        stored.location.filename
      )
    );
    await removeIndexEntry(baseDir, noteId);
  } catch (error) {
    throw new AppError('WRITE_ERROR', 'Unable to permanently delete note.', {
      details: errorDetails(error),
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

    const filePath = path.join(trashedNotebookRecordsPath(baseDir), file);
    const record = await readJsonFile(filePath, parseDeletedNotebookRecord);

    if (!record) {
      continue;
    }

    const deletedAt = new Date(record.deletedAt).getTime();
    if ((Number.isNaN(deletedAt) ? 0 : deletedAt) <= cutoffTime) {
      await fs.unlink(filePath).catch(() => undefined);
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
