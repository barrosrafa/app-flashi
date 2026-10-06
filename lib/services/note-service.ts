import { createClient, type Tables, type Json, type Updates } from '../supabase/client';

export type Note = Tables<'notes'>;
export type NoteClozeDeletion = Tables<'note_cloze_deletions'>;
export type NoteFields = Record<string, unknown>;
export type NoteInput = { deckId: string; fields: NoteFields; templateId?: string | null; source?: string | null; sourceFormat?: string };
function cleanFields(fields: NoteFields): NoteFields { return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key.trim(), value ?? '']).filter(([key]) => key)); }
async function userId() { const { data, error } = await createClient().auth.getUser(); if (error || !data.user) throw new Error('AUTH_REQUIRED'); return data.user.id; }

export const noteService = {
  async list(deckId: string, limit = 100): Promise<Note[]> { const { data, error } = await createClient().from('notes').select('*').eq('deck_id', deckId).is('deleted_at', null).order('updated_at', { ascending: false }).limit(limit); if (error) throw error; return data ?? []; },
  async get(id: string): Promise<Note | null> { const { data, error } = await createClient().from('notes').select('*').eq('id', id).maybeSingle(); if (error) throw error; return data; },
  async create(input: NoteInput): Promise<Note> {
    const fields = cleanFields(input.fields); if (!input.deckId || !Object.keys(fields).length) throw new Error('NOTE_FIELDS_REQUIRED');
    const { data, error } = await createClient().from('notes').insert({ user_id: await userId(), deck_id: input.deckId, fields: fields as Json, template_id: input.templateId ?? null, source: input.source ?? 'frontend', source_format: input.sourceFormat ?? 'native' }).select('*').single();
    if (error) throw error; return data;
  },
  async update(id: string, input: Partial<Pick<NoteInput, 'fields' | 'templateId' | 'source' | 'sourceFormat'>>): Promise<Note> {
    const supabase = createClient();
    const current = await this.get(id); if (!current) throw new Error('NOTE_NOT_FOUND');
    const patch: Updates<'notes'> = {};
    if (input.fields) { const fields = cleanFields(input.fields); if (!Object.keys(fields).length) throw new Error('NOTE_FIELDS_REQUIRED'); patch.fields = fields as Json; }
    if (input.templateId !== undefined) patch.template_id = input.templateId;
    if (input.source !== undefined) patch.source = input.source;
    if (input.sourceFormat !== undefined) patch.source_format = input.sourceFormat;
    if (patch.fields) {
      const { data: cards, error: cardError } = await supabase.from('cards').select('id,fields').eq('note_id', id).is('deleted_at', null);
      if (cardError) throw cardError;
      const cardPayload = (cards ?? []).map((card) => ({ id: card.id, fields: patch.fields }));
      const { error } = await (supabase as any).rpc('update_note_and_cards', { p_note_id: id, p_note_fields: patch.fields, p_cards: cardPayload });
      if (error) throw error;
      delete patch.fields;
    }
    const { data, error } = await supabase.from('notes').update(patch).eq('id', id).select('*').single();
    if (error) throw error; return data;
  },
  async remove(id: string): Promise<void> { const { error } = await createClient().from('notes').update({ deleted_at: new Date().toISOString() }).eq('id', id); if (error) throw error; },
  async listCloze(noteId: string): Promise<NoteClozeDeletion[]> { const { data, error } = await createClient().from('note_cloze_deletions').select('*').eq('note_id', noteId).order('cloze_ordinal'); if (error) throw error; return data ?? []; },
  async saveCloze(input: { noteId: string; fieldName: string; clozeOrdinal: number; hint?: string; startOffset?: number; endOffset?: number }): Promise<NoteClozeDeletion> { const { data, error } = await createClient().from('note_cloze_deletions').upsert({ note_id: input.noteId, field_name: input.fieldName.trim(), cloze_ordinal: input.clozeOrdinal, hint: input.hint?.trim() || null, start_offset: input.startOffset ?? null, end_offset: input.endOffset ?? null }, { onConflict: 'note_id,field_name,cloze_ordinal' }).select('*').single(); if (error) throw error; return data; },
  async removeCloze(id: string): Promise<void> { const { error } = await createClient().from('note_cloze_deletions').delete().eq('id', id); if (error) throw error; },
};
export async function listNotes(deckId: string) { return noteService.list(deckId); }
export async function createNote(input: NoteInput) { return noteService.create(input); }
export async function updateNote(id: string, fields: NoteFields) { return noteService.update(id, { fields }); }
export async function deleteNote(id: string) { return noteService.remove(id); }
