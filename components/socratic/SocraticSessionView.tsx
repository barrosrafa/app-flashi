'use client';
import { useState } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { translateUiText } from '../../contexts/autoTranslations';
import { socraticService } from '../../lib/services/socratic-service';
import type { SocraticSession } from '../../lib/types/socratic';
export function SocraticSessionView({ session }: { session: SocraticSession }) {
  const { locale } = useTranslation();
  const [status, setStatus] = useState(session.status);
  const [busy, setBusy] = useState(false);
  const tr = (value: string) => translateUiText(value, locale);
  async function resolve() { setBusy(true); try { const result = await socraticService.resolve(session.id); setStatus(result.status); } finally { setBusy(false); } }
  return <section className="card"><h1>{tr('Sessão socrática')}</h1><p>{tr('Card:')} {session.card_id}</p><p>{tr('Status:')} <strong>{tr(status)}</strong></p><pre>{JSON.stringify(session.chat_history, null, 2)}</pre>{status !== 'completed' && <button className="btn" type="button" disabled={busy} onClick={() => void resolve()}>{tr(busy ? 'Concluindo…' : 'Resolver e retomar card')}</button>}</section>;
}
