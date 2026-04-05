/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly APP_CSP: string;
  readonly APP_CSP_NONCE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
