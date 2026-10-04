import { createClient, type Tables } from '../supabase/client';
import { invokeEdge } from './http/edge-client';
import { hasBrowserSession } from '../supabase/guards';

export type ImportFormat = 'csv' | 'markdown' | 'quizlet' | 'remnote';
export type ImportDeckResult = { job_id: string; status: string; notes_count: number; cards_count: number };
export type ImportJob = Tables<'deck_import_jobs'>;

const MAX_BYTES = 15 * 1024 * 1024;
const EXTENSIONS: Record<ImportFormat, string[]> = {
  csv: ['.csv'],
  markdown: ['.md', '.markdown', '.txt'],
  quizlet: ['.csv', '.txt'],
  remnote: ['.md', '.markdown', '.txt'],
};

function validateFile(file: File, format: ImportFormat) {
  if (!file.size) throw new Error('IMPORT_EMPTY');
  if (file.size > MAX_BYTES) throw new Error('IMPORT_TOO_LARGE');
  const lower = file.name.toLowerCase();
  if (!EXTENSIONS[format].some((extension) => lower.endsWith(extension))) throw new Error('IMPORT_EXTENSION_INVALID');
}

export const importDeckService = {
  async fromFile(opts: { file: File; deckId: string; format: ImportFormat; deckName?: string }) {
    if (!opts.deckId) throw new Error('DECK_REQUIRED');
    validateFile(opts.file, opts.format);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('AUTH_REQUIRED');
    const path = `${user.id}/${crypto.randomUUID()}-${opts.file.name.replace(/[^\w.-]/g, '-')}`;
    const { error } = await supabase.storage.from('import-media').upload(path, opts.file, {
      contentType: opts.file.type || 'text/plain',
      upsert: false,
    });
    if (error) throw error;
    try {
      return await invokeEdge<ImportDeckResult>('import-deck', {
        body: { deck_id: opts.deckId, storage_path: path, format: opts.format },
        timeoutMs: 60_000,
      });
    } catch (error) {
      await supabase.storage.from('import-media').remove([path]);
      throw error;
    }
  },
  async fromUrl(opts: { url: string; deckId: string; format: ImportFormat }) {
    if (!opts.deckId) throw new Error('DECK_REQUIRED');
    if (opts.url.length > 2048) throw new Error('URL_IMPORT_INVALID');
    let parsed: URL;
    try { parsed = new URL(opts.url); } catch { throw new Error('URL_IMPORT_INVALID'); }
    if (parsed.protocol !== 'https:') throw new Error('URL_IMPORT_PROTOCOL');
    if (parsed.username || parsed.password) throw new Error('URL_IMPORT_CREDENTIALS');
    try {
      return await invokeEdge<ImportDeckResult>('import-deck', {
        body: { deck_id: opts.deckId, format: opts.format, url: parsed.toString() },
        timeoutMs: 60_000,
      });
    } catch (error) {
      throw new Error(error instanceof Error ? `URL_IMPORT_FAILED: ${error.message}` : 'URL_IMPORT_FAILED');
    }
  },
};

export async function listImportJobs(deckId?: string): Promise<ImportJob[]> {
  if (!(await hasBrowserSession())) throw new Error('AUTH_REQUIRED');
  const supabase = createClient();
  let query = supabase.from('deck_import_jobs').select('*').order('created_at', { ascending: false }).limit(50);
  if (deckId) query = query.eq('deck_id', deckId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ImportJob[];
}
