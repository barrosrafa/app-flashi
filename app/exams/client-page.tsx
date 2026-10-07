'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AppShell, Topbar } from '../../components/AppShell';
import { cancelDeckExam, completeDeckExam, createDeckExam, listDeckExams, pauseDeckExam, reactivateDeckExam, removeDeckExam, updateDeckExam, type DeckExam, type ExamPriority } from '../../lib/services/exam-service';
import { listDecks, type Deck } from '../../lib/services/deck-service';
import { isEnabled } from '../../lib/config/feature-flags';
import { createExamGoal } from '../../lib/services/exam-goal';

const priorities: ExamPriority[] = ['exam_urgent', 'currently_studying', 'maintaining', 'paused'];
const priorityLabels: Record<ExamPriority, string> = {
  exam_urgent: 'Exame urgente',
  currently_studying: 'Estudando agora',
  maintaining: 'Manutenção',
  paused: 'Pausado',
};
const statusLabels: Record<string, string> = {
  active: 'Ativa',
  paused: 'Pausada',
  completed: 'Concluída',
  cancelled: 'Cancelada',
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
  const [submitting, setSubmitting] = useState(false);
  const submissionLock = useRef(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDeckId, setEditDeckId] = useState('');
  const [editTargetDate, setEditTargetDate] = useState('');
  const [editPriority, setEditPriority] = useState<ExamPriority>('currently_studying');
  const [actionId, setActionId] = useState<string | null>(null);

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
    // F07 — duplo clique não pode criar duas metas iguais.
    if (submissionLock.current) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const deckId = String(form.get('deck_id') ?? '');
    const examName = String(form.get('exam_name') ?? '').trim();
    const targetDate = String(form.get('target_date') ?? '');
    const priorityValue = String(form.get('priority_level') ?? '');

    if (!deckId || !examName || !targetDate || !isPriority(priorityValue)) {
      setMessage('Preencha todos os campos da meta.');
      return;
    }

    submissionLock.current = true;
    setSubmitting(true);
    setMessage('');
    // F07 — persistência, atualização da lista e limpeza do formulário são
    // etapas separadas; nenhuma falha de interface pode mascarar um salvamento.
    const result = await createExamGoal<DeckExam>({
      create: () => createDeckExam(deckId, examName, targetDate, priorityValue),
      onCreated: (created) => {
        setExams((current) => [created, ...current.filter((item) => item.id !== created.id)]);
        setMessage('Meta criada e salva.');
      },
      resetForm: () => formElement.reset(),
    });
    if (!result.ok) {
      const reason = result.error;
      setMessage(reason instanceof Error && reason.message === 'AUTH_REQUIRED'
        ? 'Entre na sua conta para criar uma meta.'
        : 'Não foi possível salvar a meta.');
    }
    submissionLock.current = false;
    setSubmitting(false);
  }

  function beginEdit(exam: DeckExam) {
    setEditingId(exam.id);
    setEditName(exam.exam_name);
    setEditDeckId(exam.deck_id);
    setEditTargetDate(exam.target_date);
    setEditPriority(exam.priority_level);
    setMessage('');
  }

  function replaceExam(updated: DeckExam) {
    setExams((current) => current.map((exam) => exam.id === updated.id ? updated : exam));
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId || actionId) return;
    const name = editName.trim();
    if (!name || !editDeckId || !editTargetDate || !isPriority(editPriority)) {
      setMessage('Preencha nome, deck, prazo e prioridade.');
      return;
    }
    setActionId(editingId);
    setError('');
    try {
      const updated = await updateDeckExam(editingId, {
        exam_name: name,
        deck_id: editDeckId,
        target_date: editTargetDate,
        priority_level: editPriority,
      });
      replaceExam(updated);
      setEditingId(null);
      setMessage('Meta atualizada e planejamento recalculado.');
    } catch {
      setError('Não foi possível atualizar a meta. Tente novamente.');
    } finally {
      setActionId(null);
    }
  }

  async function changeStatus(exam: DeckExam, status: 'paused' | 'completed' | 'cancelled' | 'active') {
    if (actionId) return;
    setActionId(exam.id);
    setError('');
    try {
      const updated = status === 'paused'
        ? await pauseDeckExam(exam.id)
        : status === 'completed'
          ? await completeDeckExam(exam.id)
          : status === 'cancelled'
            ? await cancelDeckExam(exam.id)
            : await reactivateDeckExam(exam.id, exam.priority_level);
      replaceExam(updated);
      setMessage(status === 'active' ? 'Meta reativada e incluída no planejamento.' : `Meta ${statusLabels[status].toLowerCase()}.`);
    } catch {
      setError('Não foi possível alterar o estado da meta. Tente novamente.');
    } finally {
      setActionId(null);
    }
  }

  async function remove(exam: DeckExam) {
    if (actionId) return;
    setActionId(exam.id);
    setError('');
    try {
      await removeDeckExam(exam.id);
      setExams((current) => current.filter((item) => item.id !== exam.id));
      setMessage('Meta removida.');
    } catch {
      setError('Não foi possível remover a meta. Tente novamente.');
    } finally {
      setActionId(null);
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
          <div className="field"><label htmlFor="deck_id">Deck</label><select id="deck_id" name="deck_id" required defaultValue="">{decks.length ? <><option value="" disabled>Selecione um deck</option>{decks.map((deck) => <option data-user-content="" value={deck.id} key={deck.id}>{deck.name}</option>)}</> : <option value="">Nenhum deck disponível</option>}</select></div>
          <div className="field"><label htmlFor="target_date">Data-alvo</label><input id="target_date" name="target_date" required type="date" /></div>
          <div className="field"><label htmlFor="priority_level">Prioridade</label><select id="priority_level" name="priority_level" defaultValue="currently_studying">{priorities.map((priority) => <option value={priority} key={priority}>{priorityLabels[priority]}</option>)}</select></div>
          <button className="btn" type="submit" disabled={!decks.length || submitting}>{submitting ? 'Salvando…' : 'Salvar meta'}</button>
          {message && <div className="notice" role="status">{message}</div>}
        </form>
      </div>
      <div className="section-head"><h2>Metas ativas ({exams.filter((exam) => exam.status === 'active').length})</h2></div>
      <div className="grid deck-grid">{exams.map((exam) => <div className="card" key={exam.id}>
        {editingId === exam.id ? <form className="form" onSubmit={(event) => void saveEdit(event)}>
          <div className="field"><label htmlFor={`edit-name-${exam.id}`}>Nome da meta</label><input id={`edit-name-${exam.id}`} value={editName} onChange={(event) => setEditName(event.target.value)} required /></div>
          <div className="field"><label htmlFor={`edit-deck-${exam.id}`}>Deck</label><select id={`edit-deck-${exam.id}`} value={editDeckId} onChange={(event) => setEditDeckId(event.target.value)} required>{decks.map((deck) => <option data-user-content="" value={deck.id} key={deck.id}>{deck.name}</option>)}</select></div>
          <div className="field"><label htmlFor={`edit-date-${exam.id}`}>Data-alvo</label><input id={`edit-date-${exam.id}`} type="date" value={editTargetDate} onChange={(event) => setEditTargetDate(event.target.value)} required /></div>
          <div className="field"><label htmlFor={`edit-priority-${exam.id}`}>Prioridade</label><select id={`edit-priority-${exam.id}`} value={editPriority} onChange={(event) => { if (isPriority(event.target.value)) setEditPriority(event.target.value); }}>{priorities.map((priority) => <option value={priority} key={priority}>{priorityLabels[priority]}</option>)}</select></div>
          <div className="section-head-actions"><button className="btn" type="submit" disabled={actionId === exam.id}>{actionId === exam.id ? 'Salvando…' : 'Salvar alterações'}</button><button className="btn ghost" type="button" onClick={() => setEditingId(null)} disabled={actionId === exam.id}>Cancelar edição</button></div>
        </form> : <>
          <div className="eyebrow">{statusLabels[exam.status] ?? exam.status} · {priorityLabels[exam.priority_level]}</div>
          <h3><span data-user-content="">{exam.exam_name}</span></h3>
          <p className="subtitle">Deck: {decks.find((deck) => deck.id === exam.deck_id)?.name ?? '—'} · Data-alvo: {exam.target_date}</p>
          <div className="section-head-actions">
            <button className="btn secondary" type="button" onClick={() => beginEdit(exam)} disabled={Boolean(actionId)}>Editar</button>
            {exam.status === 'active' && <><button className="btn ghost" type="button" onClick={() => void changeStatus(exam, 'paused')} disabled={Boolean(actionId)}>Pausar</button><button className="btn ghost" type="button" onClick={() => void changeStatus(exam, 'completed')} disabled={Boolean(actionId)}>Concluir</button><button className="btn ghost" type="button" onClick={() => void changeStatus(exam, 'cancelled')} disabled={Boolean(actionId)}>Cancelar</button></>}
            {exam.status !== 'active' && <button className="btn secondary" type="button" onClick={() => void changeStatus(exam, 'active')} disabled={Boolean(actionId)}>Reativar</button>}
            {exam.status === 'cancelled' && <button className="btn ghost" type="button" onClick={() => void remove(exam)} disabled={Boolean(actionId)}>Remover</button>}
          </div>
        </>}
      </div>)}</div>
      {!exams.length && !error && <div className="card empty-state">Nenhuma meta ativa para os seus decks.</div>}
    </AppShell>
  );
}
