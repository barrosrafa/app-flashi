import type { Json } from '../../src/types/database';
import { invokeUserFunction, type EdgeError } from './edge-service';
import { edgeErrorBus } from './http/event-bus';

export type SearchMode = 'semantic' | 'lexical';
export type SearchResult = {
  deck_id: string;
  fields: Json;
  match_type: string;
  note_id: string;
  similarity: number;
};

export type SearchResponse = {
  user_id: string;
  mode: SearchMode;
  model?: string;
  dimensions?: number;
  query_hash?: string;
  results: SearchResult[];
};

function canFallbackToLexical(reason: unknown) {
  const error = reason as EdgeError;
  return error.status === 503 || error.message.includes('503') || error.message.includes('PROVIDER_UNAVAILABLE');
}

export async function searchNotes(
  query: string,
  mode: SearchMode = 'semantic',
  limit = 20,
): Promise<SearchResponse> {
  const cleanQuery = query.trim();
  if (!cleanQuery) throw new Error('QUERY_REQUIRED');
  if (cleanQuery.length > 8000) throw new Error('QUERY_TOO_LONG');

  try {
    return await invokeUserFunction<SearchResponse>('semantic-search', {
      query: cleanQuery,
      limit: Math.max(1, Math.min(limit, 100)),
      mode,
    });
  } catch (reason) {
    if (mode === 'semantic' && canFallbackToLexical(reason)) {
      const fallback = await invokeUserFunction<SearchResponse>('semantic-search', {
        query: cleanQuery,
        limit: Math.max(1, Math.min(limit, 100)),
        mode: 'lexical',
      });
      edgeErrorBus.clear();
      return fallback;
    }
    throw reason;
  }
}
