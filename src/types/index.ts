export interface Notebook {
  id: string;
  name: string;
}

export type TagColor = 'green' | 'orange' | 'blue' | 'purple' | 'red' | 'gray';

export interface NoteTag {
  id?: string;
  label: string;
  color: TagColor;
}

export type ThemeName = 'workbench-dark' | 'workbench-light';
export type EditorFontSize = 'sm' | 'md' | 'lg';
export type LineWrapMode = 'wrap' | 'scroll';
export type LayoutMode = 'workbench' | 'writer' | 'editor';

export interface AppSettings {
  theme: ThemeName;
  layoutMode: LayoutMode;
  editorFontSize: EditorFontSize;
  lineWrap: LineWrapMode;
  previewOpen: boolean;
}

export interface DesktopProfile {
  fullName: string | null;
  shortName: string;
}

export interface BackupActionResult {
  canceled: boolean;
  filePath?: string;
}

export type DesktopErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'READ_ERROR'
  | 'WRITE_ERROR'
  | 'CORRUPT_FILE'
  | 'UNKNOWN_ERROR';

export interface DesktopError {
  code: DesktopErrorCode;
  message: string;
  details?: string;
  recoverable?: boolean;
}

export interface NoteMeta {
  id: string;
  title: string;
  notebookId: string;
  tags: NoteTag[];
  pinned: boolean;
  status: NoteStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  trashedFromNotebookId?: string;
}

export interface Note extends NoteMeta {
  body: string;
}

export type NoteStatus = 'active' | 'onHold' | 'completed' | 'dropped';

export interface CreateNotePayload {
  notebookId: string;
  title: string;
  body?: string;
}

export interface UpdateNotePayload {
  id: string;
  notebookId: string;
  title?: string;
  body?: string;
  tags?: NoteTag[];
  pinned?: boolean;
  status?: NoteStatus;
}

export interface DesktopApi {
  listNotebooks: () => Promise<Notebook[]>;
  createNotebook: (name: string) => Promise<Notebook>;
  renameNotebook: (id: string, name: string) => Promise<Notebook>;
  deleteNotebook: (id: string) => Promise<void>;

  listNotes: () => Promise<NoteMeta[]>;
  listTrashNotes: () => Promise<NoteMeta[]>;
  getNote: (notebookId: string, noteId: string) => Promise<Note>;
  createNote: (payload: CreateNotePayload) => Promise<Note>;
  updateNote: (payload: UpdateNotePayload) => Promise<Note>;
  deleteNote: (notebookId: string, noteId: string) => Promise<void>;
  restoreNote: (noteId: string, notebookId?: string) => Promise<Note>;
  purgeNote: (noteId: string) => Promise<void>;
  moveNote: (
    noteId: string,
    fromNotebookId: string,
    toNotebookId: string
  ) => Promise<Note>;
  getProfile: () => Promise<DesktopProfile>;
  getSettings: () => Promise<AppSettings>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>;
  exportBackup: () => Promise<BackupActionResult>;
  importBackup: () => Promise<BackupActionResult>;
  createIncrementalBackup: () => Promise<{ filePath: string }>;
}

declare global {
  interface Window {
    desktopApi: DesktopApi;
  }
}
