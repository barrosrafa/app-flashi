import { invokeEdge } from './http/edge-client';
import { UnavailableError } from './http/errors';
export type SearchMode = 'semantic' | 'lexical';
export type SemanticHit = { deck_id: string; fields: unknown; match_type: string; note_id: string; similarity: number };
export type SearchResult = { user_id: string; mode: SearchMode; model?: string | null; dimensions?: number | null; query_hash?: string | null; results: SemanticHit[] };
export const semanticSearchService = { async query(query: string, opts: { deckId?: string; limit?: number; mode?: SearchMode } = {}) { const clean = query.trim(); if (clean.length < 3) throw new Error('QUERY_TOO_SHORT'); const requested = opts.mode ?? 'semantic'; try { return await invokeEdge<SearchResult>('semantic-search', { body: { query: clean, deck_id: opts.deckId, limit: Math.min(100, Math.max(1, opts.limit ?? 20)), mode: requested }, noRetryOnUnavailable: true }); } catch (error) { if (error instanceof UnavailableError && requested === 'semantic') return invokeEdge<SearchResult>('semantic-search', { body: { query: clean, deck_id: opts.deckId, limit: Math.min(100, Math.max(1, opts.limit ?? 20)), mode: 'lexical' } }); throw error; } } };
