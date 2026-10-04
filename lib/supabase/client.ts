import { createBrowserClient } from '@supabase/ssr';
import type { Database, Json } from '../../src/types/database';
import { createObservedFetch } from '../observability/network';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  'https://fchpvgfjjxjpxfmtsrnc.supabase.co';
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim());
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
