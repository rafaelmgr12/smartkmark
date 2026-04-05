import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import yauzl, { type Entry as YauzlEntry, type ZipFile as YauzlZipFile } from 'yauzl';
import yazl, { type ZipFile as YazlZipFile } from 'yazl';

export class ArchiveValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArchiveValidationError';
  }
}

export class ArchiveReadError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'ArchiveReadError';
    this.cause = options?.cause;
  }

  cause?: unknown;
}

export class ArchiveWriteError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'ArchiveWriteError';
    this.cause = options?.cause;
  }

  cause?: unknown;
}

function resolvePathWithinRoot(rootDir: string, ...segments: string[]): string {
  const resolvedRootDir = path.resolve(rootDir);
  const resolvedPath = path.resolve(resolvedRootDir, ...segments);
  const relativePath = path.relative(resolvedRootDir, resolvedPath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new ArchiveValidationError('Archive content escapes the target directory.');
  }

  return resolvedPath;
}

function assertSafeRelativePath(relativePath: string): void {
  const normalized = relativePath.replace(/\\/g, '/');

  if (
    normalized.startsWith('/') ||
    normalized.startsWith('../') ||
    normalized.includes('/../')
  ) {
    throw new ArchiveValidationError('Archive contains an invalid file path.');
  }
}

async function addDirectoryToZip(
  zipFile: YazlZipFile,
  currentDir: string,
  rootDir: string
): Promise<void> {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  const normalizedDirPath = path.relative(rootDir, currentDir).replace(/\\/g, '/');

  if (normalizedDirPath) {
    zipFile.addEmptyDirectory(normalizedDirPath);
  }

  for (const entry of entries) {
    const sourcePath = path.join(currentDir, entry.name);
    const metadataPath = path.relative(rootDir, sourcePath).replace(/\\/g, '/');
    const stats = await fs.lstat(sourcePath);

    if (stats.isSymbolicLink()) {
      throw new ArchiveValidationError(
        `Workspace contains unsupported symbolic link: "${metadataPath}".`
      );
    }

    if (stats.isDirectory()) {
      await addDirectoryToZip(zipFile, sourcePath, rootDir);
      continue;
    }

    if (!stats.isFile()) {
      throw new ArchiveValidationError(
        `Workspace contains unsupported entry: "${metadataPath}".`
      );
    }

    zipFile.addFile(sourcePath, metadataPath);
  }
}

function openZipFile(sourceZipPath: string): Promise<YauzlZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(
      sourceZipPath,
      { lazyEntries: true, decodeStrings: true },
      (error, zipFile) => {
        if (error || !zipFile) {
          reject(error ?? new Error('Unable to open zip file.'));
          return;
        }

        resolve(zipFile);
      }
    );
  });
}

function isDirectoryArchiveEntry(entry: YauzlEntry): boolean {
  return entry.fileName.endsWith('/');
}

function isSymbolicLinkArchiveEntry(entry: YauzlEntry): boolean {
  const fileType = (entry.externalFileAttributes >>> 16) & 0o170000;
  return fileType === 0o120000;
}

function openArchiveReadStream(
  zipFile: YauzlZipFile,
  entry: YauzlEntry
): Promise<NodeJS.ReadableStream> {
  return new Promise((resolve, reject) => {
    zipFile.openReadStream(entry, (error, stream) => {
      if (error || !stream) {
        reject(error ?? new Error('Unable to read archive entry.'));
        return;
      }

      resolve(stream);
    });
  });
}

async function forEachArchiveEntry(
  sourceZipPath: string,
  onEntry: (entry: YauzlEntry, zipFile: YauzlZipFile) => Promise<void>
): Promise<void> {
  const zipFile = await openZipFile(sourceZipPath);

  await new Promise<void>((resolve, reject) => {
    let settled = false;

    const fail = (error: Error) => {
      if (settled) {
        return;
      }

      settled = true;
      zipFile.close();
      reject(error);
    };

    zipFile.on('error', fail);
    zipFile.on('end', () => {
      if (settled) {
        return;
      }

      settled = true;
      resolve();
    });
    zipFile.on('entry', (entry) => {
      void onEntry(entry, zipFile)
        .then(() => {
          zipFile.readEntry();
        })
        .catch((error: unknown) => {
          fail(error instanceof Error ? error : new Error('Unable to process archive entry.'));
        });
    });

    zipFile.readEntry();
  }).finally(() => {
    zipFile.close();
  });
}

export async function createZipArchive(
  sourceDir: string,
  targetZipPath: string
): Promise<void> {
  await fs.mkdir(path.dirname(targetZipPath), { recursive: true });

  try {
    const zipFile = new yazl.ZipFile();
    const outputStream = createWriteStream(targetZipPath);
    const writePromise = pipeline(zipFile.outputStream, outputStream);

    await addDirectoryToZip(zipFile, sourceDir, sourceDir);
    zipFile.end();
    await writePromise;
  } catch (error) {
    if (error instanceof ArchiveValidationError) {
      throw error;
    }

    throw new ArchiveWriteError('Unable to write zip archive.', { cause: error });
  }
}

export async function validateZipArchiveEntries(sourceZipPath: string): Promise<void> {
  try {
    await forEachArchiveEntry(sourceZipPath, async (entry) => {
      assertSafeRelativePath(entry.fileName);

      if (isSymbolicLinkArchiveEntry(entry)) {
        throw new ArchiveValidationError(
          'Backup archive contains symbolic links, which are not allowed.'
        );
      }
    });
  } catch (error) {
    if (error instanceof ArchiveValidationError) {
      throw error;
    }

    throw new ArchiveReadError('Unable to inspect zip archive.', { cause: error });
  }
}

export async function extractZipArchive(
  sourceZipPath: string,
  destinationDir: string
): Promise<void> {
  try {
    await forEachArchiveEntry(sourceZipPath, async (entry, zipFile) => {
      assertSafeRelativePath(entry.fileName);

      if (isSymbolicLinkArchiveEntry(entry)) {
        throw new ArchiveValidationError(
          'Backup archive contains symbolic links, which are not allowed.'
        );
      }

      const targetPath = resolvePathWithinRoot(destinationDir, entry.fileName);
      if (isDirectoryArchiveEntry(entry)) {
        await fs.mkdir(targetPath, { recursive: true });
        return;
      }

      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      const readStream = await openArchiveReadStream(zipFile, entry);
      await pipeline(readStream, createWriteStream(targetPath));
    });
  } catch (error) {
    if (error instanceof ArchiveValidationError) {
      throw error;
    }

    throw new ArchiveReadError('Unable to extract zip archive.', { cause: error });
  }
}
