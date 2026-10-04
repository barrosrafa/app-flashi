'use client';

import { useMachine } from '@xstate/react';
import { useState } from 'react';
import { AppShell, Topbar } from '../../components/AppShell';
import { activationMachine } from '../../lib/activation-machine';
import { processActivation } from '../../lib/services/activation-service';

export default function ActivationClientPage() {
  const [snapshot, send] = useMachine(activationMachine);
  const [goal, setGoal] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [weeklyMinutes, setWeeklyMinutes] = useState('');
  const busy = snapshot.matches('VALIDATING');

  async function submit() {
    if (busy) return;
    send({ type: 'SUBMIT' });
    try {
      const result = await processActivation({
        goal: goal || null,
        target_date: targetDate || null,
        weekly_minutes: weeklyMinutes ? Number(weeklyMinutes) : null,
      });
      send({ type: 'SUCCESS' });
      if (result.request_id) document.body.dataset.lastRequestId = result.request_id;
    } catch (error) {
      const message = error instanceof Error && error.message.includes('AUTH_REQUIRED')
        ? 'Inicie sessão para ativar seu ambiente.'
        : error instanceof Error ? error.message : 'Não foi possível concluir a ativação.';
      send({ type: 'FAILURE', error: message });
    }
  }

  return <AppShell><Topbar title="Ativação" subtitle="Configure sua conta com um fluxo seguro e retomável." /><main className="card form" aria-live="polite">
    {snapshot.matches('PENDING') && <>
      <h1>Ative seu ambiente de estudo</h1>
      <p className="subtitle">Essas preferências são opcionais e podem ser alteradas depois.</p>
      <label>Objetivo<input value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="Ex.: concurso, idioma ou faculdade" /></label>
      <label>Data-alvo<input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} /></label>
      <label>Minutos por semana<input type="number" min="15" max="10080" value={weeklyMinutes} onChange={(event) => setWeeklyMinutes(event.target.value)} placeholder="Opcional" /></label>
      <button className="btn" type="button" onClick={() => void submit()}>Iniciar ativação</button>
    </>}
    {snapshot.matches('VALIDATING') && <section className="empty-state"><h1>Ativando seu ambiente…</h1><p>Validando preferências e preparando sua conta.</p><span className="skeleton" aria-hidden="true" /></section>}
    {snapshot.matches('ACTIVE') && <section className="empty-state"><h1>Ambiente ativo</h1><p>Sua ativação foi concluída com segurança.</p><a className="btn" href="/dashboard">Continuar para o painel</a></section>}
    {snapshot.matches('FAILED') && <section className="empty-state"><h1>Não foi possível ativar</h1><p role="alert">{snapshot.context.error}</p><button className="btn secondary" type="button" onClick={() => send({ type: 'RETRY' })}>Tentar novamente</button></section>}
  </main></AppShell>;
}
