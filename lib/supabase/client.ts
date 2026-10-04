import { createBrowserClient } from '@supabase/ssr';
import type { Database, Json } from '../../src/types/database';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  'https://fchpvgfjjxjpxfmtsrnc.supabase.co';
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

export function createClient() {
  return createBrowserClient<Database>(supabaseUrl, supabasePublishableKey);
}

export type Tables<TableName extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][TableName]['Row'];

export type Inserts<TableName extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][TableName]['Insert'];

export type Updates<TableName extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][TableName]['Update'];

export type { Database, Json };
