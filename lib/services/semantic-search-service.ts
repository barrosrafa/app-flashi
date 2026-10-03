import { searchNotes, type SearchResponse } from './search-service';
export type SemanticHit = SearchResponse['results'][number];
export const semanticSearchService = {
  query(query: string, options: { deckId?: string; limit?: number } = {}) {
    return searchNotes(query, 'semantic', options.limit ?? 20).then((response) => options.deckId ? { ...response, results: response.results.filter((hit) => hit.deck_id === options.deckId) } : response);
  },
  reindexNote(noteId: string) { return import('./embedding-service').then(({ refreshNoteEmbedding }) => refreshNoteEmbedding(noteId)); },
};
