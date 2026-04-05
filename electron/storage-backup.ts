import fs from 'node:fs/promises';
import path from 'node:path';
import {
  ArchiveReadError,
  ArchiveValidationError,
  ArchiveWriteError,
  createZipArchive,
  extractZipArchive,
  validateZipArchiveEntries,
} from './zip-archive';
import { AppError } from './storage-core';
import {
  NOTE_INDEX_FILE,
  SETTINGS_FILE,
  ensureBaseDir,
  errorDetails,
} from './storage-shared';

function getTimestampLabel(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function assertSafeRelativePath(relativePath: string): void {
  const normalized = relativePath.replace(/\\/g, '/');
  if (
    normalized.startsWith('/') ||
    normalized.startsWith('../') ||
    normalized.includes('/../')
  ) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Backup archive contains an invalid file path.'
    );
  }
}

function assertPathWithinRoot(rootDir: string, targetPath: string, message: string): void {
  const resolvedRootDir = path.resolve(rootDir);
  const resolvedTargetPath = path.resolve(targetPath);
  const relativePath = path.relative(resolvedRootDir, resolvedTargetPath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new AppError('VALIDATION_ERROR', message);
  }
}

async function validateExtractedTree(
  rootDir: string,
  currentDir = rootDir,
  resolvedRootDir?: string
): Promise<void> {
  const safeRootDir = resolvedRootDir ?? (await fs.realpath(rootDir));
  const entries = await fs.readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(currentDir, entry.name);
    const relativePath = path.relative(rootDir, entryPath);
    const stats = await fs.lstat(entryPath);

    assertSafeRelativePath(relativePath);

    if (stats.isSymbolicLink()) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Backup archive contains symbolic links, which are not allowed.'
      );
    }

    const realEntryPath = await fs.realpath(entryPath);
    assertPathWithinRoot(
      safeRootDir,
      realEntryPath,
      'Backup archive contains content outside the extraction directory.'
    );

    if (stats.isDirectory()) {
      await validateExtractedTree(rootDir, entryPath, safeRootDir);
    }
  }
}

async function validateWorkspaceStructure(candidateDir: string): Promise<void> {
  const entries = await fs.readdir(candidateDir, { withFileTypes: true });
  const notebookDirs = entries.filter((entry) => entry.isDirectory());
  const settingsFiles = entries.filter(
    (entry) => entry.isFile() && entry.name === SETTINGS_FILE
  );

  if (entries.length === 0 || notebookDirs.length === 0) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Backup archive does not contain a valid workspace structure.'
    );
  }

  if (settingsFiles.length > 1) {
    throw new AppError('VALIDATION_ERROR', 'Backup contains duplicate settings.');
  }

  for (const entry of entries) {
    assertSafeRelativePath(entry.name);

    if (
      entry.isFile() &&
      entry.name !== SETTINGS_FILE &&
      entry.name !== NOTE_INDEX_FILE
    ) {
      throw new AppError(
        'VALIDATION_ERROR',
        `Unexpected file in workspace root: "${entry.name}".`
      );
    }
  }
}

async function resolveExtractedWorkspaceDir(extractRoot: string): Promise<string> {
  await validateExtractedTree(extractRoot);

  const rootEntries = await fs.readdir(extractRoot, { withFileTypes: true });
  const candidate =
    rootEntries.length === 1 && rootEntries[0]?.isDirectory()
      ? path.join(extractRoot, rootEntries[0].name)
      : extractRoot;

  await validateWorkspaceStructure(candidate);
  return candidate;
}

async function copyValidatedWorkspaceTree(
  sourceDir: string,
  targetDir: string
): Promise<void> {
  await fs.mkdir(targetDir, { recursive: true });

  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await copyValidatedWorkspaceTree(sourcePath, targetPath);
      continue;
    }

    if (!entry.isFile()) {
      throw new AppError(
        'VALIDATION_ERROR',
        `Backup archive contains an unsupported entry: "${entry.name}".`
      );
    }

    await fs.copyFile(sourcePath, targetPath);
  }
}

export async function exportWorkspaceBackup(
  baseDir: string,
  targetZipPath: string
): Promise<string> {
  await ensureBaseDir(baseDir);

  try {
    await createZipArchive(baseDir, path.resolve(targetZipPath));
  } catch (error) {
    if (error instanceof ArchiveValidationError) {
      throw new AppError('VALIDATION_ERROR', error.message);
    }

    if (error instanceof ArchiveWriteError) {
      throw new AppError('WRITE_ERROR', 'Unable to export workspace backup zip.', {
        details: error.cause instanceof Error ? error.cause.message : error.message,
      });
    }

    throw error;
  }

  return path.resolve(targetZipPath);
}

export async function createIncrementalBackup(baseDir: string): Promise<string> {
  const backupRoot = path.join(path.dirname(baseDir), 'SmartKMark Backups');
  const backupName = `smartkmark-backup-${getTimestampLabel()}.zip`;
  const targetPath = path.join(backupRoot, backupName);
  return exportWorkspaceBackup(baseDir, targetPath);
}

export async function importWorkspaceBackup(
  baseDir: string,
  sourceZipPath: string
): Promise<void> {
  const tempRoot = await fs.mkdtemp(path.join(baseDir, '..', 'smartkmark-restore-'));
  const extractedDir = path.join(tempRoot, 'extracted');
  const stagedDir = path.join(tempRoot, 'staged');
  const previousDir = `${baseDir}.rollback-${Date.now()}`;

  await fs.mkdir(extractedDir, { recursive: true });

  try {
    const resolvedSourceZipPath = path.resolve(sourceZipPath);
    await validateZipArchiveEntries(resolvedSourceZipPath);
    await extractZipArchive(resolvedSourceZipPath, extractedDir);
    const workspaceDir = await resolveExtractedWorkspaceDir(extractedDir);
    await copyValidatedWorkspaceTree(workspaceDir, stagedDir);
    await ensureBaseDir(stagedDir);
  } catch (error) {
    await fs.rm(tempRoot, { recursive: true, force: true });

    if (error instanceof AppError) {
      throw error;
    }

    if (error instanceof ArchiveValidationError) {
      throw new AppError('VALIDATION_ERROR', error.message);
    }

    if (error instanceof ArchiveReadError) {
      throw new AppError('READ_ERROR', 'Unable to prepare backup import.', {
        details: error.cause instanceof Error ? error.cause.message : error.message,
      });
    }

    throw new AppError('READ_ERROR', 'Unable to prepare backup import.', {
      details: errorDetails(error),
    });
  }

  let replaced = false;

  try {
    await fs.rename(baseDir, previousDir);
    replaced = true;
    await fs.rename(stagedDir, baseDir);
    await fs.rm(previousDir, { recursive: true, force: true });
    await fs.rm(tempRoot, { recursive: true, force: true });
  } catch (error) {
    if (replaced) {
      await fs.rm(baseDir, { recursive: true, force: true }).catch(() => undefined);
      await fs.rename(previousDir, baseDir).catch(() => undefined);
    }

    await fs.rm(tempRoot, { recursive: true, force: true });
    throw new AppError('WRITE_ERROR', 'Unable to restore workspace backup.', {
      details: errorDetails(error),
    });
  }
}
