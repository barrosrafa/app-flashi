import { normalizeTemplate,renderCard,renderDefaultCard } from './template-renderer';
import { pageLimit, pageResult, type PageOptions } from './pagination';
import { createClient, type Tables, type Json, type Updates } from '../supabase/client';
import { deriveNoteCardFields } from './note-card-fields';

export type Note = Tables<'notes'>;
export type NoteClozeDeletion = Tables<'note_cloze_deletions'>;
export type NoteFields = Record<string, unknown>;
export type NoteSourceFormat = 'native' | 'anki_apkg' | 'mcp' | 'api';
export type NoteInput = { deckId: string; fields: NoteFields; templateId?: string | null; source?: string | null; sourceFormat?: NoteSourceFormat };
function cleanFields(fields: NoteFields): NoteFields { return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key.trim(), value]).filter(([key]) => key)); }
async function userId() { const { data, error } = await createClient().auth.getUser(); if (error || !data.user) throw new Error('AUTH_REQUIRED'); return data.user.id; }

const pendingNoteKeys=new Map<string,string>();

export const noteService = {
  async list(deckId: string, limit = 100): Promise<Note[]> { const { data, error } = await createClient().from('notes').select('*').eq('deck_id', deckId).is('deleted_at', null).order('updated_at', { ascending: false }).limit(limit); if (error) throw error; return data ?? []; },
  async get(id: string): Promise<Note | null> { const { data, error } = await createClient().from('notes').select('*').eq('id', id).maybeSingle(); if (error) throw error; return data; },
  async create(input: NoteInput) {
    const user={id:await userId()}; const client=createClient(); const fields=cleanFields(input.fields);
    if(!input.deckId||!Object.keys(fields).length)throw new Error('NOTE_INPUT_REQUIRED');
    if(input.sourceFormat && !['native','anki_apkg','mcp','api'].includes(input.sourceFormat))throw new Error('NOTE_SOURCE_FORMAT_INVALID');
    let template:unknown=null;
    if(input.templateId) { const result=await client.from('card_templates').select('field_definitions,card_generation').eq('id',input.templateId).single(); if(result.error)throw result.error; template=result.data; }
    const normalized=normalizeTemplate(template);
    const generated=normalized?renderCard(normalized,fields as NoteFields):[renderDefaultCard(fields as NoteFields)];
    if(!generated.length||generated.some((card)=>!card.front.trim()&&!card.back.trim()))throw new Error('Preencha o conteúdo de pelo menos um campo do cartão.');
    const key=JSON.stringify([user.id,input.deckId,input.templateId,fields]);
    const mutationId=pendingNoteKeys.get(key)??crypto.randomUUID(); pendingNoteKeys.set(key,mutationId);
    const {data,error}=await (client as any).rpc('mcp_create_note',{
      p_deck_id:input.deckId,p_fields:fields,p_template_id:input.templateId??null,
      p_card_definitions:generated.map((card,index)=>({front:card.front,back:card.back,fields,card_ordinal:index,card_kind:index===1?'reverse':'basic'})),
      p_source:'native',p_external_id:mutationId,p_request_id:mutationId,
    });
    if(error)throw error;
    const id=Array.isArray(data)?data[0]?.note_id:data?.note_id;
    if(!id)throw new Error('NOTE_CREATION_NOT_CONFIRMED');
    const note=await this.get(id); if(!note)throw new Error('NOTE_CREATION_NOT_CONFIRMED');
    pendingNoteKeys.delete(key); return note;
  },
  async update(id: string, input: Partial<Pick<NoteInput, 'fields' | 'templateId' | 'source' | 'sourceFormat'>>): Promise<Note> {
    const supabase = createClient();
    const current = await this.get(id); if (!current) throw new Error('NOTE_NOT_FOUND');
    const patch: Updates<'notes'> = {};
    if (input.fields) { const fields = cleanFields(input.fields); if (!Object.keys(fields).length) throw new Error('NOTE_FIELDS_REQUIRED'); patch.fields = fields as Json; }
    if (input.templateId !== undefined) patch.template_id = input.templateId;
    if (input.source !== undefined) patch.source = input.source;
    if (input.sourceFormat !== undefined) patch.source_format = input.sourceFormat;
    if (patch.fields || input.templateId !== undefined) {
      const nextFields = (patch.fields ?? current.fields) as NoteFields;
      const templateId = input.templateId !== undefined ? input.templateId : current.template_id;
      const { data: cards, error: cardError } = await supabase.from('cards').select('id,fields,card_ordinal,template_id').eq('note_id', id).is('deleted_at', null);
      if (cardError) throw cardError;
      let template: unknown = null;
      if (templateId) {
        const result = await supabase.from('card_templates').select('field_definitions,card_generation').eq('id', templateId).single();
        if (result.error) throw result.error;
        template = result.data;
      }
      const cardPayload = (cards ?? []).map((card) => ({ id: card.id, fields: deriveNoteCardFields(current.fields as NoteFields, nextFields, card, template) }));
      const { error } = await (supabase as any).rpc('update_note_and_cards_v2', {
        p_note_id: id, p_note_fields: nextFields, p_cards: cardPayload,
        p_template_id: templateId, p_update_template: input.templateId !== undefined,
      });
      if (error) throw error;
      delete patch.fields; delete patch.template_id;
    }
    if (!Object.keys(patch).length) { const result = await this.get(id); if (!result) throw new Error('NOTE_NOT_FOUND'); return result; }
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

export async function listNotesPage(deckId: string, options: PageOptions = {}) {
  const limit = pageLimit(options.limit);
  const { data, error } = await (createClient() as any).rpc('list_deck_notes_page', {
    p_deck_id: deckId, p_query: options.query?.trim() ?? '', p_limit: limit + 1,
    p_cursor_time: options.cursor?.time ?? null, p_cursor_id: options.cursor?.id ?? null,
  });
  if (error) throw error;
  return pageResult((data ?? []) as Note[], limit, 'updated_at');
}
