import { createBrowserClient } from '@supabase/ssr';
import type { Database, Json } from '../../src/types/database';
import { createObservedFetch } from '../observability/network';

// A publishable key is intentionally safe to expose in the browser. Keep the
// project fallback aligned with the Supabase project used by this deployment;
// Vercel environment variables still take precedence when present at build time.
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  'https://fchpvgfjjxjpxfmtsrnc.supabase.co';
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  'sb_publishable_9vAONKEWtP837G7n7G-GTg_AvL7X5i6';

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl.trim() && supabasePublishableKey.trim());
}

export function createClient() {
  return createBrowserClient<Database>(supabaseUrl, supabasePublishableKey, {
    global: { fetch: createObservedFetch(fetch) },
  });
}

export type Tables<TableName extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][TableName]['Row'];

export type Inserts<TableName extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][TableName]['Insert'];

export type Updates<TableName extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][TableName]['Update'];

export type { Database, Json };
