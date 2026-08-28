import { createClient, type Tables } from '../supabase/client';
import type { Database } from '../../src/types/database';
import { invokeUserFunction } from './edge-service';

export type IngestionSource = Database['public']['Enums']['generation_source_type'];
export type IngestionJob = Tables<'ai_ingestion_jobs'>;

export type IngestionRequest = {
  deckId: string;
  sourceType: IngestionSource;
  content?: string;
  storagePath?: string;
};

export async function createIngestionJob(input: IngestionRequest) {
  if (!input.deckId) throw new Error('DECK_REQUIRED');
  if (!input.content && !input.storagePath) throw new Error('SOURCE_REQUIRED');
  if (input.content && input.content.length > 2000) throw new Error('SOURCE_TOO_LONG');
  if (input.sourceType === 'pdf_document' && input.storagePath && !input.storagePath.toLowerCase().endsWith('.pdf')) {
    throw new Error('PDF_REQUIRED');
  }

  return invokeUserFunction<{ job_id?: string; status: string; source_type: IngestionSource }>('ai-ingest', {
    deck_id: input.deckId,
    source_type: input.sourceType,
    ...(input.content ? { content: input.content } : {}),
    ...(input.storagePath ? { storage_path: input.storagePath } : {}),
  });
}

export async function listIngestionJobs(deckId?: string) {
  let query = createClient()
    .from('ai_ingestion_jobs')
    .select('id,user_id,deck_id,source_type,source_reference,status,error_message,notes_generated_count,cards_generated_count,created_at,updated_at,deleted_at,usn')
    .order('created_at', { ascending: false })
    .limit(50);
  if (deckId) query = query.eq('deck_id', deckId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}
