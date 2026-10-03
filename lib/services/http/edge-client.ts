import { createClient } from '../../supabase/client';
import { EdgeError, EdgeTimeoutError, RateLimitError } from './errors';
import { edgeErrorBus } from './event-bus';

type InvokeOptions = { body?: unknown; timeoutMs?: number; maxRetries?: number; signal?: AbortSignal };
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
function statusOf(error: unknown) { return Number((error as { context?: { status?: number } })?.context?.status ?? 0); }
function retryAfterOf(error: unknown) { return Number((error as { context?: { headers?: { get?: (name: string) => string | null } } })?.context?.headers?.get?.('retry-after') ?? 0); }

export async function invokeEdge<T>(fnName: string, { body, timeoutMs = 30_000, maxRetries = 2, signal }: InvokeOptions = {}): Promise<T> {
  let attempt = 0;
  while (true) {
    if (signal?.aborted) throw new EdgeError(fnName, 499, 'Operação cancelada');
    try {
      const request = createClient().functions.invoke<T>(fnName, { body: body as Record<string, unknown> });
      const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new EdgeTimeoutError(fnName, timeoutMs)), timeoutMs));
      const result = await Promise.race([request, timeout]);
      if (!result.error) return result.data as T;
      const status = statusOf(result.error);
      if (status === 429) throw new RateLimitError(fnName, retryAfterOf(result.error));
      throw new EdgeError(fnName, status, result.error.message);
    } catch (error) {
      if (error instanceof RateLimitError) { edgeErrorBus.emit({ error, fn: fnName }); throw error; }
      attempt += 1;
      const rawStatus = statusOf(error); const retryable = error instanceof EdgeTimeoutError || (rawStatus === 0 || rawStatus >= 500) || (error instanceof EdgeError && error.status >= 500);
      if (!retryable || attempt > maxRetries) {
        const typedStatus = statusOf(error); const typed = error instanceof EdgeError ? error : new EdgeError(fnName, typedStatus, error instanceof Error ? error.message : 'Falha desconhecida');
        edgeErrorBus.emit({ error: typed, fn: fnName }); throw typed;
      }
      await sleep(2 ** attempt * 300);
    }
  }
}
