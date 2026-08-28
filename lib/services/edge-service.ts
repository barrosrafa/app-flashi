import { createClient } from '../supabase/client';

export type UserEdgeFunction =
  | 'embeddings'
  | 'semantic-search'
  | 'ai-ingest'
  | 'fsrs-optimize'
  | 'anki-transfer'
  | 'fsrs-review';

export type EdgeError = Error & {
  status?: number;
  code?: string;
  requestId?: string;
};

export async function invokeUserFunction<T>(
  functionName: UserEdgeFunction,
  body: Record<string, unknown>,
): Promise<T> {
  const requestId = body.request_id ?? crypto.randomUUID();
  const { data, error } = await createClient().functions.invoke(functionName, {
    body: { ...body, request_id: requestId },
  });

  if (!error) return data as T;

  const edgeError = new Error(error.message) as EdgeError;
  edgeError.status = error.context?.status;
  edgeError.requestId = String(requestId);
  throw edgeError;
}
