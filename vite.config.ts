import tailwindcss from '@tailwindcss/vite';
  import react from '@vitejs/plugin-react';
  import path from 'path';
  import { defineConfig, loadEnv } from 'vite';

  export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: '/AutoViral/',
      plugins: [react(), tailwindcss()],
      define: {
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || env.SUPABASE_URL || ''),
        'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || ''),
        'import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY': JSON.stringify(env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || ''),
        'import.meta.env.VITE_TIKTOK_CLIENT_KEY': JSON.stringify(env.VITE_TIKTOK_CLIENT_KEY || env.TIKTOK_CLIENT_KEY || ''),
        'import.meta.env.VITE_APP_URL': JSON.stringify(env.VITE_APP_URL || env.APP_URL || ''),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        },
      },
      server: {
        hmr: process.env.DISABLE_HMR !== 'true',
      },
    };
  });
  