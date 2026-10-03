import { syncEngine } from './sync-engine';
import { db, SYNC_TABLES } from './schema';
import { BaseRepository } from './repositories/base-repository';
let registered = false;
export function registerAllHandlers() {
  if (registered) return;
  registered = true;
  for (const name of SYNC_TABLES) syncEngine.register({ name, repo: new BaseRepository(db.table(name) as any) });
}
