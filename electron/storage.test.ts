import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { afterEach, describe, expect, it } from 'vitest';
import {
  AppError,
  createNote,
  createNotebook,
  deleteNote,
  deleteNotebook,
  ensureBaseDir,
  exportWorkspaceBackup,
  importWorkspaceBackup,
  listAllNotes,
  listDeletedNotes,
  listNotebooks,
  purgeDeletedNotes,
  purgeNote,
  restoreNote,
} from './storage';
const yazl = require('yazl') as {
  ZipFile: new () => {
    addBuffer: (buffer: Buffer, metadataPath: string, options?: { mode?: number }) => void;
    addEmptyDirectory: (metadataPath: string, options?: { mode?: number }) => void;
    end: (options?: unknown, callback?: () => void) => void;
    outputStream: NodeJS.ReadableStream;
  };
};
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

async function writeZipArchive(
  targetPath: string,
  build: (zipFile: InstanceType<typeof yazl.ZipFile>) => void
): Promise<void> {
  const zipFile = new yazl.ZipFile();
  const outputStream = createWriteStream(targetPath);
  const writePromise = pipeline(zipFile.outputStream, outputStream);

  build(zipFile);
  zipFile.end();
  await writePromise;
}

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

    const invalidZip = path.join(await createTempDir('smartkmark-invalid-zip-'), 'invalid.zip');
    await writeZipArchive(invalidZip, (zipFile) => {
      zipFile.addBuffer(Buffer.from('invalid workspace', 'utf-8'), 'README.txt');
    });

    await expect(importWorkspaceBackup(workspace, invalidZip)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    } satisfies Partial<AppError>);

    const notesAfter = await listAllNotes(workspace);
    expect(notesAfter).toHaveLength(1);
    expect(notesAfter[0]?.title).toBe('Keep me');
  });

  it('rejects archive entries that encode symbolic links', async () => {
    const workspace = await createTempDir('smartkmark-workspace-');
    await ensureBaseDir(workspace);

    const invalidZip = path.join(await createTempDir('smartkmark-slip-zip-'), 'slip.zip');
    await writeZipArchive(invalidZip, (zipFile) => {
      zipFile.addBuffer(Buffer.from('owned', 'utf-8'), 'symlink-note', {
        mode: 0o120777,
      });
      zipFile.addEmptyDirectory('Inbox/');
    });

    await expect(importWorkspaceBackup(workspace, invalidZip)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    } satisfies Partial<AppError>);

    await expect(fs.access(path.join(workspace, 'symlink-note'))).rejects.toBeTruthy();
  });
});

describe('trash storage', () => {
  it('restores a trashed note and recreates its notebook when needed', async () => {
    const workspace = await createTempDir('smartkmark-workspace-');
    await ensureBaseDir(workspace);
    await createNotebook(workspace, 'Projects');
    const created = await createNote(workspace, {
      notebookId: 'Projects',
      title: 'Restore me',
      body: 'from trash',
    });

    await deleteNotebook(workspace, 'Projects');

    expect(await listNotebooks(workspace)).not.toContainEqual(
      expect.objectContaining({ id: 'Projects' })
    );
    expect((await listAllNotes(workspace)).map((note) => note.id)).not.toContain(created.id);
    expect((await listDeletedNotes(workspace)).map((note) => note.id)).toContain(created.id);

    const restored = await restoreNote(workspace, created.id);

    expect(restored.notebookId).toBe('Projects');
    expect(restored.deletedAt).toBeUndefined();
    expect((await listNotebooks(workspace)).map((note) => note.id)).toContain('Projects');
    expect((await listAllNotes(workspace)).map((note) => note.id)).toContain(created.id);
    expect((await listDeletedNotes(workspace)).map((note) => note.id)).not.toContain(
      created.id
    );
  });

  it('purges deleted notes directly and through the retention cleanup', async () => {
    const workspace = await createTempDir('smartkmark-workspace-');
    await ensureBaseDir(workspace);

    const direct = await createNote(workspace, {
      notebookId: 'Inbox',
      title: 'Delete forever',
    });
    await deleteNote(workspace, 'Inbox', direct.id);
    await purgeNote(workspace, direct.id);

    expect((await listDeletedNotes(workspace)).map((note) => note.id)).not.toContain(
      direct.id
    );

    const aged = await createNote(workspace, {
      notebookId: 'Inbox',
      title: 'Auto cleanup',
    });
    await deleteNote(workspace, 'Inbox', aged.id, '2026-01-01T00:00:00.000Z');

    const purged = await purgeDeletedNotes(workspace, {
      olderThanDays: 30,
      now: new Date('2026-03-15T00:00:00.000Z'),
    });

    expect(purged).toBe(1);
    expect((await listDeletedNotes(workspace)).map((note) => note.id)).not.toContain(
      aged.id
    );
    expect((await listAllNotes(workspace)).map((note) => note.id)).not.toContain(aged.id);
  });
});
