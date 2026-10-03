import { invokeEdge } from './http/edge-client';
export type UserEdgeFunction = 'embeddings' | 'semantic-search' | 'ai-ingest' | 'fsrs-optimize' | 'anki-transfer' | 'fsrs-review';
export type EdgeError = Error & { status?: number; code?: string; requestId?: string };
export async function invokeUserFunction<T>(functionName: UserEdgeFunction, body: Record<string, unknown>): Promise<T> {
  const requestId = body.request_id ?? crypto.randomUUID();
  return invokeEdge<T>(functionName, { body: { ...body, request_id: requestId } });
}
