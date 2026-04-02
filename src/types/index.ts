export interface Notebook {
  id: string;
  name: string;
}

export type TagColor = 'green' | 'orange' | 'blue' | 'purple' | 'red' | 'gray';

export interface NoteTag {
  label: string;
  color: TagColor;
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
  getNote: (notebookId: string, noteId: string) => Promise<Note>;
  createNote: (payload: CreateNotePayload) => Promise<Note>;
  updateNote: (payload: UpdateNotePayload) => Promise<Note>;
  deleteNote: (notebookId: string, noteId: string) => Promise<void>;
  moveNote: (noteId: string, fromNotebookId: string, toNotebookId: string) => Promise<Note>;
}

declare global {
  interface Window {
    desktopApi: DesktopApi;
  }
}
