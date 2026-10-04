import { createBrowserClient } from '@supabase/ssr';
import type { Database, Json } from '../../src/types/database';

function requiredPublicEnv(name: string, value: string | undefined): string {
  const normalized = value?.trim();
  if (!normalized || normalized.includes('replace_me')) {
    throw new Error(`MISSING_PUBLIC_SUPABASE_CONFIG:${name}`);
  }
  return normalized;
}

export function createClient() {
  // Keep references static so Next.js replaces NEXT_PUBLIC_* at build time.
  const url = requiredPublicEnv('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = requiredPublicEnv(
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  return createBrowserClient<Database>(url, key);
}

export type Tables<TableName extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][TableName]['Row'];

export type Inserts<TableName extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][TableName]['Insert'];

export type Updates<TableName extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][TableName]['Update'];

export type { Database, Json };
