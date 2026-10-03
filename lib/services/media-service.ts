import { createClient, type Inserts, type Tables } from '../supabase/client';
import { enqueueMutation } from '../db/outbox-queue';
export type CardMedia = Tables<'card_media'>;
const BUCKET = 'card-media'; const URL_TTL = 30 * 60;
async function sha256(file: File) { const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer()); return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(''); }
export async function uploadCardMedia(file: File, userId: string, cardId: string) {
  if (!file.size) throw new Error('MEDIA_EMPTY');
  const assetId = crypto.randomUUID(); const hash = await sha256(file); const extension = file.name.split('.').pop()?.toLowerCase() || 'bin'; const path = `${userId}/${cardId}/${assetId}.${extension}`;
  const { error } = await createClient().storage.from(BUCKET).upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
  if (error) throw error;
  const payload = { id: assetId, card_id: cardId, user_id: userId, storage_bucket: BUCKET, storage_path: path, mime_type: file.type || null, file_size_bytes: file.size, sha256_hash: hash, media_type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : file.type.startsWith('video/') ? 'video' : 'other', metadata: {} } as unknown as Inserts<'card_media'>;
  await enqueueMutation('card_media', 'insert', payload as Record<string, unknown>);
  return payload;
}
export async function createSignedMediaUrl(storagePath: string) { const { data, error } = await createClient().storage.from(BUCKET).createSignedUrl(storagePath, URL_TTL); if (error) throw error; return data.signedUrl; }
