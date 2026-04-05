import { BrowserWindow, shell } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function parseUrl(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

function isSafeExternalUrl(rawUrl: string, isDev: boolean): boolean {
  const url = parseUrl(rawUrl);

  if (!url) {
    return false;
  }

  if (url.protocol === 'https:' || url.protocol === 'mailto:') {
    return true;
  }

  return isDev && url.protocol === 'http:' && url.hostname === 'localhost';
}

function isAllowedAppUrl(rawUrl: string, appUrl: URL, isDev: boolean): boolean {
  const url = parseUrl(rawUrl);

  if (!url) {
    return false;
  }

  if (isDev) {
    return url.origin === appUrl.origin;
  }

  return url.protocol === 'file:' && url.pathname === appUrl.pathname;
}

function openExternalIfSafe(url: string, isDev: boolean) {
  if (isSafeExternalUrl(url, isDev)) {
    void shell.openExternal(url);
  }
}

export function getAppEntryUrl(isDev: boolean): URL {
  return isDev
    ? new URL('http://localhost:5173')
    : pathToFileURL(path.join(__dirname, '../dist/index.html'));
}

export function configureWindowNavigation(
  mainWindow: BrowserWindow,
  appUrl: URL,
  isDev: boolean
) {
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isAllowedAppUrl(url, appUrl, isDev)) {
      return;
    }

    event.preventDefault();
    openExternalIfSafe(url, isDev);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalIfSafe(url, isDev);
    return { action: 'deny' };
  });
}
