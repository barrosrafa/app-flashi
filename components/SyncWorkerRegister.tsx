'use client';
import { useEffect } from 'react';
import { startSyncWorker } from '../lib/db/sync-worker';
import { createClient } from '../lib/supabase/client';
import { resetLocalSyncState } from '../lib/db/sync-engine';
export function SyncWorkerRegister() {
  useEffect(() => {
    const supabase = createClient();
    let currentUserId: string | null = null;
    let stopped = false;
    void supabase.auth.getUser().then(({ data }) => { currentUserId = data.user?.id ?? null; if (!stopped) startSyncWorker(); });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUserId = session?.user.id ?? null;
      if (event === 'SIGNED_IN' && currentUserId && currentUserId !== nextUserId) {
        window.setTimeout(() => void resetLocalSyncState().then(() => startSyncWorker()), 0);
      } else if (event === 'SIGNED_OUT' || (currentUserId && currentUserId !== nextUserId)) {
        window.setTimeout(() => void resetLocalSyncState(), 0);
      }
      currentUserId = nextUserId;
    });
    return () => { stopped = true; listener.subscription.unsubscribe(); };
  }, []);
  return null;
}
