import { capture, normalizeErrorCode } from './events';
import { captureException } from './sentry';

type SupabaseCategory = 'auth' | 'data' | 'rpc' | 'storage' | 'realtime' | 'edge';

function classify(url: URL): { category: SupabaseCategory; operation: string } | null {
  const path = url.pathname;
  // Edge Functions are proxied through the application origin (see
  // lib/supabase/client.ts). Classify them before the host check so relative
  // proxied calls are still attributed to the edge category.
  if (path.startsWith('/functions/v1/')) return { category: 'edge', operation: path.replace('/functions/v1/', '').split('/')[0] || 'unknown' };
  const configured = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!configured) return null;
  let host = '';
  try { host = new URL(configured).host; } catch { return null; }
  if (url.host !== host) return null;
  if (path.startsWith('/auth/v1/')) return { category: 'auth', operation: path.replace('/auth/v1/', '').split('/')[0] || 'unknown' };
  if (path.startsWith('/rest/v1/rpc/')) return { category: 'rpc', operation: path.replace('/rest/v1/rpc/', '').split('/')[0] || 'unknown' };
  if (path.startsWith('/rest/v1/')) return { category: 'data', operation: path.replace('/rest/v1/', '').split('/')[0] || 'unknown' };
  if (path.startsWith('/storage/v1/')) return { category: 'storage', operation: path.replace('/storage/v1/', '').split('/')[0] || 'unknown' };
  if (path.startsWith('/realtime/')) return { category: 'realtime', operation: 'websocket' };
  if (path.startsWith('/functions/v1/')) return { category: 'edge', operation: path.replace('/functions/v1/', '').split('/')[0] || 'unknown' };
  return null;
}

export function createObservedFetch(baseFetch: typeof fetch): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof window === 'undefined') return baseFetch(input, init);
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.origin);
    const target = classify(url);
    if (!target || target.category === 'edge') return baseFetch(input, init);
    const startedAt = performance.now();
    const method = (init?.method ?? (typeof input !== 'string' && !(input instanceof URL) ? input.method : 'GET')).toUpperCase();
    try {
      const response = await baseFetch(input, init);
      capture('supabase_request_completed', { category: target.category, operation: target.operation, method, status: response.status, outcome: response.ok ? 'success' : 'error', duration_ms: Math.round(performance.now() - startedAt) });
      return response;
    } catch (error) {
      const typed = error instanceof Error ? error : new Error(String(error));
      capture('supabase_request_completed', { category: target.category, operation: target.operation, method, status: 0, outcome: 'network_error', duration_ms: Math.round(performance.now() - startedAt), error_code: normalizeErrorCode(typed) });
      captureException(typed, { tags: { area: 'supabase-network', supabase_category: target.category, supabase_operation: target.operation }, extra: { method, duration_ms: Math.round(performance.now() - startedAt) } });
      throw error;
    }
  };
}
