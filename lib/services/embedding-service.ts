import { invokeEdge } from './http/edge-client';
export type EmbeddingResponse = { note_id: string; model: string; dimensions: number; content_hash: string; skipped: boolean };
export const embeddingService = { indexNote(noteId: string) { if (!noteId) throw new Error('NOTE_ID_REQUIRED'); return invokeEdge<EmbeddingResponse>('embeddings', { body: { note_id: noteId } }); }, indexDeck(deckId: string) { if (!deckId) throw new Error('DECK_REQUIRED'); return invokeEdge<{ queued: number }>('embeddings', { body: { deck_id: deckId }, timeoutMs: 60_000 }); } };
export async function refreshNoteEmbedding(noteId: string) { return embeddingService.indexNote(noteId); }
