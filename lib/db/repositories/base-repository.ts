import type { Table } from 'dexie';
import type { SyncableRecord } from '../schema';
export class BaseRepository<T extends SyncableRecord = SyncableRecord> {
  constructor(protected table: Table<T, string>) {}
  async create(partial: Omit<T, 'id' | 'usn'> & Partial<Pick<T, 'id' | 'usn'>>): Promise<T> { const row = { ...partial, id: partial.id ?? crypto.randomUUID(), usn: partial.usn ?? 0, updated_at: partial.updated_at ?? new Date().toISOString(), _dirty: 1 } as unknown as T; await this.table.put(row); return row; }
  async update(id: string, patch: Partial<T>) { await this.table.update(id, { ...patch, updated_at: new Date().toISOString(), _dirty: 1 } as never); }
  async softDelete(id: string) { await this.update(id, { deleted_at: new Date().toISOString() } as unknown as Partial<T>); }
  get(id: string) { return this.table.get(id); }
  listByUser(userId: string) { return this.table.where('user_id').equals(userId).toArray(); }
  dirtyFor(userId: string) { return this.table.where('user_id').equals(userId).filter((row) => row._dirty === 1).toArray(); }
  async markSynced(ids: string[]) { await this.table.where('id').anyOf(ids).modify({ _dirty: 0, _synced_at: new Date().toISOString() } as never); }
  async bulkUpsertFromServer(rows: T[]) { await this.table.bulkPut(rows.map((row) => ({ ...row, _dirty: 0, _synced_at: new Date().toISOString() })) as T[]); }
}
