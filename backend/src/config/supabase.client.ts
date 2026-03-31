import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dns from 'node:dns';

export function getSupabase(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY) must be defined in environment variables',
    );
  }

  try {
    return createClient(supabaseUrl, supabaseKey);
  } catch (err) {
    throw new Error(`Failed to create Supabase client: ${(err as Error).message}`);
  }
}

/**
 * Validate Supabase host DNS resolution before attempting network requests.
 * Call this during application bootstrap (e.g. in main.ts) to fail fast with
 * a clearer error message when DNS or network is misconfigured.
 */
export async function validateSupabaseConnection(options?: { retries?: number; delayMs?: number }) {
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL is not defined');
  }

  const retries = options?.retries ?? 3;
  const delayMs = options?.delayMs ?? 500;

  let lastErr: Error | null = null;
  let hostname: string;
  try {
    hostname = new URL(supabaseUrl).hostname;
  } catch (e) {
    throw new Error(`SUPABASE_URL is not a valid URL: ${supabaseUrl}`);
  }

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      await dns.promises.lookup(hostname);
      return true;
    } catch (err) {
      lastErr = err as Error;
      const wait = delayMs * Math.pow(2, attempt);
      // eslint-disable-next-line no-console
      console.warn(`Supabase DNS lookup failed for ${hostname} (attempt ${attempt + 1}/${retries}): ${(err as Error).message}. Retrying in ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }

  throw new Error(
    `Unable to resolve Supabase host ${hostname}. Last error: ${lastErr?.message}. Please check SUPABASE_URL, network/DNS, and proxy settings.`,
  );
}
