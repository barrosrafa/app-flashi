import { createClient, type Inserts } from '../supabase/client';
import { executeIncrementalSync } from './sync-engine';
import { db, type OfflineMutation } from './schema';

type SyncTable = 'decks' | 'notes' | 'cards' | 'deck_exams' | 'review_logs';
type MutationAction = OfflineMutation['action'];

export async function enqueueMutation(
  table_name: string,
  action: MutationAction,
  payload: Record<string, unknown>,
  rpc_name?: string,
) {
  const id = crypto.randomUUID();
  await db.outbox.add({
    id,
    table_name,
    action,
    payload,
    rpc_name,
    created_at: new Date().toISOString(),
    retries: 0,
  });

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    void flushOutboxQueue();
  }

  return id;
}

function isSyncTable(tableName: string): tableName is SyncTable {
  return ['decks', 'notes', 'cards', 'deck_exams', 'review_logs'].includes(tableName);
}

async function upsertMutation(
  tableName: SyncTable,
  payload: Record<string, unknown>,
) {
  const supabase = createClient();

  switch (tableName) {
    case 'decks':
      return supabase.from('decks').upsert(payload as Inserts<'decks'>);
    case 'notes':
      return supabase.from('notes').upsert(payload as Inserts<'notes'>);
    case 'cards':
      return supabase.from('cards').upsert(payload as Inserts<'cards'>);
    case 'deck_exams':
      return supabase.from('deck_exams').upsert(payload as Inserts<'deck_exams'>);
    case 'review_logs':
      return supabase.from('review_logs').upsert(payload as Inserts<'review_logs'>);
  }
}

async function deleteMutation(
  tableName: SyncTable,
  payload: Record<string, unknown>,
) {
  const id = payload.id;
  if (typeof id !== 'string' || id.length === 0) {
    return { error: new Error('OUTBOX_ID_REQUIRED') };
  }

  const supabase = createClient();
  return supabase.from(tableName).delete().eq('id', id);
}

async function flushMutation(item: OfflineMutation) {
  const supabase = createClient();

  if (item.action === 'rpc' && item.rpc_name) {
    const { error } = await supabase.functions.invoke(item.rpc_name, {
      body: item.payload,
    });
    return error;
  }

  if (!isSyncTable(item.table_name)) {
    return new Error(`OUTBOX_TABLE_NOT_SUPPORTED:${item.table_name}`);
  }

  const result =
    item.action === 'delete'
      ? await deleteMutation(item.table_name, item.payload)
      : await upsertMutation(item.table_name, item.payload);

  return result.error ?? null;
}

export async function flushOutboxQueue() {
  const items = await db.outbox.orderBy('created_at').toArray();

  for (const item of items) {
    try {
      const error = await flushMutation(item);
      if (error) throw error;
      await db.outbox.delete(item.id);
    } catch {
      await db.outbox.update(item.id, { retries: item.retries + 1 });
      break;
    }
  }

  await executeIncrementalSync();
}
