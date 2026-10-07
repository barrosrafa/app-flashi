'use client';
import { useCallback, useEffect, useState } from 'react';
import { flushOutboxQueue, getOutboxStatus, retryOutboxItem } from '../lib/db/outbox-queue';
import { runSyncCycle } from '../lib/db/sync-engine';
import { captureException } from '../lib/observability';

type Status = Awaited<ReturnType<typeof getOutboxStatus>>;
export function SyncStatusPanel() {
  const [status, setStatus] = useState<Status>({ pending: 0, failed: 0, items: [] });
  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    try { setStatus(await getOutboxStatus()); }
    catch (error) {
      if (!(error instanceof Error && error.message === 'AUTH_REQUIRED')) captureException(error, { tags: { area: 'sync_status_panel' } });
      setStatus({ pending: 0, failed: 0, items: [] });
    }
  }, []);
  useEffect(() => {
    setOnline(navigator.onLine);
    void refresh();
    const onChange = () => { setOnline(navigator.onLine); void refresh(); };
    window.addEventListener('online', onChange);
    window.addEventListener('offline', onChange);
    const timer = window.setInterval(() => void refresh(), 5_000);
    return () => { window.removeEventListener('online', onChange); window.removeEventListener('offline', onChange); window.clearInterval(timer); };
  }, [refresh]);
  async function syncNow() {
    setBusy(true);
    try { await runSyncCycle(); await refresh(); }
    finally { setBusy(false); }
  }
  async function retry(id: string) {
    setBusy(true);
    try { await retryOutboxItem(id); await flushOutboxQueue(); await refresh(); }
    finally { setBusy(false); }
  }
  const label = !online ? 'Offline · dados locais disponíveis' : status.pending ? `${status.pending} alteração(ões) aguardando sincronização` : 'Nenhuma alteração pendente neste dispositivo';
  return <div className="sidebar-sync" aria-live="polite">
    <div className="sidebar-sync-head"><span className={`status-dot ${online ? '' : 'offline'}`} aria-hidden="true" /> <span>{label}</span></div>
    {status.failed > 0 && <button className="link-button" type="button" onClick={() => void retry(status.items.find((item) => item.retries > 0 || item.quarantined)?.id ?? '')} disabled={busy}>Tentar novamente ({status.failed})</button>}
    {(status.pending > 0 || !online) && <button className="link-button" type="button" onClick={() => void syncNow()} disabled={busy}>{busy ? 'Sincronizando…' : 'Sincronizar agora'}</button>}
  </div>;
}
