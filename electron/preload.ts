import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('desktopApi', {
  // Notebooks
  listNotebooks: () => ipcRenderer.invoke('notebooks:list'),
  createNotebook: (name: string) => ipcRenderer.invoke('notebooks:create', name),
  renameNotebook: (id: string, name: string) =>
    ipcRenderer.invoke('notebooks:rename', id, name),
  deleteNotebook: (id: string) => ipcRenderer.invoke('notebooks:delete', id),

  // Notes
  listNotes: () => ipcRenderer.invoke('notes:list'),
  getNote: (notebookId: string, noteId: string) =>
    ipcRenderer.invoke('notes:get', notebookId, noteId),
  createNote: (payload: { notebookId: string; title: string; body?: string }) =>
    ipcRenderer.invoke('notes:create', payload),
  updateNote: (payload: {
    id: string;
    notebookId: string;
    title?: string;
    body?: string;
    tags?: { label: string; color: string }[];
    pinned?: boolean;
    status?: string;
  }) => ipcRenderer.invoke('notes:update', payload),
  deleteNote: (notebookId: string, noteId: string) =>
    ipcRenderer.invoke('notes:delete', notebookId, noteId),
  moveNote: (noteId: string, fromNotebookId: string, toNotebookId: string) =>
    ipcRenderer.invoke('notes:move', noteId, fromNotebookId, toNotebookId),
});
