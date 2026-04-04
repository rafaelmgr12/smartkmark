declare module 'yauzl' {
  export interface Entry {
    externalFileAttributes: number;
    fileName: string;
  }

  export interface ZipFile {
    close(): void;
    on(event: 'close' | 'end', listener: () => void): ZipFile;
    on(event: 'entry', listener: (entry: Entry) => void): ZipFile;
    on(event: 'error', listener: (error: Error) => void): ZipFile;
    openReadStream(
      entry: Entry,
      callback: (error: Error | null, stream?: NodeJS.ReadableStream) => void
    ): void;
    readEntry(): void;
  }

  export function open(
    path: string,
    options: { lazyEntries: boolean; decodeStrings: boolean },
    callback: (error: Error | null, zipFile?: ZipFile) => void
  ): void;

  const yauzl: {
    open: typeof open;
  };

  export default yauzl;
}

declare module 'yazl' {
  export interface ZipFile {
    addBuffer(
      buffer: Buffer,
      metadataPath: string,
      options?: { mode?: number; mtime?: Date }
    ): void;
    addEmptyDirectory(
      metadataPath: string,
      options?: { mode?: number; mtime?: Date }
    ): void;
    addFile(
      realPath: string,
      metadataPath: string,
      options?: { mode?: number; mtime?: Date }
    ): void;
    end(options?: unknown, callback?: () => void): void;
    outputStream: NodeJS.ReadableStream;
  }

  const yazl: {
    ZipFile: new () => ZipFile;
  };

  export default yazl;
}
