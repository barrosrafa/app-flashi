import { invokeEdge } from '../services/http/edge-client';
import { createClient } from '../supabase/client';
import { bindLocalUserNamespace,withLocalUserNamespace } from './local-user-scope';
import { db, SYNC_TABLES, type SyncableRecord, type SyncTableName } from './schema';
import { flushOutboxQueue, type FlushResult } from './outbox-queue';
import { recordTelemetry } from './telemetry';
import { capture, normalizeErrorCode } from '../observability';

type SyncChange = { entity_type: string; entity_key: string; usn: number | string; is_deleted?: boolean; payload?: SyncableRecord | null };
type SyncResponse = { data?: SyncChange[]; next_usn?: string | number; has_more?: boolean; cursor_commit_rule?: string } | SyncChange[];
const ENTITY_TABLE_MAP: Record<string, SyncTableName> = Object.fromEntries(SYNC_TABLES.map((table) => [table, table]));
Object.assign(ENTITY_TABLE_MAP, { deck: 'decks', card: 'cards', note: 'notes', card_learning_state: 'card_learning_state', review_log: 'review_logs', tag: 'tags', card_template: 'card_templates', study_settings: 'study_settings', user_deck_settings: 'user_deck_settings', daily_statistics: 'daily_statistics', note_card_definition: 'note_card_definitions', note_cloze_deletion: 'note_cloze_deletions', fsrs_optimization_run: 'fsrs_optimization_runs', ai_ingestion_job: 'ai_ingestion_jobs', note_image_occlusion_box: 'note_image_occlusion_boxes', note_reference: 'note_references', user_gamification_profile: 'user_gamification_profiles', profile: 'profiles', deck_exam: 'deck_exams', socratic_remediation_session: 'socratic_remediation_sessions', card_tag: 'card_tags' });

function normalize(data: SyncResponse | null) {
  const rows = Array.isArray(data) ? data : data?.data ?? [];
  return {
    rows: rows.sort((a, b) => BigInt(String(a.usn)) === BigInt(String(b.usn)) ? 0 : BigInt(String(a.usn)) < BigInt(String(b.usn)) ? -1 : 1),
    nextUsn: Array.isArray(data) ? undefined : data?.next_usn,
    hasMore: Array.isArray(data) ? false : Boolean(data?.has_more),
  };
}

export async function executeIncrementalSync(): Promise<boolean> {
  const startedAt = performance.now();
  const { data: { user }, error: authError } = await createClient().auth.getUser();
  if (authError || !user) return false;
  await bindLocalUserNamespace(user.id);
  const cursorKey = `last_usn:${user.id}`;
  let cursor = (await db.sync_meta.get(cursorKey))?.value ?? '0';
  let pages = 0;
  let totalChanges = 0;
  const pendingMutations = await db.outbox.where('user_id').equals(user.id).count();
  capture('sync_started', { pending_mutations: pendingMutations });
  try {
    do {
      const response = await invokeEdge<SyncResponse>('sync', { body: { last_usn: cursor, limit: 500 } });
      const activeUser = (await createClient().auth.getUser()).data.user;
      if (!activeUser || activeUser.id !== user.id) return false;
      const { rows, nextUsn, hasMore } = normalize(response);
      const highest = String(nextUsn ?? rows.reduce((max, row) => BigInt(String(row.usn)) > BigInt(max) ? String(row.usn) : max, cursor));
      await withLocalUserNamespace(user.id,()=>db.transaction('rw', db.tables, async () => {
        for (const change of rows) {
          const table = ENTITY_TABLE_MAP[change.entity_type];
          if (!table) continue;
          const local = db.table(table) as any;
          if (change.is_deleted) {
            const existing = await local.get(change.entity_key);
            if (existing?.user_id && existing.user_id !== user.id) continue;
            await local.put({ id: change.entity_key, ...(change.payload ?? {}), deleted_at: (change.payload as any)?.deleted_at ?? new Date().toISOString(), usn: String(change.usn), user_id: user.id, _dirty: 0, _synced_at: new Date().toISOString() });
          } else if (change.payload) {
            const owner = (change.payload as any).user_id;
            if (owner && owner !== user.id) continue;
            await local.put({ ...change.payload, id: change.payload.id ?? change.entity_key, usn: change.usn, _dirty: 0, _synced_at: new Date().toISOString() });
          }
        }
        if (BigInt(highest) > BigInt(cursor)) await db.sync_meta.put({ key: cursorKey, value: highest, user_id: user.id });
      }));
      totalChanges += rows.length;
      if (BigInt(highest) <= BigInt(cursor) && hasMore) break;
      cursor = highest;
      pages += 1;
      if (!hasMore) break;
    } while (pages < 20);
    const durationMs = Math.round(performance.now() - startedAt);
    recordTelemetry('sync.success', { duration_ms: durationMs, changes: totalChanges, cursor });
    capture('sync_completed', { synced: totalChanges, failed: 0, duration_ms: durationMs });
    return true;
  } catch (error) {
    const durationMs = Math.round(performance.now() - startedAt);
    recordTelemetry('sync.failure', { duration_ms: durationMs, cursor, message: error instanceof Error ? error.message : 'unknown' });
    capture('sync_failed', { error_code: normalizeErrorCode(error), pending_mutations: pendingMutations });
    return false;
  }
}

let syncCyclePromise: Promise<{ outbox: FlushResult; pulled: boolean }> | null = null;
export function runSyncCycle() {
  if (syncCyclePromise) return syncCyclePromise;
  syncCyclePromise = (async () => {
    const outbox = await flushOutboxQueue();
    const pulled = await executeIncrementalSync();
    return { outbox, pulled };
  })().finally(() => { syncCyclePromise = null; });
  return syncCyclePromise;
}

export { ENTITY_TABLE_MAP };
export type SyncHandler = { name: string; repo: { dirtyFor?: (userId: string) => Promise<unknown[]> } };
export class SyncEngine {
  private handlers: SyncHandler[] = [];
  register(handler: SyncHandler) { if (!this.handlers.some((entry) => entry.name === handler.name)) this.handlers.push(handler); }
  get registeredHandlers() { return [...this.handlers]; }
  async runFull(_userId: string) { void _userId; return executeIncrementalSync(); }
}
export const syncEngine = new SyncEngine();
export async function resetLocalSyncState() {
  const tables = db.tables.filter((table) => table.name !== 'outbox');
  await db.transaction('rw', tables, async () => { await Promise.all(tables.map((table) => table.clear())); });
}
