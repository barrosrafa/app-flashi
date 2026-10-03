import { createClient } from '../../supabase/client';
import { AuthRequiredError, EdgeError, EdgeTimeoutError, RateLimitError, UnavailableError } from './errors';
import { edgeErrorBus } from './event-bus';
export interface InvokeOptions { body?: unknown; timeoutMs?: number; maxRetries?: number; signal?: AbortSignal; noRetryOnUnavailable?: boolean; }
const statusOf = (e: unknown) => Number((e as { context?: { status?: number } })?.context?.status ?? (e as { status?: number })?.status ?? 0);
const retryAfterOf = (e: unknown) => Number((e as { context?: { headers?: { get?: (n: string) => string | null } } })?.context?.headers?.get?.('retry-after') ?? 0);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
export async function invokeEdge<T>(fnName: string, opts: InvokeOptions = {}): Promise<T> {
  const { body, timeoutMs = 30_000, maxRetries = 2, signal, noRetryOnUnavailable = false } = opts;
  const { data: session } = await createClient().auth.getSession();
  if (!session.session) { const error = new AuthRequiredError(fnName); edgeErrorBus.emit(error); throw error; }
  let attempt = 0;
  while (true) {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
    const abort = () => controller.abort(); signal?.addEventListener('abort', abort);
    try {
      const request = createClient().functions.invoke<T>(fnName, { body: body as Record<string, unknown>, signal: controller.signal }); const result = await Promise.race([request, new Promise<never>((_, reject) => setTimeout(() => reject(new EdgeTimeoutError(fnName, timeoutMs)), timeoutMs))]);
      if (result.error) { const status = statusOf(result.error); const payload = (result.error as { context?: { body?: unknown } }).context?.body; if (status === 429) throw new RateLimitError(fnName, retryAfterOf(result.error) || 30, payload); if (status === 401 || status === 403) throw new AuthRequiredError(fnName); if (status === 503 && noRetryOnUnavailable) throw new UnavailableError(fnName, 'Serviço indisponível', payload); throw new EdgeError(fnName, status, result.error.message, payload); }
      return result.data as T;
    } catch (error) {
      const typed = error instanceof EdgeTimeoutError || (error instanceof Error && error.name === 'AbortError') ? new EdgeTimeoutError(fnName, timeoutMs) : error instanceof EdgeError ? error : new EdgeError(fnName, statusOf(error), error instanceof Error ? error.message : 'Falha desconhecida');
      if (typed instanceof RateLimitError || typed instanceof AuthRequiredError || (typed instanceof UnavailableError && noRetryOnUnavailable)) { edgeErrorBus.emit(typed); throw typed; }
      attempt += 1; if (attempt > maxRetries) { edgeErrorBus.emit(typed); throw typed; }
      await sleep(2 ** attempt * 300);
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  }
}
