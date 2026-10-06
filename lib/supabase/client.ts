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

const EDGE_PATH = '/functions/v1/';

/**
 * Audit finding F01 — edge delivery.
 *
 * Edge Functions were being called cross-origin straight from the browser at
 * `https://<project>.supabase.co/functions/v1/<fn>`. Any function whose deployed
 * build does not echo `Access-Control-Allow-Origin` for the product origin makes
 * the browser drop the request before it is even sent, which surfaced as
 * "Failed to send a request to the Edge Function" in sync, review, import,
 * Anki, embeddings, AI ingestion, search and activation.
 *
 * The requests are now issued against the application's own origin
 * (`/functions/v1/<fn>`) and proxied server-side by the Next.js rewrite declared
 * in `next.config.ts`. Same-origin requests never trigger a CORS preflight, so
 * delivery no longer depends on per-function CORS configuration while the
 * `Authorization` and `apikey` headers keep Supabase authentication authoritative.
 */
export function withSameOriginEdgeProxy(baseFetch: typeof fetch): typeof fetch {
  const projectEdgePrefix = `${supabaseUrl}${EDGE_PATH}`;
  return (input, init) => {
    if (typeof window === 'undefined' || !window.location?.origin) return baseFetch(input, init);
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!raw.startsWith(projectEdgePrefix)) return baseFetch(input, init);
    const proxied = `${window.location.origin}${EDGE_PATH}${raw.slice(projectEdgePrefix.length)}`;
    return baseFetch(proxied, init);
  };
}

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl.trim() && supabasePublishableKey.trim());
}

export function createClient() {
  return createBrowserClient<Database>(supabaseUrl, supabasePublishableKey, {
    global: { fetch: withSameOriginEdgeProxy(createObservedFetch(fetch)) },
  });
}

export type Tables<TableName extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][TableName]['Row'];

export type Inserts<TableName extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][TableName]['Insert'];

export type Updates<TableName extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][TableName]['Update'];

export type { Database, Json };