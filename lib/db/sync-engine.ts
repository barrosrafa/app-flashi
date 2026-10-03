import { invokeEdge } from '../services/http/edge-client';
import { createClient } from '../supabase/client';
import { db, SYNC_TABLES, type SyncableRecord, type SyncTableName } from './schema';
import { recordTelemetry } from './telemetry';
type SyncChange = { entity_type: string; entity_key: string; usn: number | string; is_deleted?: boolean; payload?: SyncableRecord | null };
type SyncResponse = { data?: SyncChange[]; next_usn?: string | number; has_more?: boolean; cursor_commit_rule?: string } | SyncChange[];
const ENTITY_TABLE_MAP: Record<string, SyncTableName> = Object.fromEntries(SYNC_TABLES.map((table) => [table, table]));
Object.assign(ENTITY_TABLE_MAP, {
  deck:'decks', card:'cards', note:'notes', card_media:'card_media', card_learning_state:'card_learning_state', review_log:'review_logs',
  tag:'tags', card_template:'card_templates', study_settings:'study_settings', user_deck_settings:'user_deck_settings', daily_statistics:'daily_statistics',
  note_card_definition:'note_card_definitions', note_cloze_deletion:'note_cloze_deletions', fsrs_optimization_run:'fsrs_optimization_runs',
  ai_ingestion_job:'ai_ingestion_jobs', note_image_occlusion_box:'note_image_occlusion_boxes', note_reference:'note_references',
  user_gamification_profile:'user_gamification_profiles', profile:'profiles', mcp_tool_audit:'mcp_tool_audit', user_badge:'user_badges', deck_exam:'deck_exams', socratic_remediation_session:'socratic_remediation_sessions', card_tag:'card_tags'
});
function normalize(data: SyncResponse | null) { const rows = Array.isArray(data) ? data : data?.data ?? []; return { records: rows.filter((c) => !c.is_deleted), graves: rows.filter((c) => c.is_deleted), nextUsn: Array.isArray(data) ? undefined : data?.next_usn }; }
export async function executeIncrementalSync(): Promise<boolean> {
  const startedAt = performance.now();
  const { data: { user } } = await createClient().auth.getUser();
  if (!user) return false;
  const cursorKey = `last_usn:${user.id}`;
  const cursor = (await db.sync_meta.get(cursorKey))?.value ?? '0';
  try {
    const data = await invokeEdge<SyncResponse>('sync', { body: { last_usn: cursor, limit: 500 } });
    const { records, graves, nextUsn } = normalize(data as SyncResponse | null); const all = [...graves, ...records].sort((a,b) => Number(a.usn)-Number(b.usn));
    const highestUsn = String(nextUsn ?? all.reduce((max, change) => BigInt(String(change.usn)) > BigInt(max) ? String(change.usn) : max, cursor));
    await db.transaction('rw', db.tables, async () => {
      for (const change of graves) { const table = ENTITY_TABLE_MAP[change.entity_type]; if (table) await db.table(table).put({ id: change.entity_key, ...(change.payload ?? {}), deleted_at: (change.payload as { deleted_at?: string } | null)?.deleted_at ?? new Date().toISOString(), usn: String(change.usn), user_id: user.id, _dirty: 0, _synced_at: new Date().toISOString() } as never); }
      for (const change of records) { const table = ENTITY_TABLE_MAP[change.entity_type]; if (table && change.payload) await db.table(table).put({ ...change.payload, id:change.payload.id ?? change.entity_key, usn:change.usn, _dirty: 0, _synced_at: new Date().toISOString() }); }
      if (BigInt(highestUsn) > BigInt(cursor)) await db.sync_meta.put({ key: cursorKey, value:highestUsn, user_id:user.id });
    });
    recordTelemetry('sync.success', { duration_ms:Math.round(performance.now()-startedAt), changes:all.length, cursor:highestUsn }); return true;
  } catch (error) { recordTelemetry('sync.failure', { duration_ms:Math.round(performance.now()-startedAt), cursor, message:error instanceof Error ? error.message : 'unknown' }); return false; }
}
export { ENTITY_TABLE_MAP };
export type SyncHandler = { name: string; repo: { dirtyFor?: (userId: string) => Promise<unknown[]> } };
export class SyncEngine {
  private handlers: SyncHandler[] = [];
  register(handler: SyncHandler) { this.handlers.push(handler); }
  get registeredHandlers() { return [...this.handlers]; }
  async runFull(_userId: string) { return executeIncrementalSync(); }
}
export const syncEngine = new SyncEngine();

export async function resetLocalSyncState() {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.filter((table) => table.name !== 'sync_meta').map((table) => table.clear()));
    await db.sync_meta.clear();
  });
}
