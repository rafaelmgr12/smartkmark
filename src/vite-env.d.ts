/// <reference types="vite/client" />

interface DesktopApi {
  openMarkdownFile: () => Promise<
    | { canceled: true }
    | { canceled: false; filePath: string; content: string }
  >;
  saveMarkdownFile: (payload: {
    filePath?: string;
    content: string;
  }) => Promise<{ canceled: true } | { canceled: false; filePath: string }>;
}

declare global {
  interface Window {
    desktopApi: DesktopApi;
  }
}

export {};
