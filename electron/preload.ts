import { contextBridge, ipcRenderer } from 'electron';

function parseError(error: unknown) {
  if (error instanceof Error) {
    try {
      return JSON.parse(error.message);
    } catch {
      return {
        code: 'UNKNOWN_ERROR',
        message: error.message,
        recoverable: true,
      };
    }
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: 'Unknown preload error.',
    recoverable: true,
  };
}

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  try {
    return await ipcRenderer.invoke(channel, ...args);
  } catch (error) {
    return Promise.reject(parseError(error));
  }
}

contextBridge.exposeInMainWorld('desktopApi', {
  listNotebooks: () => invoke('notebooks:list'),
  createNotebook: (name: string) => invoke('notebooks:create', name),
  renameNotebook: (id: string, name: string) =>
    invoke('notebooks:rename', id, name),
  deleteNotebook: (id: string) => invoke('notebooks:delete', id),

  listNotes: () => invoke('notes:list'),
  getNote: (notebookId: string, noteId: string) =>
    invoke('notes:get', notebookId, noteId),
  createNote: (payload: { notebookId: string; title: string; body?: string }) =>
    invoke('notes:create', payload),
  updateNote: (payload: {
    id: string;
    notebookId: string;
    title?: string;
    body?: string;
    tags?: { label: string; color: string }[];
    pinned?: boolean;
    status?: string;
  }) => invoke('notes:update', payload),
  deleteNote: (notebookId: string, noteId: string) =>
    invoke('notes:delete', notebookId, noteId),
  moveNote: (noteId: string, fromNotebookId: string, toNotebookId: string) =>
    invoke('notes:move', noteId, fromNotebookId, toNotebookId),

  getSettings: () => invoke('settings:get'),
  updateSettings: (patch: Record<string, unknown>) =>
    invoke('settings:update', patch),
});
