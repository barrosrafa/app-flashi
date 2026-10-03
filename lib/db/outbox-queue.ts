import { createClient } from '../supabase/client';
import { executeIncrementalSync } from './sync-engine';
import { db, SYNC_TABLES, type OfflineMutation, type SyncTableName } from './schema';
import { recordTelemetry } from './telemetry';
import { invokeEdge } from '../services/http/edge-client';

type EnqueueOptions = { rpc_name?: string; transport?: 'edge' | 'rpc'; client_mutation_id?: string };
let flushing = false;

export async function enqueueMutation(table_name: string, action: OfflineMutation['action'], payload: Record<string, unknown>, options: EnqueueOptions | string = {}) {
  const normalized = typeof options === 'string' ? { rpc_name: options } : options;
  const clientMutationId = normalized.client_mutation_id ?? crypto.randomUUID();
  const item: OfflineMutation = {
    id: crypto.randomUUID(), table_name, action, payload: { ...payload, client_mutation_id: clientMutationId },
    rpc_name: normalized.rpc_name, transport: normalized.transport ?? 'edge', client_mutation_id: clientMutationId,
    created_at: new Date().toISOString(), retries: 0,
  };
  await db.outbox.add(item);
  recordTelemetry('outbox.enqueued', { action, table_name });
  if (typeof navigator !== 'undefined' && navigator.onLine) void flushOutboxQueue();
  return item.id;
}

function isSyncTable(tableName: string): tableName is SyncTableName { return (SYNC_TABLES as readonly string[]).includes(tableName); }

async function upsertMutation(tableName: SyncTableName, payload: Record<string, unknown>) {
  const supabase = createClient() as any;
  const { client_mutation_id: _clientMutationId, ...rowPayload } = payload;
  return supabase.from(tableName).upsert(rowPayload, { ignoreDuplicates: tableName === 'review_logs' });
}

async function flushMutation(item: OfflineMutation) {
  const supabase = createClient() as any;
  if (item.action === 'rpc' && item.rpc_name) {
    if (item.transport === 'rpc') {
      const { client_mutation_id: _clientMutationId, ...rpcPayload } = item.payload;
      return (await supabase.rpc(item.rpc_name, rpcPayload)).error;
    }
    try { await invokeEdge(item.rpc_name, { body: item.payload }); return null; } catch (error) { return error; }
  }
  if (!isSyncTable(item.table_name)) return new Error(`OUTBOX_TABLE_NOT_SUPPORTED:${item.table_name}`);
  if (item.action === 'delete') {
    const id = item.payload.id;
    if (typeof id !== 'string' || !id) return new Error('OUTBOX_ID_REQUIRED');
    return (await supabase.from(item.table_name).delete().eq('id', id)).error;
  }
  return (await upsertMutation(item.table_name, item.payload)).error ?? null;
}

export async function flushOutboxQueue() {
  if (flushing) return;
  flushing = true;
  const startedAt = performance.now();
  try {
    const items = await db.outbox.orderBy('created_at').toArray();
    let flushed = 0;
    for (const item of items) {
      try {
        const error = await flushMutation(item);
        if (error) throw error;
        await db.outbox.delete(item.id);
        flushed += 1;
      } catch {
        await db.outbox.update(item.id, { retries: item.retries + 1 });
        recordTelemetry('outbox.failure', { table_name: item.table_name, retries: item.retries + 1 });
        break;
      }
    }
    if (flushed) recordTelemetry('outbox.flushed', { count: flushed, duration_ms: Math.round(performance.now() - startedAt) });
    if (flushed || items.length === 0) await executeIncrementalSync();
  } finally { flushing = false; }
}

export async function retryOutboxItem(id: string) {
  await db.outbox.update(id, { retries: 0 });
  await flushOutboxQueue();
}

export async function getOutboxStatus() {
  const items = await db.outbox.toArray();
  return { pending: items.length, failed: items.filter((item) => item.retries > 0).length, items };
}
