import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

const UPDATE_STATUS_CHANNEL = 'app:updateStatus';
const GET_UPDATE_STATUS_CHANNEL = 'app:getUpdateStatus';

type UpdateStatus =
  | { state: 'checking' }
  | { state: 'available'; version: string }
  | {
      state: 'downloading';
      version: string;
      percent: number;
      bytesPerSecond: number;
      transferred: number;
      total: number;
    }
  | { state: 'downloaded'; version: string }
  | { state: 'error'; message: string };

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
  listTrashNotes: () => invoke('notes:listDeleted'),
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
  restoreNote: (noteId: string, notebookId?: string) =>
    invoke('notes:restore', noteId, notebookId),
  purgeNote: (noteId: string) => invoke('notes:purge', noteId),
  moveNote: (noteId: string, fromNotebookId: string, toNotebookId: string) =>
    invoke('notes:move', noteId, fromNotebookId, toNotebookId),

  getProfile: () => invoke('profile:get'),
  getSettings: () => invoke('settings:get'),
  updateSettings: (patch: Record<string, unknown>) =>
    invoke('settings:update', patch),
  exportBackup: () => invoke('backup:export'),
  importBackup: () => invoke('backup:import'),
  createIncrementalBackup: () => invoke('backup:createIncremental'),
  onUpdateStatus: (listener: (status: UpdateStatus) => void) => {
    const wrappedListener = (_event: IpcRendererEvent, status: UpdateStatus) => {
      listener(status);
    };

    ipcRenderer.on(UPDATE_STATUS_CHANNEL, wrappedListener);
    void invoke<UpdateStatus | null>(GET_UPDATE_STATUS_CHANNEL).then((status) => {
      if (status) {
        listener(status);
      }
    });

    return () => {
      ipcRenderer.removeListener(UPDATE_STATUS_CHANNEL, wrappedListener);
    };
  },
  quitAndInstallUpdate: () => invoke('app:quitAndInstallUpdate'),
});
