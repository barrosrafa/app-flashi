import { createClient } from '../supabase/client';
import { db, SYNC_TABLES, type OfflineMutation, type SyncTableName } from './schema';
import { recordTelemetry } from './telemetry';
import { invokeEdge } from '../services/http/edge-client';

type EnqueueOptions = { rpc_name?: string; transport?: 'edge' | 'rpc'; client_mutation_id?: string };
let flushing = false;
async function currentUserId() { const { data } = await createClient().auth.getUser(); if (!data.user) throw new Error('AUTH_REQUIRED'); return data.user.id; }
export async function enqueueMutation(table_name: string, action: OfflineMutation['action'], payload: Record<string, unknown>, options: EnqueueOptions | string = {}) {
  const userId = await currentUserId();
  const normalized = typeof options === 'string' ? { rpc_name: options } : options;
  const clientMutationId = normalized.client_mutation_id ?? crypto.randomUUID();
  const item: OfflineMutation = { id: crypto.randomUUID(), user_id: userId, table_name, action, payload: { ...payload, client_mutation_id: clientMutationId }, rpc_name: normalized.rpc_name, transport: normalized.transport ?? 'edge', client_mutation_id: clientMutationId, created_at: new Date().toISOString(), retries: 0 };
  await db.outbox.add(item); recordTelemetry('outbox.enqueued', { action, table_name });
  if (typeof navigator !== 'undefined' && navigator.onLine) void flushOutboxQueue();
  return item.id;
}
function isSyncTable(tableName: string): tableName is SyncTableName { return (SYNC_TABLES as readonly string[]).includes(tableName); }
async function flushMutation(item: OfflineMutation) {
  const supabase = createClient() as any;
  if (item.action === 'rpc' && item.rpc_name) { if (item.transport === 'rpc') { const rpcPayload = { ...item.payload }; delete rpcPayload.client_mutation_id; return (await supabase.rpc(item.rpc_name, rpcPayload)).error; } try { await invokeEdge(item.rpc_name, { body: item.payload }); return null; } catch (error) { return error; } }
  if (!isSyncTable(item.table_name)) return new Error(`OUTBOX_TABLE_NOT_SUPPORTED:${item.table_name}`);
  if (item.action === 'delete') { const id = item.payload.id; if (typeof id !== 'string' || !id) return new Error('OUTBOX_ID_REQUIRED'); return (await supabase.from(item.table_name).delete().eq('id', id)).error; }
  const rowPayload = { ...item.payload }; delete rowPayload.client_mutation_id;
  return (await supabase.from(item.table_name).upsert(rowPayload, { ignoreDuplicates: item.table_name === 'review_logs' })).error ?? null;
}
function isPermanent(error: unknown) { const status = Number((error as { status?: number; context?: { status?: number } })?.status ?? (error as { context?: { status?: number } })?.context?.status ?? 0); const code = String((error as { code?: string; message?: string })?.code ?? (error as { message?: string })?.message ?? ''); return [400, 401, 403, 404, 409, 422].includes(status) || /VALIDATION|AUTH_REQUIRED|FORBIDDEN|NOT_FOUND|CONFLICT|REUSED|INVALID/i.test(code); }
export async function flushOutboxQueue() {
  if (flushing) return { flushed: 0, failed: 0 }; flushing = true; const startedAt = performance.now();
  try {
    const userId = await currentUserId();
    const items = await db.outbox.where('user_id').equals(userId).and((item) => !item.quarantined).sortBy('created_at');
    let flushed = 0; let failed = 0;
    for (const item of items) { try { const error = await flushMutation(item); if (error) throw error; await db.outbox.delete(item.id); flushed += 1; } catch (error) { failed += 1; const nextRetries = item.retries + 1; await db.outbox.update(item.id, { retries: nextRetries, last_error: error instanceof Error ? error.message.slice(0, 240) : 'UNKNOWN_ERROR', quarantined: isPermanent(error) }); recordTelemetry('outbox.failure', { table_name: item.table_name, retries: nextRetries, permanent: isPermanent(error) }); if (!isPermanent(error)) break; } }
    if (flushed || failed) recordTelemetry('outbox.flushed', { count: flushed, failed, duration_ms: Math.round(performance.now() - startedAt) });
    return { flushed, failed };
  } finally { flushing = false; }
}
export async function retryOutboxItem(id: string) { await db.outbox.update(id, { retries: 0, quarantined: false, last_error: undefined }); return flushOutboxQueue(); }
export async function getOutboxStatus() { const userId = await currentUserId(); const items = await db.outbox.where('user_id').equals(userId).toArray(); return { pending: items.length, failed: items.filter((item) => item.retries > 0).length, items }; }
