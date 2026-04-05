import { AppError, type Note, type NoteMeta } from './storage-core';
import {
  type NoteIndex,
  type NoteIndexEntry,
  type NoteQueryOptions,
  type StoredNote,
  listMarkdownFiles,
  readJsonFile,
  readNotebookDirectories,
  resolveNotebookPath,
  workspacePaths,
  writeJsonFile,
} from './storage-shared';
import {
  createNoteIndexEntry,
  hydrateIndexedNote,
  noteToMeta,
  readStoredNoteAtLocation,
} from './storage-note-files';

function parseNoteIndexEntry(value: unknown): NoteIndexEntry | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
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

  return {
    notebookId: candidate.notebookId,
    filename: candidate.filename,
    title: candidate.title,
    createdAt: candidate.createdAt,
    updatedAt: candidate.updatedAt,
  };
}

function parseNoteIndex(value: unknown): NoteIndex | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const index: NoteIndex = {};

  for (const [noteId, entry] of Object.entries(value)) {
    const parsedEntry = parseNoteIndexEntry(entry);
    if (!parsedEntry) {
      return null;
    }

    index[noteId] = parsedEntry;
  }

  return index;
}

async function readNoteIndex(baseDir: string): Promise<NoteIndex | null> {
  return readJsonFile(workspacePaths(baseDir).noteIndexFile, parseNoteIndex);
}

async function writeNoteIndex(baseDir: string, index: NoteIndex): Promise<void> {
  await writeJsonFile(workspacePaths(baseDir).noteIndexFile, index);
}

export async function rebuildNoteIndex(baseDir: string): Promise<NoteIndex> {
  const notebooks = await readNotebookDirectories(baseDir, { includeTrash: true });
  const index: NoteIndex = {};

  for (const notebook of notebooks) {
    const notebookPath = resolveNotebookPath(baseDir, notebook.id);
    const files = await listMarkdownFiles(notebookPath);

    for (const filename of files) {
      try {
        const stored = await readStoredNoteAtLocation(baseDir, {
          notebookId: notebook.id,
          filename,
        });
        index[stored.note.id] = createNoteIndexEntry(stored.note);
      } catch {
        continue;
      }
    }
  }

  await writeNoteIndex(baseDir, index);
  return index;
}

export async function ensureNoteIndex(baseDir: string): Promise<NoteIndex> {
  const current = await readNoteIndex(baseDir);
  if (current) {
    return current;
  }

  return rebuildNoteIndex(baseDir);
}

export async function upsertIndexEntry(baseDir: string, note: Note): Promise<void> {
  const index = await ensureNoteIndex(baseDir);
  index[note.id] = createNoteIndexEntry(note);
  await writeNoteIndex(baseDir, index);
}

export async function removeIndexEntry(baseDir: string, noteId: string): Promise<void> {
  const index = await ensureNoteIndex(baseDir);
  delete index[noteId];
  await writeNoteIndex(baseDir, index);
}

export async function replaceNotebookIdInIndex(
  baseDir: string,
  currentNotebookId: string,
  nextNotebookId: string
): Promise<void> {
  const index = await ensureNoteIndex(baseDir);

  for (const entry of Object.values(index)) {
    if (entry.notebookId === currentNotebookId) {
      entry.notebookId = nextNotebookId;
    }
  }

  await writeNoteIndex(baseDir, index);
}

export async function resolveStoredNote(
  baseDir: string,
  notebookId: string,
  noteId: string
): Promise<StoredNote | null> {
  const index = await ensureNoteIndex(baseDir);
  const indexed = await hydrateIndexedNote(baseDir, noteId, index[noteId]);
  if (indexed?.location.notebookId === notebookId) {
    return indexed;
  }

  const rebuiltIndex = await rebuildNoteIndex(baseDir);
  const rebuilt = await hydrateIndexedNote(baseDir, noteId, rebuiltIndex[noteId]);
  return rebuilt?.location.notebookId === notebookId ? rebuilt : null;
}

export async function findNoteFile(
  baseDir: string,
  notebookId: string,
  noteId: string
): Promise<string | null> {
  const stored = await resolveStoredNote(baseDir, notebookId, noteId);
  return stored?.location.filename ?? null;
}

function matchesNoteQuery(note: Note, options: NoteQueryOptions = {}): boolean {
  const isDeleted = typeof note.deletedAt === 'string';

  if (options.deletedOnly) {
    return isDeleted;
  }

  if (!options.includeDeleted && isDeleted) {
    return false;
  }

  return true;
}

async function collectNotesFromIndex(
  baseDir: string,
  index: NoteIndex,
  options?: NoteQueryOptions
): Promise<NoteMeta[] | null> {
  const notes: NoteMeta[] = [];

  for (const [noteId, entry] of Object.entries(index)) {
    const stored = await hydrateIndexedNote(baseDir, noteId, entry);
    if (!stored) {
      return null;
    }

    if (matchesNoteQuery(stored.note, options)) {
      notes.push(noteToMeta(stored.note));
    }
  }

  return notes;
}

export async function listAllNotes(
  baseDir: string,
  options?: NoteQueryOptions
): Promise<NoteMeta[]> {
  const currentIndex = await ensureNoteIndex(baseDir);
  const currentNotes = await collectNotesFromIndex(baseDir, currentIndex, options);
  const notes =
    currentNotes ??
    (await collectNotesFromIndex(baseDir, await rebuildNoteIndex(baseDir), options)) ??
    [];

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
  const stored = await resolveStoredNote(baseDir, notebookId, noteId);
  if (!stored) {
    throw new AppError('NOT_FOUND', `Note "${noteId}" was not found.`);
  }

  return stored.note;
}
