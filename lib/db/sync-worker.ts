import { isFeatureEnabled } from '../feature-flags';
import { runSyncCycle } from './sync-engine';
import { captureException } from '../observability';

let stopCurrent: (() => void) | undefined;
export function startSyncWorker(intervalMs = 60_000) {
  if (typeof window === 'undefined' || !isFeatureEnabled('sync_worker') || stopCurrent) return () => undefined;
  let running = false;
  const sync = async () => {
    if (running || !navigator.onLine) return;
    running = true;
    try {
      await runSyncCycle();
    } catch (error) {
      if (!(error instanceof Error && error.message === 'AUTH_REQUIRED')) {
        captureException(error, { tags: { area: 'sync_worker' } });
      }
    } finally {
      running = false;
    }
  };
  const timer = window.setInterval(sync, intervalMs);
  const onOnline = () => void sync();
  const onFocus = () => void sync();
  window.addEventListener('online', onOnline);
  window.addEventListener('focus', onFocus);
  void sync();
  stopCurrent = () => {
    window.clearInterval(timer);
    window.removeEventListener('online', onOnline);
    window.removeEventListener('focus', onFocus);
    stopCurrent = undefined;
  };
  return stopCurrent;
}
