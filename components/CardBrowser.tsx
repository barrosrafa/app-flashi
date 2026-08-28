'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { archiveCard, createCard, listCards, type Flashcard } from '../lib/services/card-service';
import type { Json } from '../src/types/database';

function fieldText(fields: Json, key: string) {
  if (fields !== null && typeof fields === 'object' && !Array.isArray(fields)) {
    const value = fields[key];
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  }
  return '';
}

export default function CardBrowser({ deckId }: { deckId: string }) {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [tags, setTags] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  async function load() {
    try {
      setCards(await listCards(deckId));
      setMessage('');
    } catch {
      setMessage('Entre na sua conta para carregar cards do Supabase.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [deckId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await createCard({ deckId, front, back, tags: tags.split(/\s+/).filter(Boolean) });
      setFront('');
      setBack('');
      setTags('');
      setMessage('Card inserido pelo contrato transacional do Supabase.');
      await load();
    } catch (reason: unknown) {
      setMessage(reason instanceof Error && reason.message === 'AUTH_REQUIRED'
        ? 'Entre na sua conta para inserir cards.'
        : 'Não foi possível inserir o card.');
    }
  }

  async function remove(card: Flashcard) {
    try {
      await archiveCard(card.id);
      setMessage('Card arquivado no Supabase.');
      await load();
    } catch {
      setMessage('Não foi possível arquivar o card.');
    }
  }

  const normalizedQuery = query.toLowerCase();
  const visible = cards.filter((card) => `${fieldText(card.fields, 'front')} ${fieldText(card.fields, 'back')}`.toLowerCase().includes(normalizedQuery));

  return <section className="card" style={{ marginTop: 20 }}>
    <div className="section-head"><div><h2>Cards do deck</h2><p className="muted">CRUD real em `notes` + `cards`, com criação transacional e campos JSONB.</p></div><span className="pill">{cards.length} ativos</span></div>
    {message && <div className="notice" style={{ marginBottom: 16 }} role="status">{message}</div>}
    <form className="form" onSubmit={submit}><div className="field"><label htmlFor="card-front">Frente</label><textarea id="card-front" value={front} onChange={(event) => setFront(event.target.value)} placeholder="Pergunta ou conceito" required /></div><div className="field"><label htmlFor="card-back">Verso</label><textarea id="card-back" value={back} onChange={(event) => setBack(event.target.value)} placeholder="Resposta ou explicação" required /></div><div className="field"><label htmlFor="card-tags">Tags</label><input id="card-tags" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="ex.: prova revisão" /></div><button className="btn" type="submit">Adicionar card no Supabase</button></form>
    <div className="field" style={{ marginTop: 20 }}><label htmlFor="card-search">Buscar cards</label><input id="card-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filtrar frente ou verso" /></div>
    {loading ? <p className="muted">Carregando cards…</p> : visible.length === 0 ? <p className="muted">Nenhum card remoto encontrado.</p> : <div className="table-wrap"><table><thead><tr><th>Frente</th><th>Verso</th><th>Ação</th></tr></thead><tbody>{visible.map((card) => <tr key={card.id}><td>{fieldText(card.fields, 'front') || fieldText(card.fields, 'Front')}</td><td>{fieldText(card.fields, 'back') || fieldText(card.fields, 'Back')}</td><td><button className="link-button" type="button" onClick={() => void remove(card)}>Arquivar</button></td></tr>)}</tbody></table></div>}
  </section>;
}
