import { createClient } from '../supabase/client';
import type { NoteReference } from '../types/note-reference';
export const referenceService = {
  async listForNote(noteId: string): Promise<NoteReference[]> { const { data, error } = await createClient().from('note_references').select('*').eq('source_note_id', noteId); if (error) throw error; return (data ?? []) as NoteReference[]; },
  async create(sourceNoteId: string, targetNoteId: string) { if (sourceNoteId === targetNoteId) throw new Error('REFERENCE_SELF_NOT_ALLOWED'); const { error } = await createClient().from('note_references').insert({ source_note_id: sourceNoteId, target_note_id: targetNoteId }); if (error) throw error; },
  async remove(id: string) { const { error } = await createClient().from('note_references').delete().eq('id', id); if (error) throw error; },
};
