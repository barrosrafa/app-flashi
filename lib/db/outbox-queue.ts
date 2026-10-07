import { requireLocalIdentity } from './offline-identity';
import { track } from '../observability/posthog';
import { captureException } from '../observability/sentry';
import { createClient } from '../supabase/client';
import { db, SYNC_TABLES, type OfflineMutation, type SyncTableName } from './schema';
import { bindLocalUserNamespace } from './local-user-scope';
import { recordTelemetry } from './telemetry';
import { invokeEdge } from '../services/http/edge-client';

export type FlushResult = { flushed: number; failed: number; deferred: number };
type EnqueueOptions = { rpc_name?: string; transport?: 'edge' | 'rpc'; client_mutation_id?: string;expected_user_id?:string };
let flushPromise: Promise<FlushResult> | null = null;

async function currentUserId(remote=false) { const user=await requireLocalIdentity(remote); await bindLocalUserNamespace(user.id);return user.id; }

export async function enqueueMutation(
  table_name: string,
  action: OfflineMutation['action'],
  payload: Record<string, unknown>,
  options: EnqueueOptions | string = {},
) {
  const userId = await currentUserId();
  const normalized = typeof options === 'string' ? { rpc_name: options } : options;
  if(normalized.expected_user_id&&normalized.expected_user_id!==userId)throw new Error('AUTH_ACCOUNT_CHANGED');
  const clientMutationId = normalized.client_mutation_id ?? crypto.randomUUID();
  const existing = await db.outbox.where('client_mutation_id').equals(clientMutationId).first();
  if (existing) {
    if (existing.user_id !== userId) throw new Error('OUTBOX_OWNER_MISMATCH');
    return existing.id;
  }
  const item: OfflineMutation = {
    id: crypto.randomUUID(), user_id: userId, table_name, action,
    payload: { ...payload, client_mutation_id: clientMutationId },
    rpc_name: normalized.rpc_name, transport: normalized.transport ?? 'edge',
    client_mutation_id: clientMutationId, created_at: new Date().toISOString(), retries: 0,
  };
  await db.outbox.add(item);
  recordTelemetry('outbox.enqueued', { action, table_name });
  if (normalized.rpc_name === 'fsrs-review') track('review_queued',{request_id:clientMutationId,operation:'review',status:'pending'});
  if (typeof navigator !== 'undefined' && navigator.onLine) void flushOutboxQueue().catch(()=>undefined);
  return item.id;
}

function isSyncTable(tableName: string): tableName is SyncTableName {
  return (SYNC_TABLES as readonly string[]).includes(tableName);
}

export function isPermanentOutboxError(error: unknown, item?: Pick<OfflineMutation, 'rpc_name'>) {
  const candidate = error as { status?: number; code?: string; message?: string; name?: string; context?: { status?: number } };
  const status = Number(candidate?.status ?? candidate?.context?.status ?? 0);
  const code = String(candidate?.code ?? candidate?.message ?? '');
  if (candidate?.name === 'AuthRequiredError' || /AUTH_REQUIRED|UNAUTHENTICATED/.test(code) || status === 401) return false;
  if (item?.rpc_name === 'fsrs-review' && status === 409) return false;
  return [400, 403, 404, 409, 422].includes(status) || /VALIDATION|FORBIDDEN|NOT_FOUND|CONFLICT|INVALID|UNSUPPORTED/i.test(code);
}

export function retryDelayMs(retries: number, retryAfterSec = 0) {
  const exponential = Math.min(1_000 * 2 ** Math.min(Math.max(retries, 0), 9), 15 * 60 * 1_000);
  return Math.max(exponential, Number.isFinite(retryAfterSec) && retryAfterSec > 0 ? retryAfterSec * 1_000 : 0);
}

async function hasPendingReviewsForSession(userId: string, sessionId: string, exceptId: string) {
  const items = await db.outbox.where('user_id').equals(userId).toArray();
  return items.some((item) => item.id !== exceptId && item.table_name === 'review_logs' && item.payload.session_id === sessionId);
}

async function flushMutation(item: OfflineMutation) {
  const supabase = createClient() as any;
  if (item.action === 'rpc' && item.rpc_name) {
    if (['sync_session_xp','sync_session_xp_confirmed'].includes(item.rpc_name)) {
      const sessionId = item.payload.p_session_id;
      if (typeof sessionId === 'string' && await hasPendingReviewsForSession(item.user_id, sessionId, item.id)) return 'deferred' as const;
    }
    if (item.transport === 'rpc') {
      const rpcPayload = { ...item.payload };
      delete rpcPayload.client_mutation_id;
      const { data, error } = await supabase.rpc(item.rpc_name, rpcPayload);
      if (error) throw error;
      if(item.rpc_name==='sync_session_xp_confirmed') { const row=Array.isArray(data)?data[0]:data; if(!row||Number(row.review_count)!==Number(rpcPayload.p_expected_review_count)||!Number.isFinite(Number(row.xp_awarded)))throw new Error('XP_CONFIRMATION_INVALID'); }
      return null;
    }
    const idempotentReview = item.rpc_name === 'fsrs-review';
    if(idempotentReview) track('review_sent',{request_id:item.client_mutation_id,operation:'review'});
    const response = await invokeEdge<Record<string, unknown>>(item.rpc_name, {
      body: item.payload,
      ...(idempotentReview ? { idempotencyKey: item.client_mutation_id, isIdempotent: true } : {}),
    });
    if (idempotentReview) {
      if(typeof response.review_id!=='string'||!response.review_id||response.client_review_id!==item.client_mutation_id||typeof response.due_at!=='string'||!Number.isFinite(Date.parse(response.due_at))||typeof response.interval_days!=='number'||response.interval_days<0)throw new Error('REVIEW_CONFIRMATION_INVALID');
      const patch = {
        server_confirmed: true,
        server_review_id: response.review_id,
        server_state: response.state,
        server_due_at: response.due_at,
        server_interval_days: response.interval_days,
        confirmed_at: new Date().toISOString(),
      };
      await db.reviews.where('client_review_id').equals(item.client_mutation_id).modify(patch as any);
      track('review_confirmed',{request_id:item.client_mutation_id,operation:'review',status:'confirmed'});
    }
    return null;
  }
  if (!isSyncTable(item.table_name)) throw new Error(`OUTBOX_TABLE_NOT_SUPPORTED:${item.table_name}`);
  if (item.action === 'delete') {
    const id = item.payload.id;
    if (typeof id !== 'string' || !id) throw new Error('OUTBOX_ID_REQUIRED');
    const { error } = await supabase.from(item.table_name).delete().eq('id', id);
    if (error) throw error;
    return null;
  }
  const rowPayload = { ...item.payload };
  delete rowPayload.client_mutation_id;
  const { error } = await supabase.from(item.table_name).upsert(rowPayload, { ignoreDuplicates: item.table_name === 'review_logs' });
  if (error) throw error;
  return null;
}

function retryAfterSeconds(error: unknown) {
  const value = (error as { retryAfterSec?: number })?.retryAfterSec;
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

async function performFlush(): Promise<FlushResult> {
  const startedAt = performance.now();
  const userId = await currentUserId(typeof navigator==='undefined'||navigator.onLine);
  const items = await db.outbox.where('user_id').equals(userId).and((item) => !item.quarantined).sortBy('created_at');
  if(typeof navigator!=='undefined'&&!navigator.onLine)return {flushed:0,failed:0,deferred:items.length};
  track('outbox_flush_started',{count:items.length});
  let flushed = 0;
  let failed = 0;
  let deferred = 0;
  for (const item of items) {
    if (item.next_attempt_at && Date.parse(item.next_attempt_at) > Date.now()) { deferred += 1; continue; }
    try {
      const activeUserId = await currentUserId(true);
      if (activeUserId !== userId) break;
      const outcome = await flushMutation(item);
      if (outcome === 'deferred') { deferred += 1; continue; }
      await db.outbox.delete(item.id);
      flushed += 1;
    } catch (error) {
      failed += 1;
      const nextRetries = item.retries + 1;
      const permanent = isPermanentOutboxError(error, item);
      const nextAttemptAt = new Date(Date.now() + retryDelayMs(nextRetries, retryAfterSeconds(error))).toISOString();
      await db.outbox.update(item.id, {
        retries: nextRetries,
        last_error: error instanceof Error ? error.message.slice(0, 240) : 'UNKNOWN_ERROR',
        quarantined: permanent,
        next_attempt_at: permanent ? undefined : nextAttemptAt,
      });
      track(item.rpc_name==='fsrs-review'?'review_failed':'outbox_item_failed',{operation:item.rpc_name??item.action,retries:nextRetries,retryable:!permanent});
      captureException(error,{tags:{area:'outbox',operation:item.rpc_name??item.action,retryable:String(!permanent)},extra:{request_id:item.client_mutation_id}});
      recordTelemetry('outbox.failure', { table_name: item.table_name, retries: nextRetries, permanent });
      // A transient failure no longer blocks unrelated mutations in this batch.
    }
  }
  if (flushed || failed || deferred) recordTelemetry('outbox.flushed', {
    count: flushed, failed, deferred, duration_ms: Math.round(performance.now() - startedAt),
  });
  track('outbox_flush_completed',{count:flushed,failed,deferred,duration_ms:Math.round(performance.now()-startedAt)});
  return { flushed, failed, deferred };
}

export function flushOutboxQueue(): Promise<FlushResult> {
  if (flushPromise) return flushPromise;
  flushPromise = performFlush().finally(() => { flushPromise = null; });
  return flushPromise;
}

export async function retryOutboxItem(id: string) {
  const userId = await currentUserId();
  const item = await db.outbox.get(id);
  if (!item) throw new Error('OUTBOX_ITEM_NOT_FOUND');
  if (item.user_id !== userId) throw new Error('OUTBOX_OWNER_MISMATCH');
  await db.outbox.update(id, { retries: 0, quarantined: false, last_error: undefined, next_attempt_at: undefined });
  return flushOutboxQueue();
}

export async function getOutboxStatus() {
  const userId = await currentUserId();
  const items = await db.outbox.where('user_id').equals(userId).toArray();
  return { pending: items.length, failed: items.filter((item) => item.retries > 0 || item.quarantined).length, items };
}

export async function getPendingReviewCountForSession(sessionId: string) {
  const userId = await currentUserId();
  const items = await db.outbox.where('user_id').equals(userId).toArray();
  return items.filter((item) => item.table_name === 'review_logs' && item.payload.session_id === sessionId).length;
}
