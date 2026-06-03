import { createClient } from '@supabase/supabase-js';

  const SUPABASE_URL: string = (import.meta as any).env?.VITE_SUPABASE_URL || '';
  const SUPABASE_ANON_KEY: string = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';
  const SUPABASE_SERVICE_ROLE_KEY: string = (import.meta as any).env?.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

  // Auth client — anon key, manages user sessions and JWT tokens for signIn/signOut.
  export const supabaseAuth = SUPABASE_URL && (SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY)
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: true, storageKey: 'autoviral-session' },
      })
    : null;

  // Data client — service role key gives full DB access (personal automation tool; single owner).
  export const supabase = SUPABASE_URL && (SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY)
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

  export const HAS_SUPABASE = Boolean(supabase);
  