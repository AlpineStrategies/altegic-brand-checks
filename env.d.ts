interface ImportMetaEnv {
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
  VITE_API_URL: string;
  // add other variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
} 