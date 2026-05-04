import { createClient } from '@supabase/supabase-js';

  const SUPABASE_URL: string =
    (import.meta as any).env?.VITE_SUPABASE_URL || '';

  // For this personal automation tool, prefer the service role key so that
  // all dashboard queries work regardless of RLS policy configuration.
  // Falls back to the anon key if the service role key is not present.
  const SUPABASE_KEY: string =
    (import.meta as any).env?.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

  export const supabase = SUPABASE_URL && SUPABASE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

  export const HAS_SUPABASE = Boolean(supabase);
  