import { invokeEdge } from './http/edge-client';

export type ActivationPayload = {
  goal?: string | null;
  target_date?: string | null;
  weekly_minutes?: number | null;
};

export type ActivationResult = {
  status: 'ACTIVE' | 'PENDING' | 'VALIDATING' | 'FAILED' | 'SUSPENDED';
  request_id?: string | null;
  processed_at?: string;
};

export async function processActivation(payload: ActivationPayload, idempotencyKey = crypto.randomUUID()): Promise<ActivationResult> {
  return invokeEdge<ActivationResult>('activation', {
    body: payload,
    idempotencyKey,
    maxRetries: 2,
    isIdempotent: true,
    timeoutMs: 30_000,
  });
}
