import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';

const isDev = !app.isPackaged;

async function createWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (isDev) {
    await window.loadURL('http://localhost:5173');
    window.webContents.openDevTools({ mode: 'detach' });
  } else {
    await window.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(async () => {
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('dialog:openFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Abrir arquivo Markdown',
    properties: ['openFile'],
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }]
  });

  if (canceled || filePaths.length === 0) {
    return { canceled: true };
  }

  const filePath = filePaths[0];
  const content = await fs.readFile(filePath, 'utf-8');

  return { canceled: false, filePath, content };
});

ipcMain.handle(
  'dialog:saveFile',
  async (_, payload: { filePath?: string; content: string }) => {
    let targetPath = payload.filePath;

    if (!targetPath) {
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Salvar arquivo Markdown',
        defaultPath: 'novo-arquivo.md',
        filters: [{ name: 'Markdown', extensions: ['md'] }]
      });

      if (canceled || !filePath) {
        return { canceled: true };
      }

      targetPath = filePath;
    }

    await fs.writeFile(targetPath, payload.content, 'utf-8');

    return { canceled: false, filePath: targetPath };
  }
);
