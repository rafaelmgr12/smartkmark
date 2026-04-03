import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  AppError,
  createNotebook,
  createNote,
  ensureBaseDir,
  moveNote,
  listAllNotes,
  listNotebooks,
  renameNotebook,
  sanitizeNotebookName,
  updateSettings,
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

describe('storage', () => {
  it('sanitizes notebook names', () => {
    expect(sanitizeNotebookName('  Work / Notes  ')).toBe('Work Notes');
  });

  it('rejects empty notebook names', () => {
    expect(() => sanitizeNotebookName('///')).toThrow(AppError);
  });

  it('creates notebooks and notes without collisions', async () => {
    const baseDir = await createTempWorkspace();
    await createNotebook(baseDir, 'Projects');
    await createNote(baseDir, { notebookId: 'Projects', title: 'Readme' });
    await createNote(baseDir, { notebookId: 'Projects', title: 'Readme' });

    const notes = await listAllNotes(baseDir);
    expect(notes).toHaveLength(2);
    expect(new Set(notes.map((note) => note.id)).size).toBe(2);
  });

  it('ignores corrupt markdown files while listing notes', async () => {
    const baseDir = await createTempWorkspace();
    await fs.mkdir(path.join(baseDir, 'Inbox'), { recursive: true });
    await fs.writeFile(path.join(baseDir, 'Inbox', 'broken.md'), '---\n: bad');

    const notes = await listAllNotes(baseDir);
    expect(notes).toEqual([]);
  });

  it('persists normalized app settings', async () => {
    const baseDir = await createTempWorkspace();
    const settings = await updateSettings(baseDir, {
      theme: 'workbench-light',
      editorFontSize: 'lg',
      previewOpen: true,
    });

    expect(settings.theme).toBe('workbench-light');
    expect(settings.editorFontSize).toBe('lg');
    expect(settings.previewOpen).toBe(true);
  });

  it('lists the default inbox notebook', async () => {
    const baseDir = await createTempWorkspace();
    const notebooks = await listNotebooks(baseDir);
    expect(notebooks.map((notebook) => notebook.id)).toContain('Inbox');
  });

  it('renames a notebook and keeps its notes addressable', async () => {
    const baseDir = await createTempWorkspace();
    await createNotebook(baseDir, 'Drafts');
    await createNote(baseDir, { notebookId: 'Drafts', title: 'Spec' });

    await renameNotebook(baseDir, 'Drafts', 'Backend Notes');

    const notebooks = await listNotebooks(baseDir);
    const notes = await listAllNotes(baseDir);

    expect(notebooks.map((notebook) => notebook.id)).toContain('Backend Notes');
    expect(notes[0]?.notebookId).toBe('Backend Notes');
  });

  it('moves a note between notebooks without losing metadata', async () => {
    const baseDir = await createTempWorkspace();
    await createNotebook(baseDir, 'Inbox Two');
    const created = await createNote(baseDir, {
      notebookId: 'Inbox',
      title: 'Move me',
      body: 'payload',
    });

    const moved = await moveNote(baseDir, created.id, 'Inbox', 'Inbox Two');

    expect(moved.notebookId).toBe('Inbox Two');
    const notes = await listAllNotes(baseDir);
    expect(notes.find((note) => note.id === created.id)?.notebookId).toBe(
      'Inbox Two'
    );
  });
});
