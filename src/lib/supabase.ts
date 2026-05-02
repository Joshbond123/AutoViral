import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL: string =
  (import.meta as any).env?.VITE_SUPABASE_URL || '';

const SUPABASE_ANON_KEY: string =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

export const HAS_SUPABASE = Boolean(supabase);
