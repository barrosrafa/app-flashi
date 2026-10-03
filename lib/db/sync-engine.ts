import { createClient } from '../supabase/client';
import { db, SYNC_TABLES, type SyncableRecord, type SyncTableName } from './schema';
import { recordTelemetry } from './telemetry';
type SyncChange = { entity_type: string; entity_key: string; usn: number; is_deleted?: boolean; payload?: SyncableRecord | null };
type SyncResponse = SyncChange[] | { records?: SyncChange[]; graves?: SyncChange[]; changes?: SyncChange[]; next_usn?: number };
const ENTITY_TABLE_MAP: Record<string, SyncTableName> = Object.fromEntries(SYNC_TABLES.map((table) => [table, table]));
Object.assign(ENTITY_TABLE_MAP, { deck:'decks', card:'cards', card_learning_state:'card_learning_state', review_log:'review_logs', deck_exam:'deck_exams' });
function normalize(data: SyncResponse | null) { if (Array.isArray(data)) return { records:data.filter((c) => !c.is_deleted), graves:data.filter((c) => c.is_deleted), nextUsn:undefined }; return { records:data?.records ?? data?.changes ?? [], graves:data?.graves ?? [], nextUsn:data?.next_usn }; }
export async function executeIncrementalSync(): Promise<boolean> {
  const startedAt = performance.now(); const cursor = (await db.sync_meta.get('last_usn'))?.value ?? 0;
  try {
    const { data, error } = await createClient().rpc('get_incremental_sync', { p_after_usn:cursor, p_limit:500 }); if (error) throw error;
    const { records, graves, nextUsn } = normalize(data as SyncResponse | null); const all = [...graves, ...records].sort((a,b) => Number(a.usn)-Number(b.usn));
    const highestUsn = nextUsn ?? all.reduce((max, change) => Math.max(max, Number(change.usn) || max), cursor);
    await db.transaction('rw', db.tables, async () => {
      for (const change of graves) { const table = ENTITY_TABLE_MAP[change.entity_type]; if (table) await db.table(table).delete(change.entity_key); }
      for (const change of records) { const table = ENTITY_TABLE_MAP[change.entity_type]; if (table && change.payload) await db.table(table).put({ ...change.payload, id:change.payload.id ?? change.entity_key, usn:change.usn }); }
      if (highestUsn > cursor) await db.sync_meta.put({ key:'last_usn', value:highestUsn });
    });
    recordTelemetry('sync.success', { duration_ms:Math.round(performance.now()-startedAt), changes:all.length, cursor:highestUsn }); return true;
  } catch (error) { recordTelemetry('sync.failure', { duration_ms:Math.round(performance.now()-startedAt), cursor, message:error instanceof Error ? error.message : 'unknown' }); return false; }
}
export { ENTITY_TABLE_MAP };
