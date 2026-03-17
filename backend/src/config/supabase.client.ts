import { createClient, SupabaseClient } from '@supabase/supabase-js';

export function getSupabase(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_KEY must be defined in environment variables');
  }

  return createClient(supabaseUrl, supabaseKey);
}
