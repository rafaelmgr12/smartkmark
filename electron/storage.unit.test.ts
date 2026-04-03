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
  rebuildNoteIndex,
  listAllNotes,
  listDeletedNotes,
  listNotebooks,
  renameNotebook,
  sanitizeNotebookName,
  TRASH_NOTEBOOK_ID,
  updateNote,
  updateSettings,
  deleteNote,
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
      layoutMode: 'editor',
      editorFontSize: 'lg',
      previewOpen: true,
    });

    expect(settings.theme).toBe('workbench-light');
    expect(settings.layoutMode).toBe('editor');
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

  it('maintains a persisted index across note mutations', async () => {
    const baseDir = await createTempWorkspace();
    await createNotebook(baseDir, 'Docs');
    const created = await createNote(baseDir, {
      notebookId: 'Docs',
      title: 'Alpha',
    });

    let index = JSON.parse(
      await fs.readFile(path.join(baseDir, '.index.json'), 'utf-8')
    ) as Record<string, { notebookId: string; filename: string }>;
    expect(index[created.id]?.notebookId).toBe('Docs');
    expect(index[created.id]?.filename).toContain('--');

    const renamed = await updateNote(baseDir, {
      id: created.id,
      notebookId: 'Docs',
      title: 'Beta',
    });
    index = JSON.parse(
      await fs.readFile(path.join(baseDir, '.index.json'), 'utf-8')
    ) as Record<string, { notebookId: string; filename: string }>;
    expect(index[created.id]?.filename).toContain('beta');
    expect(index[created.id]?.filename).toContain(renamed.id.slice(0, 8));

    await createNotebook(baseDir, 'Archive');
    await moveNote(baseDir, created.id, 'Docs', 'Archive');
    index = JSON.parse(
      await fs.readFile(path.join(baseDir, '.index.json'), 'utf-8')
    ) as Record<string, { notebookId: string; filename: string }>;
    expect(index[created.id]?.notebookId).toBe('Archive');

    await renameNotebook(baseDir, 'Archive', 'Archive 2026');
    index = JSON.parse(
      await fs.readFile(path.join(baseDir, '.index.json'), 'utf-8')
    ) as Record<string, { notebookId: string; filename: string }>;
    expect(index[created.id]?.notebookId).toBe('Archive 2026');

    await deleteNote(baseDir, 'Archive 2026', created.id);
    index = JSON.parse(
      await fs.readFile(path.join(baseDir, '.index.json'), 'utf-8')
    ) as Record<string, { notebookId: string; filename: string }>;
    expect(index[created.id]?.notebookId).toBe(TRASH_NOTEBOOK_ID);

    const deleted = await listDeletedNotes(baseDir);
    expect(deleted.find((note) => note.id === created.id)?.deletedAt).toBeTruthy();
  });

  it('recovers from index inconsistencies by rebuilding automatically', async () => {
    const baseDir = await createTempWorkspace();
    const note = await createNote(baseDir, { notebookId: 'Inbox', title: 'Recover' });
    const indexPath = path.join(baseDir, '.index.json');

    await fs.writeFile(
      indexPath,
      JSON.stringify(
        {
          [note.id]: {
            notebookId: 'Inbox',
            filename: 'missing.md',
            title: 'Recover',
            createdAt: note.createdAt,
            updatedAt: note.updatedAt,
          },
        },
        null,
        2
      ),
      'utf-8'
    );

    const notes = await listAllNotes(baseDir);
    expect(notes.map((entry) => entry.id)).toContain(note.id);

    const rebuilt = JSON.parse(await fs.readFile(indexPath, 'utf-8')) as Record<
      string,
      { filename: string }
    >;
    expect(rebuilt[note.id]?.filename).not.toBe('missing.md');
  });

  it('rebuilds index through explicit internal command', async () => {
    const baseDir = await createTempWorkspace();
    const first = await createNote(baseDir, { notebookId: 'Inbox', title: 'One' });
    await createNote(baseDir, { notebookId: 'Inbox', title: 'Two' });

    await fs.writeFile(path.join(baseDir, '.index.json'), '{}', 'utf-8');

    const rebuilt = await rebuildNoteIndex(baseDir);
    expect(Object.keys(rebuilt)).toContain(first.id);
    expect(Object.keys(rebuilt)).toHaveLength(2);
  });
});
