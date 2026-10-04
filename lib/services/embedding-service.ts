import { invokeEdge } from './http/edge-client';
export type EmbeddingResponse = { note_id: string; model: string; dimensions: number; content_hash: string; skipped: boolean };
export const embeddingService = {
  indexNote(noteId: string) {
    if (!noteId) throw new Error('NOTE_ID_REQUIRED');
    return invokeEdge<EmbeddingResponse>('embeddings', { body: { note_id: noteId } });
  },
};
export async function refreshNoteEmbedding(noteId: string) { return embeddingService.indexNote(noteId); }
