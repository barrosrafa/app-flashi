import { createClient, type Tables, type Json } from '../supabase/client';

export type CardMedia = Tables<'card_media'>;
export type OcclusionAsset = Tables<'image_occlusion_assets'>;
export type MediaUploadContext = { noteId: string; deckId: string };
export const MEDIA_MAX_BYTES = 25 * 1024 * 1024;
export const MEDIA_ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/svg+xml',
  'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/mp4',
  'video/mp4', 'video/webm', 'video/quicktime',
] as const;
const OCCLUSION_IMAGE_MIME_TYPES = MEDIA_ALLOWED_MIME_TYPES.filter((mime) => mime.startsWith('image/'));
const BUCKET = 'card-media';
const TTL = 30 * 60;
const RENEW_BEFORE = 60;

export class MediaServiceError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId?: string;
  constructor(message: string, metadata: { code: string; status?: number; requestId?: string; cause?: unknown }) {
    super(message, { cause: metadata.cause });
    this.name = 'MediaServiceError';
    this.code = metadata.code;
    this.status = metadata.status ?? 0;
    this.requestId = metadata.requestId;
  }
}

function mediaType(file: File): CardMedia['media_type'] {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type.startsWith('video/')) return 'video';
  return 'other';
}

export function validateMediaFile(file: File, options: { imageOnly?: boolean } = {}) {
  if (!file.size) throw new MediaServiceError('O arquivo está vazio.', { code: 'MEDIA_EMPTY', status: 400 });
  if (file.size > MEDIA_MAX_BYTES) throw new MediaServiceError('O arquivo excede o limite de 25 MiB.', { code: 'MEDIA_SIZE_NOT_ALLOWED', status: 413 });
  const allowed = options.imageOnly ? OCCLUSION_IMAGE_MIME_TYPES : MEDIA_ALLOWED_MIME_TYPES;
  if (!file.type || !allowed.includes(file.type as never)) {
    throw new MediaServiceError(options.imageOnly ? 'A oclusão aceita somente imagens JPEG, PNG, GIF, WebP, AVIF ou SVG.' : 'O tipo MIME deste arquivo não é aceito.', { code: 'MEDIA_MIME_NOT_ALLOWED', status: 415 });
  }
  return file;
}

async function requireUser() {
  const { data: { user } } = await createClient().auth.getUser();
  if (!user) throw new MediaServiceError('Sua sessão expirou. Entre novamente.', { code: 'AUTH_REQUIRED', status: 401 });
  return user;
}

function storageExtension(file: File) {
  const fromMime = file.type.split('/')[1]?.replace(/[^a-z0-9]+/gi, '').toLowerCase();
  return fromMime || 'bin';
}

type SignedUrl = { id: string; url: string; mime: string; expiresAt: number };
const signedUrlCache = new Map<string, SignedUrl>();

export const mediaService = {
  async listForCard(cardId: string): Promise<CardMedia[]> {
    const { data, error } = await createClient().from('card_media').select('*').eq('card_id', cardId).order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  async listForDeck(deckId: string): Promise<CardMedia[]> {
    const { data, error } = await createClient().from('card_media').select('*,cards!inner(deck_id)').eq('cards.deck_id', deckId).order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as CardMedia[];
  },
  async upload(file: File, _userId?: string, cardId?: string, fieldName?: string, context?: MediaUploadContext) {
    validateMediaFile(file, { imageOnly: !cardId && Boolean(context) });
    if (!cardId && (!context?.noteId || !context.deckId)) throw new MediaServiceError('Informe a nota e o deck antes de enviar uma imagem de oclusão.', { code: 'OCCLUSION_NOTE_OR_DECK_REQUIRED', status: 400 });
    const user = await requireUser();
    const assetId = globalThis.crypto?.randomUUID?.() ?? `asset-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const path = `${user.id}/${cardId ?? 'staging'}/${assetId}.${storageExtension(file)}`;
    const supabase = createClient();
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) throw new MediaServiceError(uploadError.message, { code: uploadError.name || 'MEDIA_STORAGE_UPLOAD_FAILED', status: 400, cause: uploadError });
    if (!cardId) {
      const { data, error } = await supabase.rpc('stage_image_occlusion_asset', {
        p_asset_id: assetId,
        p_deck_id: context!.deckId,
        p_file_size_bytes: file.size,
        p_mime_type: file.type,
        p_note_id: context!.noteId,
        p_storage_bucket: BUCKET,
        p_storage_path: path,
      });
      if (error) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw new MediaServiceError(error.message, { code: error.code || 'MEDIA_ASSET_STAGING_FAILED', status: 400, cause: error });
      }
      return { id: assetId, asset_id: assetId, storage_key: path, mime: file.type, size: file.size, asset: data };
    }
    const { data, error } = await supabase.from('card_media').insert({ id: assetId, card_id: cardId, user_id: user.id, field_name: fieldName ?? null, media_type: mediaType(file), storage_path: path, storage_bucket: BUCKET, file_size_bytes: file.size, mime_type: file.type, metadata: { original_name: file.name } as Json }).select('*').single();
    if (error) {
      await supabase.storage.from(BUCKET).remove([path]);
      throw new MediaServiceError(error.message, { code: error.code || 'MEDIA_DATABASE_INSERT_FAILED', status: 400, cause: error });
    }
    return data;
  },
  async update(id: string, patch: { cardId?: string; fieldName?: string | null; metadata?: Json }): Promise<CardMedia> {
    const { data, error } = await createClient().from('card_media').update({ ...(patch.cardId ? { card_id: patch.cardId } : {}), ...(patch.fieldName !== undefined ? { field_name: patch.fieldName } : {}), ...(patch.metadata !== undefined ? { metadata: patch.metadata } : {}) }).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async remove(id: string): Promise<void> {
    const supabase = createClient();
    const { data, error } = await supabase.from('card_media').select('storage_bucket,storage_path').eq('id', id).single();
    if (error) throw error;
    const bucket = data.storage_bucket || BUCKET;
    const { data: references, error: referencesError } = await supabase.from('card_media').select('id').eq('storage_bucket', bucket).eq('storage_path', data.storage_path).neq('id', id);
    if (referencesError) throw referencesError;
    const { error: deleteError } = await supabase.from('card_media').delete().eq('id', id);
    if (deleteError) throw deleteError;
    if (!references?.length) {
      const { error: storageError } = await supabase.storage.from(bucket).remove([data.storage_path]);
      if (storageError) throw new MediaServiceError(`A mídia foi removida do banco, mas o storage precisa de limpeza: ${data.storage_path}`, { code: 'MEDIA_STORAGE_CLEANUP_REQUIRED', status: 500, cause: storageError });
    }
  },
  async removeAsset(assetId: string): Promise<void> {
    const supabase = createClient();
    const { data: asset, error } = await supabase.from('image_occlusion_assets').select('storage_bucket,storage_path,status').eq('id', assetId).single();
    if (error) throw error;
    if (asset.status !== 'staged') throw new MediaServiceError('Este asset já foi associado a cartões e não pode ser removido por esta tela.', { code: 'MEDIA_ASSET_ALREADY_ASSOCIATED', status: 409 });
    const { error: storageError } = await supabase.storage.from(asset.storage_bucket).remove([asset.storage_path]);
    if (storageError) throw storageError;
    const { error: deleteError } = await supabase.from('image_occlusion_assets').delete().eq('id', assetId).eq('status', 'staged');
    if (deleteError) throw new MediaServiceError('O arquivo foi removido, mas o registro de staging precisa de limpeza.', { code: 'MEDIA_ASSET_DATABASE_CLEANUP_REQUIRED', status: 500, cause: deleteError });
  },
  async signMany(paths: string[]): Promise<SignedUrl[]> {
    const now = Date.now();
    const pending = paths.filter((path) => {
      const cached = signedUrlCache.get(path);
      return !cached || cached.expiresAt - now <= RENEW_BEFORE * 1000;
    });
    if (pending.length) {
      const supabase = createClient();
      await Promise.all(pending.map(async (path) => {
        const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, TTL);
        if (error) throw new MediaServiceError(error.message, { code: 'MEDIA_SIGNED_URL_FAILED', status: 400, cause: error });
        signedUrlCache.set(path, { id: path, url: data.signedUrl, mime: '', expiresAt: Date.now() + TTL * 1000 });
      }));
    }
    return paths.map((path) => signedUrlCache.get(path)).filter((entry): entry is SignedUrl => Boolean(entry));
  },
  async signedUrl(path: string) { return (await this.signMany([path]))[0]?.url; },
  async refreshSignedUrl(path: string) { signedUrlCache.delete(path); return this.signedUrl(path); },
  async listOrphans() { const { data, error } = await createClient().rpc('list_orphaned_card_media', { p_limit: 100 }); if (error) throw error; return data ?? []; },
  async listStagedAssets() { const { data, error } = await createClient().rpc('list_staged_image_occlusion_assets', { p_limit: 100 }); if (error) throw error; return data ?? []; },
};

export function actionableMediaError(error: unknown) {
  if (!(error instanceof MediaServiceError)) return error instanceof Error ? error.message : 'Não foi possível concluir a operação de mídia.';
  return `${error.message} (código ${error.code}${error.status ? `, status ${error.status}` : ''}${error.requestId ? `, requestId ${error.requestId}` : ''})`;
}

export async function uploadCardMedia(file: File, userId: string, cardId: string, fieldName?: string) { return mediaService.upload(file, userId, cardId, fieldName); }
export async function createSignedMediaUrl(path: string) { return mediaService.signedUrl(path); }
