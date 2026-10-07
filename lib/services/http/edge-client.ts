import { createClient } from '../../supabase/client';
import { AuthRequiredError, EdgeError, EdgeTimeoutError, RateLimitError, UnavailableError } from './errors';
import { edgeErrorBus } from './event-bus';
import { capture, captureException, normalizeErrorCode } from '../../observability';

export interface InvokeOptions { body?: unknown; timeoutMs?: number; maxRetries?: number; signal?: AbortSignal; noRetryOnUnavailable?: boolean; idempotencyKey?: string; isIdempotent?: boolean; isReadOnly?: boolean; requestId?: string; }
const statusOf = (e: unknown) => Number((e as { context?: { status?: number } })?.context?.status ?? (e as { status?: number })?.status ?? 0);
const retryAfterOf = (e: unknown) => Number((e as { context?: { headers?: { get?: (n: string) => string | null } } })?.context?.headers?.get?.('retry-after') ?? 0);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function invokeEdge<T>(fnName: string, opts: InvokeOptions = {}): Promise<T> {
  const { body, timeoutMs = 30_000, maxRetries = 2, signal, noRetryOnUnavailable = false, idempotencyKey, isIdempotent = false, isReadOnly = false, requestId = crypto.randomUUID() } = opts;
  const allowedRetries = isReadOnly || (idempotencyKey && isIdempotent) ? maxRetries : 0;
  const { data: session } = await createClient().auth.getSession();
  if (!session.session) { const error = new AuthRequiredError(fnName); edgeErrorBus.emit(error); throw error; }
  let attempt = 0;
  const startedAt = performance.now();
  while (true) {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
    const abort = () => controller.abort(); signal?.addEventListener('abort', abort);
    capture('api_request_started', { function_name: fnName, request_id: requestId, attempt: attempt + 1, read_only: isReadOnly });
    try {
      const request = createClient().functions.invoke<T>(fnName, { body: body as Record<string, unknown>, signal: controller.signal, headers: { 'x-request-id': requestId, ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}) } });
      const result = await Promise.race([request, new Promise<never>((_, reject) => setTimeout(() => reject(new EdgeTimeoutError(fnName, timeoutMs)), timeoutMs))]);
      if (result.error) { const status = statusOf(result.error); const payload = (result.error as { context?: { body?: unknown } }).context?.body; const details = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}; const serverMessage = typeof details.error === 'string' ? details.error : typeof details.message === 'string' ? details.message : result.error.message; const requestIdFromServer = typeof details.request_id === 'string' ? ` (request_id: ${details.request_id})` : ''; if (status === 429) throw new RateLimitError(fnName, retryAfterOf(result.error) || 30, payload); if (status === 401 || status === 403) throw new AuthRequiredError(fnName); if (status === 503 && noRetryOnUnavailable) throw new UnavailableError(fnName, `Serviço indisponível${requestIdFromServer}`, payload); throw new EdgeError(fnName, status, `${serverMessage}${requestIdFromServer}`, payload); }
      capture('api_request_completed', { function_name: fnName, request_id: requestId, status: 'success', duration_ms: Math.round(performance.now() - startedAt), attempts: attempt + 1 });
      return result.data as T;
    } catch (error) {
      const typed = error instanceof EdgeTimeoutError || (error instanceof Error && error.name === 'AbortError') ? new EdgeTimeoutError(fnName, timeoutMs) : error instanceof EdgeError ? error : new EdgeError(fnName, statusOf(error), error instanceof Error ? error.message : 'Falha desconhecida');
      const retryable = !(typed instanceof RateLimitError || typed instanceof AuthRequiredError || (typed instanceof UnavailableError && noRetryOnUnavailable));
      if (!retryable || attempt >= allowedRetries) {
        capture('api_request_completed', { function_name: fnName, request_id: requestId, status: typed instanceof EdgeTimeoutError ? 'timeout' : 'error', duration_ms: Math.round(performance.now() - startedAt), attempts: attempt + 1, error_code: normalizeErrorCode(typed) });
        captureException(typed, { tags: { area: 'edge-client', edge_function: fnName }, extra: { request_id: requestId, attempt: attempt + 1, status: statusOf(typed) } });
        edgeErrorBus.emit(typed); throw typed;
      }
      attempt += 1;
      await sleep(2 ** attempt * 300);
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  }
}
