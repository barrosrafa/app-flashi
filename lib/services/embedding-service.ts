import { invokeUserFunction } from './edge-service';

export type EmbeddingResponse = {
  note_id: string;
  model: string;
  dimensions: number;
  content_hash: string;
  skipped: boolean;
};

export async function refreshNoteEmbedding(noteId: string) {
  if (!noteId) throw new Error('NOTE_ID_REQUIRED');
  return invokeUserFunction<EmbeddingResponse>('embeddings', { note_id: noteId });
}
