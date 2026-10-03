'use client';
import { useState } from 'react';
import { socraticService } from '../../lib/services/socratic-service';
import type { SocraticSession } from '../../lib/types/socratic';
export function SocraticSessionView({ session }: { session: SocraticSession }) { const [status, setStatus] = useState(session.status); const [busy, setBusy] = useState(false); async function resolve() { setBusy(true); try { const result = await socraticService.resolve(session.id); setStatus(result.status); } finally { setBusy(false); } } return <section className="card"><h1>Sessão socrática</h1><p>Card: {session.card_id}</p><p>Status: <strong>{status}</strong></p><pre>{JSON.stringify(session.chat_history, null, 2)}</pre>{status !== 'completed' && <button className="btn" type="button" disabled={busy} onClick={() => void resolve()}>{busy ? 'Concluindo…' : 'Resolver e retomar card'}</button>}</section>; }
