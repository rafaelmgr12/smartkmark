import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('desktopApi', {
  openMarkdownFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveMarkdownFile: (payload: { filePath?: string; content: string }) =>
    ipcRenderer.invoke('dialog:saveFile', payload)
});
