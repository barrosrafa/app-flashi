import { createClient, type Tables, type Json } from '../supabase/client';
export type CardMedia = Tables<'card_media'>;
const BUCKET = 'card-media';
const TTL = 30 * 60;
function mediaType(file: File): CardMedia['media_type'] { if (file.type.startsWith('image/')) return 'image'; if (file.type.startsWith('audio/')) return 'audio'; if (file.type.startsWith('video/')) return 'video'; return 'other'; }
async function requireUser() { const { data: { user } } = await createClient().auth.getUser(); if (!user) throw new Error('AUTH_REQUIRED'); return user; }
export const mediaService = {
  async listForCard(cardId: string): Promise<CardMedia[]> { const { data, error } = await createClient().from('card_media').select('*').eq('card_id', cardId).order('created_at', { ascending: false }); if (error) throw error; return data ?? []; },
  async listForDeck(deckId: string): Promise<CardMedia[]> { const { data, error } = await createClient().from('card_media').select('*,cards!inner(deck_id)').eq('cards.deck_id', deckId).order('created_at', { ascending: false }); if (error) throw error; return (data ?? []) as CardMedia[]; },
  async upload(file: File, _userId?: string, cardId?: string, fieldName?: string) {
    if (!file.size) throw new Error('MEDIA_EMPTY');
    const user = await requireUser();
    const assetId = crypto.randomUUID();
    const extension = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
    const path = `${user.id}/${cardId ?? 'unattached'}/${assetId}.${extension}`;
    const supabase = createClient();
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
    if (uploadError) throw uploadError;
    if (!cardId) return { id: assetId, storage_key: path, mime: file.type, size: file.size };
    const { data, error } = await supabase.from('card_media').insert({ id: assetId, card_id: cardId, user_id: user.id, field_name: fieldName ?? null, media_type: mediaType(file), storage_path: path, storage_bucket: BUCKET, file_size_bytes: file.size, mime_type: file.type || null, metadata: { original_name: file.name } as Json }).select('*').single();
    if (error) { await supabase.storage.from(BUCKET).remove([path]); throw error; }
    return data;
  },
  async update(id: string, patch: { cardId?: string; fieldName?: string | null; metadata?: Json }): Promise<CardMedia> { const { data, error } = await createClient().from('card_media').update({ ...(patch.cardId ? { card_id: patch.cardId } : {}), ...(patch.fieldName !== undefined ? { field_name: patch.fieldName } : {}), ...(patch.metadata !== undefined ? { metadata: patch.metadata } : {}) }).eq('id', id).select('*').single(); if (error) throw error; return data; },
  async remove(id: string): Promise<void> { const supabase = createClient(); const { data, error } = await supabase.from('card_media').select('storage_bucket,storage_path').eq('id', id).single(); if (error) throw error; const { error: storageError } = await supabase.storage.from(data.storage_bucket || BUCKET).remove([data.storage_path]); if (storageError) throw storageError; const { error: deleteError } = await supabase.from('card_media').delete().eq('id', id); if (deleteError) throw deleteError; },
  async signMany(paths: string[]) { const supabase = createClient(); return Promise.all(paths.map(async (path) => { const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, TTL); if (error) throw error; return { id: path, url: data.signedUrl, mime: '' }; })); },
  async signedUrl(path: string) { const result = await this.signMany([path]); return result[0]?.url; },
  async listOrphans() { const { data, error } = await createClient().rpc('list_orphaned_card_media', { p_limit: 100 }); if (error) throw error; return data ?? []; },
};
export async function uploadCardMedia(file: File, userId: string, cardId: string, fieldName?: string) { return mediaService.upload(file, userId, cardId, fieldName); }
export async function createSignedMediaUrl(path: string) { return mediaService.signedUrl(path); }
