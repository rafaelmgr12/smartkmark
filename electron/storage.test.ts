import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import matter from 'gray-matter';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createNote,
  deleteNote,
  ensureBaseDir,
  getNote,
  listAllNotes,
  purgeDeletedNotes,
  purgeNote,
  restoreNote,
} from './storage';

const tempDirs: string[] = [];

async function createTempWorkspace() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'smartkmark-'));
  tempDirs.push(dir);
  await ensureBaseDir(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true }))
  );
});

describe('storage trash lifecycle', () => {
  it('restores a soft-deleted note back to its notebook', async () => {
    const baseDir = await createTempWorkspace();
    const created = await createNote(baseDir, {
      notebookId: 'Inbox',
      title: 'Recover me',
      body: 'content',
    });

    await deleteNote(baseDir, 'Inbox', created.id);
    const trashed = await listAllNotes(baseDir, { onlyDeleted: true });
    expect(trashed.map((note) => note.id)).toContain(created.id);

    const restored = await restoreNote(baseDir, created.id);
    expect(restored.notebookId).toBe('Inbox');
    expect(restored.deletedAt).toBeUndefined();

    const opened = await getNote(baseDir, 'Inbox', created.id);
    expect(opened.title).toBe('Recover me');
  });

  it('purges notes from trash directly and through retention cleanup', async () => {
    const baseDir = await createTempWorkspace();
    const oldNote = await createNote(baseDir, {
      notebookId: 'Inbox',
      title: 'Old',
    });
    const recentNote = await createNote(baseDir, {
      notebookId: 'Inbox',
      title: 'Recent',
    });

    await deleteNote(baseDir, 'Inbox', oldNote.id);
    await deleteNote(baseDir, 'Inbox', recentNote.id);
    await purgeNote(baseDir, recentNote.id);

    const trashDir = path.join(baseDir, '.trash');
    const trashFiles = await fs.readdir(trashDir);
    const oldFile = trashFiles.find((file) => file.includes(oldNote.id.slice(0, 8)));
    expect(oldFile).toBeDefined();
    const oldPath = path.join(trashDir, oldFile!);
    const stale = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
    await fs.utimes(oldPath, stale, stale);

    const raw = await fs.readFile(oldPath, 'utf-8');
    const parsed = matter(raw);
    parsed.data.deletedAt = stale.toISOString();
    await fs.writeFile(oldPath, matter.stringify(parsed.content, parsed.data), 'utf-8');

    const removed = await purgeDeletedNotes(baseDir, { olderThanDays: 30 });
    expect(removed).toBe(1);

    const trashed = await listAllNotes(baseDir, { onlyDeleted: true });
    expect(trashed).toEqual([]);
  });
});
