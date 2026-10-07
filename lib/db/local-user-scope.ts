import { db } from './schema';
const STORAGE_KEY = 'flashi:local-cache-user:v1';
let inMemoryUserId: string | null = null;
let scopeChain: Promise<void> = Promise.resolve();
async function clearUserScopedCache() {
  const tables = db.tables.filter((table) => table.name !== 'outbox');
  await db.transaction('rw', tables, async () => { await Promise.all(tables.map((table) => table.clear())); });
}
function serializeScope(operation: () => Promise<void>) {
  const next = scopeChain.catch(() => undefined).then(operation);
  scopeChain = next;
  return next;
}
/** Single-account cache; pending outbox mutations remain owner-partitioned. */
export function bindLocalUserNamespace(userId: string) {
  return serializeScope(async () => {
    if (typeof window === 'undefined' || !userId) return;
    let stored: string | null = null;
    let available = true;
    try { stored = window.localStorage.getItem(STORAGE_KEY); } catch { available = false; }
    if ((available ? stored : inMemoryUserId) !== userId) await clearUserScopedCache();
    inMemoryUserId = userId;
    try { window.localStorage.setItem(STORAGE_KEY,userId); } catch { /* in-memory fallback */ }
  });
}
export function unbindLocalUserNamespace() {
  return serializeScope(async () => {
    if (typeof window === 'undefined') return;
    await clearUserScopedCache();
    inMemoryUserId = null;
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* unavailable storage */ }
  });
}

/** Cache writes and namespace switches share one lock; outbox ownership is never changed. */
export function withLocalUserNamespace<T>(userId:string,operation:()=>Promise<T>):Promise<T> {
 let value:T;
 return serializeScope(async()=>{
  let current=inMemoryUserId;
  try { current=window.localStorage.getItem(STORAGE_KEY); } catch { /* memory fallback */ }
  if(current!==userId)throw new Error('AUTH_ACCOUNT_CHANGED');
  value=await operation();
 }).then(()=>value!);
}
