import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const DEV_CSP_NONCE = '__SMARTKMARK_DEV_CSP_NONCE__';
const DEV_SERVER_HOST = 'localhost';
const DEV_SERVER_PORT = 5173;
const DEV_SERVER_HTTP_ORIGIN = `http://${DEV_SERVER_HOST}:${DEV_SERVER_PORT}`;
const DEV_SERVER_WS_ORIGIN = `ws://${DEV_SERVER_HOST}:${DEV_SERVER_PORT}`;

function getAppCsp(isDev: boolean): string {
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    isDev ? `script-src 'self' 'nonce-${DEV_CSP_NONCE}'` : "script-src 'self'",
    isDev
      ? `style-src 'self'; style-src-elem 'self' 'nonce-${DEV_CSP_NONCE}'; style-src-attr 'unsafe-inline'`
      : "style-src 'self'; style-src-elem 'self'; style-src-attr 'unsafe-inline'",
    isDev ? `connect-src 'self' ${DEV_SERVER_HTTP_ORIGIN} ${DEV_SERVER_WS_ORIGIN}` : "connect-src 'self'",
  ];

  return directives.join('; ');
}

export default defineConfig(({ command }) => {
  const isDev = command === 'serve';

  return {
    base: './',
    define: {
      'import.meta.env.APP_CSP': JSON.stringify(getAppCsp(isDev)),
    },
    plugins: [react()],
    html: isDev
      ? {
          cspNonce: DEV_CSP_NONCE,
        }
      : undefined,
    server: {
      port: DEV_SERVER_PORT,
      strictPort: true,
    },
    build: {
      assetsInlineLimit: 0,
      chunkSizeWarningLimit: 650,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return undefined;
            }

            if (
              id.includes('react-markdown') ||
              id.includes('remark-') ||
              id.includes('rehype-') ||
              id.includes('highlight.js') ||
              id.includes('katex') ||
              id.includes('github-slugger')
            ) {
              return 'markdown-vendor';
            }

            if (
              id.includes('@uiw/react-codemirror') ||
              id.includes('@codemirror') ||
              id.includes('@lezer/')
            ) {
              return 'editor-vendor';
            }

            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('scheduler')
            ) {
              return 'react-vendor';
            }

            return undefined;
          },
        },
      },
    },
  };
});
