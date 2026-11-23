interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_SESSION_MINUTES?: string;
  readonly VITE_THERAPIST_NOTIFICATIONS_POLL_INTERVAL_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
