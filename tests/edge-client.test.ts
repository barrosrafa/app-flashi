import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EdgeTimeoutError, RateLimitError } from '../lib/services/http/errors';

const invoke = vi.fn();
vi.mock('../lib/supabase/client', () => ({ createClient: () => ({ functions: { invoke } }) }));

const { invokeEdge } = await import('../lib/services/http/edge-client');

describe('invokeEdge', () => {
  beforeEach(() => { invoke.mockReset(); });
  it('retorna dados quando a Edge Function responde', async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null });
    await expect(invokeEdge('semantic-search', { body: { query: 'x' } })).resolves.toEqual({ ok: true });
  });
  it('não retenta 429 e expõe retryAfter', async () => {
    const error = Object.assign(new Error('too many'), { context: { status: 429, headers: { get: () => '7' } } });
    invoke.mockResolvedValue({ data: null, error });
    await expect(invokeEdge('semantic-search')).rejects.toMatchObject({ retryAfterSec: 7 });
    expect(invoke).toHaveBeenCalledTimes(1);
  });
  it('retenta falhas 5xx e depois propaga o erro', async () => {
    const error = Object.assign(new Error('server'), { context: { status: 503 } });
    invoke.mockRejectedValue(error);
    await expect(invokeEdge('ai-ingest', { maxRetries: 1 })).rejects.toMatchObject({ status: 503 });
    expect(invoke).toHaveBeenCalledTimes(2);
  });
  it('converte timeout em erro tipado', async () => {
    invoke.mockReturnValue(new Promise(() => undefined));
    await expect(invokeEdge('fsrs-optimize', { timeoutMs: 5, maxRetries: 0 })).rejects.toBeInstanceOf(EdgeTimeoutError);
  });
});
