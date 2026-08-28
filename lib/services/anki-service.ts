import { createClient } from '../supabase/client';
import { invokeUserFunction } from './edge-service';

const MAX_APKG_BYTES = 50 * 1024 * 1024;

function safeFilename(filename: string) {
  const normalized = filename.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '-');
  return normalized || 'deck.apkg';
}

async function sha256(file: File) {
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function importAnkiPackage(file: File, targetDeckName?: string) {
  if (!file.name.toLowerCase().endsWith('.apkg')) throw new Error('APKG_REQUIRED');
  if (file.size > MAX_APKG_BYTES) throw new Error('APKG_TOO_LARGE');

  const {
    data: { user },
  } = await createClient().auth.getUser();
  if (!user) throw new Error('AUTH_REQUIRED');

  const storagePath = `${user.id}/imports/${Date.now()}-${safeFilename(file.name)}`;
  const { error: uploadError } = await createClient()
    .storage
    .from('anki-transfers')
    .upload(storagePath, file, { contentType: 'application/zip', upsert: false });
  if (uploadError) throw uploadError;

  return invokeUserFunction<{
    job_id: string;
    status: string;
    deck_id?: string;
    deck_name?: string;
    imported_cards?: number;
    imported_notes?: number;
  }>('anki-transfer', {
    action: 'import',
    storage_path: storagePath,
    ...(targetDeckName?.trim() ? { target_deck_name: targetDeckName.trim() } : {}),
    file_sha256: await sha256(file),
  });
}

export async function exportAnkiPackage(deckId: string, includeMedia = true) {
  if (!deckId) throw new Error('DECK_REQUIRED');
  const result = await invokeUserFunction<{
    job_id: string;
    status: string;
    storage_path: string;
    file_sha256: string;
    total_cards: number;
    bytes: number;
  }>('anki-transfer', {
    action: 'export',
    deck_id: deckId,
    include_media: includeMedia,
  });

  const { data, error } = await createClient()
    .storage
    .from('anki-transfers')
    .createSignedUrl(result.storage_path, 300);
  if (error) throw error;
  return { ...result, signed_url: data.signedUrl };
}
