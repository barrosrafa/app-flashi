import { createClient } from '../../lib/supabase/client';
import { resetAnalytics, setUser } from '../../lib/observability';
import { resetLocalSyncState } from '../../lib/db/sync-engine';

/** Performs an explicit local privacy cleanup after signing out. */
export async function executeStrictLogout(): Promise<void> {
  const { error } = await createClient().auth.signOut();
  if (error) throw error;
  resetAnalytics();
  setUser(null);
  await resetLocalSyncState();
  if (typeof window !== 'undefined' && 'caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.includes('private-app-data') || key.includes('next-data')).map((key) => caches.delete(key)));
  }
  if (typeof window !== 'undefined') window.location.replace('/login');
}
