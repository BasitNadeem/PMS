/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origin of the Innflo API, no trailing slash. See lib/leads.ts. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
