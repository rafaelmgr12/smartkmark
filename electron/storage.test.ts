import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import {
  AppError,
  createNote,
  createNotebook,
  ensureBaseDir,
  exportWorkspaceBackup,
  importWorkspaceBackup,
  listAllNotes,
} from './storage';

const execFileAsync = promisify(execFile);
const tempDirs: string[] = [];

async function createTempDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true }))
  );
});

describe('workspace backups', () => {
  it('exports and imports workspace zip successfully', async () => {
    const workspace = await createTempDir('smartkmark-workspace-');
    await ensureBaseDir(workspace);
    await createNotebook(workspace, 'Projects');
    const created = await createNote(workspace, {
      notebookId: 'Projects',
      title: 'Backup me',
      body: 'original body',
    });

    const zipPath = path.join(await createTempDir('smartkmark-archive-'), 'backup.zip');
    await exportWorkspaceBackup(workspace, zipPath);

    await fs.rm(path.join(workspace, 'Projects'), { recursive: true, force: true });
    await createNotebook(workspace, 'Scratch');

    await importWorkspaceBackup(workspace, zipPath);

    const notes = await listAllNotes(workspace);
    expect(notes.find((note) => note.id === created.id)?.title).toBe('Backup me');
    expect(notes.some((note) => note.notebookId === 'Scratch')).toBe(false);
  });

  it('rejects corrupt zip during import', async () => {
    const workspace = await createTempDir('smartkmark-workspace-');
    await ensureBaseDir(workspace);

    const brokenZip = path.join(await createTempDir('smartkmark-broken-'), 'broken.zip');
    await fs.writeFile(brokenZip, 'this is not a zip archive', 'utf-8');

    await expect(importWorkspaceBackup(workspace, brokenZip)).rejects.toMatchObject({
      code: 'READ_ERROR',
    } satisfies Partial<AppError>);
  });

  it('keeps current workspace intact when backup validation fails', async () => {
    const workspace = await createTempDir('smartkmark-workspace-');
    await ensureBaseDir(workspace);
    await createNotebook(workspace, 'Inbox Two');
    await createNote(workspace, {
      notebookId: 'Inbox Two',
      title: 'Keep me',
      body: 'do not lose',
    });

    const invalidSource = await createTempDir('smartkmark-invalid-src-');
    await fs.writeFile(path.join(invalidSource, 'README.txt'), 'invalid workspace');

    const invalidZip = path.join(await createTempDir('smartkmark-invalid-zip-'), 'invalid.zip');
    await execFileAsync('zip', ['-r', '-q', invalidZip, '.'], { cwd: invalidSource });

    await expect(importWorkspaceBackup(workspace, invalidZip)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    } satisfies Partial<AppError>);

    const notesAfter = await listAllNotes(workspace);
    expect(notesAfter).toHaveLength(1);
    expect(notesAfter[0]?.title).toBe('Keep me');
  });
});
