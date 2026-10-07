'use client';
import { useState } from 'react';
import { useTranslation, type TranslationKey } from '../../contexts/LanguageContext';
import { socraticService } from '../../lib/services/socratic-service';
import type { SocraticSession, SocraticStatus } from '../../lib/types/socratic';

const statusKeys: Record<SocraticStatus, TranslationKey> = {
  queued: 'socratic.statusQueued',
  processing: 'socratic.statusProcessing',
  completed: 'socratic.statusCompleted',
  failed: 'socratic.statusFailed',
};

export function SocraticSessionView({ session }: { session: SocraticSession }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState(session.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function resolve() {
    setBusy(true);
    setError(false);
    try {
      const result = await socraticService.resolve(session.id);
      setStatus(result.status);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return <section className="card socratic-session" aria-labelledby="socratic-session-title">
    <h1 id="socratic-session-title">{t('socratic.sessionTitle')}</h1>
    <p>{t('socratic.cardLabel')}: {session.card_id}</p>
    <p>{t('socratic.statusLabel')}: <strong>{t(statusKeys[status])}</strong></p>
    <pre aria-label={t('socratic.sessionTitle')}>{JSON.stringify(session.chat_history, null, 2)}</pre>
    {error && <p className="notice error" role="alert">{t('socratic.detailError')}</p>}
    {status !== 'completed' && <button className="btn" type="button" disabled={busy} onClick={() => void resolve()}>{t(busy ? 'socratic.resolving' : 'socratic.resolve')}</button>}
  </section>;
}
