import tailwindcss from '@tailwindcss/vite';
  import react from '@vitejs/plugin-react';
  import path from 'path';
  import { defineConfig, loadEnv } from 'vite';

  export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    // In CI the secrets arrive via process.env, not .env files.
    // Merge them so define() always gets the real values.
    const get = (...keys: string[]) => {
      for (const k of keys) {
        const val = env[k] || process.env[k];
        if (val) return val;
      }
      return '';
    };
    return {
      base: '/',
      plugins: [react(), tailwindcss()],
      define: {
        'process.env.GEMINI_API_KEY': JSON.stringify(get('GEMINI_API_KEY')),
        'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(get('VITE_SUPABASE_URL', 'SUPABASE_URL')),
        'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(get('VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY')),
        'import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY': JSON.stringify(get('VITE_SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY')),
        'import.meta.env.VITE_APP_URL': JSON.stringify(get('VITE_APP_URL', 'APP_URL')),
      },
      resolve: { alias: { '@': path.resolve(__dirname, '.') } },
      server: { hmr: process.env.DISABLE_HMR !== 'true' },
    };
  });
  