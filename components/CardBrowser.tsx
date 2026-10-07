'use client';

import { TagSelector } from './tags/TagSelector';
import { ReferenceEditor } from './notes/ReferenceEditor';
import { isEnabled } from '../lib/config/feature-flags';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { archiveCard, createCard, listCardsPage, type Flashcard } from '../lib/services/card-service';
import { hasBrowserSession, isUuid } from '../lib/supabase/guards';
import type { PageCursor } from '../lib/services/pagination';
import type { Json } from '../src/types/database';

function fieldText(fields: Json, key: string) {
  if (fields !== null && typeof fields === 'object' && !Array.isArray(fields)) {
    const value = fields[key];
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  }
  return '';
}

export default function CardBrowser({ deckId }: { deckId: string }) {
  const [cursor, setCursor] = useState<PageCursor | null>(null);
  const loadSequence = useRef(0);
  const submissionLock = useRef(false);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [tags, setTags] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [archivingId, setArchivingId] = useState('');
  const [message, setMessage] = useState('');
  const [messageKind, setMessageKind] = useState<'success' | 'error'>('success');

  const load = useCallback(async (append = false, pageCursor: PageCursor | null = null) => {
    const sequence = ++loadSequence.current;
    setLoading(true);
    if (!isUuid(deckId)) {
      setMessageKind('error');
      setMessage('Este deck não possui um identificador válido. Volte para Meus decks e abra um deck existente.');
      setLoading(false);
      return;
    }
    if (!(await hasBrowserSession())) {
      setMessageKind('error');
      setMessage('Entre na sua conta para carregar cards do Supabase.');
      setLoading(false);
      return;
    }
    try {
      const page = await listCardsPage(deckId, { query, cursor: append ? pageCursor : null });
      if (sequence !== loadSequence.current) return;
      setCards((old) => append ? [...old,...page.items] : page.items);
      setCursor(page.nextCursor);
    } catch {
      setMessageKind('error');
      setMessage('Entre na sua conta para carregar cards do Supabase.');
    } finally {
      setLoading(false);
    }
  }, [deckId,query]);

  useEffect(() => { const timer = window.setTimeout(() => void load(),250); return () => window.clearTimeout(timer); }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionLock.current) return;
    submissionLock.current = true;
    setBusy(true);
    setMessage('');
    try {
      await createCard({ deckId, front: front.trim(), back: back.trim(), tags: tags.split(/\s+/).filter(Boolean) });
      setFront('');
      setBack('');
      setTags('');
      setMessageKind('success');
      setMessage('Card inserido. Ele já está disponível para a próxima revisão.');
      await load();
    } catch (reason: unknown) {
      setMessageKind('error');
      setMessage(reason instanceof Error && reason.message === 'AUTH_REQUIRED' ? 'Entre na sua conta para inserir cards.' : 'Não foi possível inserir o card.');
    } finally {
      submissionLock.current = false;
      setBusy(false);
    }
  }

  async function remove(card: Flashcard) {
    setArchivingId(card.id);
    setMessage('');
    try {
      await archiveCard(card.id);
      setMessageKind('success');
      setMessage('Card arquivado.');
      await load();
    } catch {
      setMessageKind('error');
      setMessage('Não foi possível arquivar o card. Tente novamente.');
    } finally {
      setArchivingId('');
    }
  }

  const visible = cards;

  return <section className="card" style={{ marginTop: 20 }} aria-labelledby="cards-heading">
    <div className="section-head"><div><h2 id="cards-heading">Cards do deck</h2><p className="muted">Crie e encontre cards sem sair desta página.</p></div><span className="pill" aria-label={`${cards.length} cards ativos`}>{cards.length} ativos</span></div>
    {message && <div className={`notice ${messageKind === 'error' ? 'error' : 'success'}`} style={{ marginBottom: 16 }} role={messageKind === 'error' ? 'alert' : 'status'} aria-live="polite">{message}</div>}
    <form className="form" onSubmit={submit}>
      <div className="field"><label htmlFor="card-front">Frente</label><textarea id="card-front" value={front} onChange={(event) => setFront(event.target.value)} placeholder="Pergunta ou conceito" required /></div>
      <div className="field"><label htmlFor="card-back">Verso</label><textarea id="card-back" value={back} onChange={(event) => setBack(event.target.value)} placeholder="Resposta ou explicação" required /></div>
      <div className="field"><label htmlFor="card-tags">Tags <span className="muted">(opcional)</span></label><input id="card-tags" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="ex.: prova revisão" /></div>
      <button className="btn" type="submit" disabled={busy}>{busy ? 'Adicionando card…' : 'Adicionar card'}</button>
    </form>
    <div className="field" style={{ marginTop: 24 }}><label htmlFor="card-search">Buscar cards</label><input id="card-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filtrar por frente ou verso" /></div>
    {loading ? <p className="muted" role="status">Carregando cards…</p> : visible.length === 0 ? <div className="empty-state"><strong>{query ? 'Nenhum card corresponde à busca.' : 'Este deck ainda não tem cards.'}</strong><span>{query ? 'Tente outras palavras.' : 'Use o formulário acima para adicionar o primeiro.'}</span></div> : <div className="table-wrap"><table className="table"><caption className="sr-only">Cards ativos deste deck</caption><thead><tr><th scope="col">Frente</th><th scope="col">Verso</th><th scope="col">Ação</th><th scope="col">Tags</th><th scope="col">Referências</th></tr></thead><tbody>{visible.map((card) => <tr key={card.id}><td data-label="Frente"><span data-user-content="">{fieldText(card.fields, 'front') || fieldText(card.fields, 'Front')}</span></td><td data-label="Verso"><span data-user-content="">{fieldText(card.fields, 'back') || fieldText(card.fields, 'Back')}</span></td><td data-label="Ação"><button className="link-button" type="button" onClick={() => void remove(card)} disabled={Boolean(archivingId)}>{archivingId === card.id ? 'Arquivando…' : 'Arquivar'}</button></td><td data-label="Tags">{isEnabled('tags') ? <details className="card-inline-details"><summary>Editar tags</summary><TagSelector cardId={card.id} /></details> : <span className="muted">Desativadas</span>}</td><td data-label="Referências">{isEnabled('references') && card.note_id ? <details className="card-inline-details"><summary>Notas relacionadas</summary><ReferenceEditor noteId={card.note_id} /></details> : <span className="muted">—</span>}</td></tr>)}</tbody></table></div>}
    {cursor && <button className="btn secondary" type="button" onClick={() => void load(true,cursor)} disabled={loading}>{loading ? 'Carregando…' : 'Carregar mais cartões'}</button>}
  </section>;
}
