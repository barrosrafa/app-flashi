'use client';

import { useEffect, useState } from 'react';
import { AppShell, Topbar } from '../../components/AppShell';
import { createDeckExam, listDeckExams, type DeckExam, type ExamPriority } from '../../lib/services/exam-service';
import { listDecks, type Deck } from '../../lib/services/deck-service';
import { isEnabled } from '../../lib/config/feature-flags';

const priorities: ExamPriority[] = ['exam_urgent', 'currently_studying', 'maintaining', 'paused'];
const priorityLabels: Record<ExamPriority, string> = {
  exam_urgent: 'Exame urgente',
  currently_studying: 'Estudando agora',
  maintaining: 'Manutenção',
  paused: 'Pausado',
};

function isPriority(value: string): value is ExamPriority {
  return priorities.some((priority) => priority === value);
}

export default function Exams() {
  const enabled = isEnabled('exams');
  const [decks, setDecks] = useState<Deck[]>([]);
  const [exams, setExams] = useState<DeckExam[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!enabled) return;
    Promise.all([listDecks(), listDeckExams()])
      .then(([deckRows, examRows]) => {
        setDecks(deckRows);
        setExams(examRows);
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error && reason.message === 'AUTH_REQUIRED'
          ? 'Entre na sua conta para configurar metas.'
          : 'Não foi possível carregar decks e exames.');
      });
  }, [enabled]);

  if (!enabled) return <AppShell><Topbar title="Metas de estudo" /><div className="card empty-state">Esta funcionalidade está desativada.</div></AppShell>;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const deckId = String(form.get('deck_id') ?? '');
    const examName = String(form.get('exam_name') ?? '').trim();
    const targetDate = String(form.get('target_date') ?? '');
    const priorityValue = String(form.get('priority_level') ?? '');

    if (!deckId || !examName || !targetDate || !isPriority(priorityValue)) {
      setMessage('Preencha todos os campos da meta.');
      return;
    }

    try {
      const created = await createDeckExam(deckId, examName, targetDate, priorityValue);
      setExams((current) => [created, ...current]);
      setMessage('Meta criada e salva.');
      event.currentTarget.reset();
    } catch (reason: unknown) {
      setMessage(reason instanceof Error && reason.message === 'AUTH_REQUIRED'
        ? 'Entre na sua conta para criar uma meta.'
        : 'Não foi possível salvar a meta.');
    }
  }

  return (
    <AppShell>
      <Topbar title="Metas de estudo" subtitle="Organize seus decks de acordo com datas e objetivos importantes." />
      {error && <div className="notice" role="status">{error}</div>}
      <div className="notice" style={{ marginBottom: 18 }}>A agenda de exames reordena sua fila de estudo usando fatores de prioridade do Supabase.</div>
      <div className="card">
        <form className="form" onSubmit={submit}>
          <div className="field"><label htmlFor="exam_name">Nome da meta</label><input id="exam_name" name="exam_name" required placeholder="Ex.: Concurso TJ" /></div>
          <div className="field"><label htmlFor="deck_id">Deck</label><select id="deck_id" name="deck_id" required defaultValue="">{decks.length ? <><option value="" disabled>Selecione um deck</option>{decks.map((deck) => <option value={deck.id} key={deck.id}>{deck.name}</option>)}</> : <option value="">Nenhum deck disponível</option>}</select></div>
          <div className="field"><label htmlFor="target_date">Data-alvo</label><input id="target_date" name="target_date" required type="date" /></div>
          <div className="field"><label htmlFor="priority_level">Prioridade</label><select id="priority_level" name="priority_level" defaultValue="currently_studying">{priorities.map((priority) => <option value={priority} key={priority}>{priorityLabels[priority]}</option>)}</select></div>
          <button className="btn" type="submit" disabled={!decks.length}>Salvar meta</button>
          {message && <div className="notice" role="status">{message}</div>}
        </form>
      </div>
      <div className="section-head"><h2>Metas ativas ({exams.length})</h2></div>
      <div className="grid deck-grid">{exams.map((exam) => <div className="card" key={exam.id}><div className="eyebrow">{priorityLabels[exam.priority_level]}</div><h3>{exam.exam_name}</h3><p className="subtitle">Data-alvo: {exam.target_date}</p></div>)}</div>
      {!exams.length && !error && <div className="card empty-state">Nenhuma meta ativa para os seus decks.</div>}
    </AppShell>
  );
}
