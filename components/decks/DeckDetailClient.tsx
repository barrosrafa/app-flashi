'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AppShell, Topbar } from '../AppShell';
import CardBrowser from '../CardBrowser';
import { CollaboratorManager } from './CollaboratorManager';
import { DeckSettingsForm } from './DeckSettingsForm';
import { listDecks, updateDeck, archiveDeck, softDeleteDeck, type Deck, type DeckVisibility } from '../../lib/services/deck-service';
import { NoteWorkspace } from '../notes/NoteWorkspace';
import { MediaManager } from '../MediaManager';

export function DeckDetailClient({ deckId }: { deckId: string }) {
  const [deck, setDeck] = useState<Deck | null>(null);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<DeckVisibility>('private');
  const [parentDeckId, setParentDeckId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await listDecks();
      const current = rows.find((row) => row.id === deckId) ?? null;
      setDecks(rows);
      setDeck(current);
      if (current) {
        setName(current.name);
        setDescription(current.description ?? '');
        setVisibility(current.visibility);
        setParentDeckId(current.parent_deck_id);
      }
    } catch (reason: unknown) {
      setError(reason instanceof Error && reason.message === 'AUTH_REQUIRED' ? 'Entre na sua conta para abrir este deck.' : 'Não foi possível carregar este deck.');
    }
  }, [deckId]);

  useEffect(() => { void load(); }, [load]);

  async function save() {
    setBusy(true);
    setMessage('');
    try {
      await updateDeck(deckId, { name, description: description.trim() || null, visibility, parent_deck_id: parentDeckId === deckId ? null : parentDeckId });
      await load();
      setEditing(false);
      setMessage('Dados do deck atualizados.');
    } catch (reason: unknown) {
      setMessage(reason instanceof Error ? reason.message : 'Não foi possível salvar o deck.');
    } finally {
      setBusy(false);
    }
  }

  async function moveToArchive(remove: boolean) {
    setBusy(true);
    try {
      if (remove) await softDeleteDeck(deckId);
      else await archiveDeck(deckId);
      window.location.href = '/decks';
    } catch (reason: unknown) {
      setMessage(reason instanceof Error ? reason.message : 'Não foi possível arquivar o deck.');
      setBusy(false);
    }
  }

  return <AppShell>
    <Topbar titleIsUserContent title={deck?.name ?? 'Deck'} subtitle={deck?.description ?? 'Resumo, conteúdo e próxima revisão deste deck.'} />
    {error && <div className="notice error" role="alert">{error}</div>}
    {!error && !deck && <div className="card" role="status">Carregando deck…</div>}
    {deck && <>
      <section className="card deck-detail-summary" aria-labelledby="deck-summary-heading">
        <div className="section-head compact-head">
          <div><div className="eyebrow">Resumo do deck</div><h1 id="deck-summary-heading"><span data-user-content="">{deck.name}</span></h1><p className="subtitle">{deck.description || 'Escolha um conteúdo abaixo ou comece uma revisão.'}</p></div>
          <Link className="btn" href={`/study/${deckId}`}>Estudar agora <span aria-hidden="true">→</span></Link>
        </div>
        <div className="grid stats deck-summary" aria-label="Resumo do deck"><article className="card"><div className="stat-label">Cartões</div><div className="stat-value">{deck.cardCount}</div></article><article className="card"><div className="stat-label">Para revisar</div><div className="stat-value accent">{deck.reviewCount}</div></article><article className="card"><div className="stat-label">Cards em etapa de revisão</div><div className="stat-value">{deck.progress}%</div></article></div>
      </section>

      {message && <div className="notice" role="status">{message}</div>}

      <section aria-labelledby="deck-content-heading">
        <div className="section-head"><div><h2 id="deck-content-heading">Conteúdo do deck</h2><p className="subtitle">Crie, encontre e organize notas e cards sem sair desta página.</p></div><div className="section-head-actions"><Link className="btn secondary" href={`/decks/${deckId}/cards`}>Abrir cards</Link><Link className="btn secondary" href={`/decks/${deckId}/notes`}>Abrir notas</Link></div></div>
        <CardBrowser deckId={deckId} />
        <NoteWorkspace deckId={deckId} />
      </section>

      <details className="card" style={{ marginTop: 22 }}>
        <summary>Mídia e anexos</summary>
        <p className="subtitle">Upload, associação, visualização e remoção de mídias continuam disponíveis quando necessário.</p>
        <MediaManager deckId={deckId} />
      </details>

      <details className="card" style={{ marginTop: 16 }}>
        <summary>Configurações do deck</summary>
        <p className="subtitle">Ajuste limites de estudo e preferências sem ocupar o resumo principal.</p>
        <DeckSettingsForm deckId={deckId} />
      </details>

      <details className="card" style={{ marginTop: 16 }}>
        <summary>Compartilhamento</summary>
        <p className="subtitle">Gerencie colaboradores e permissões de acesso ao deck.</p>
        <CollaboratorManager deckId={deckId} />
      </details>

      <details className="card" style={{ marginTop: 16 }} open={editing}>
        <summary>Gerenciar deck</summary>
        {editing ? <form className="form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <div className="field"><label htmlFor="deck-name">Nome</label><input id="deck-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required /></div>
          <div className="field"><label htmlFor="deck-description">Descrição</label><textarea id="deck-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={4} /></div>
          <div className="field"><label htmlFor="deck-visibility">Visibilidade</label><select id="deck-visibility" value={visibility} onChange={(event) => setVisibility(event.target.value as DeckVisibility)}><option value="private">Privado</option><option value="shared">Compartilhado</option><option value="public">Público</option></select></div>
          <div className="field"><label htmlFor="deck-parent">Deck pai</label><select id="deck-parent" value={parentDeckId ?? ''} onChange={(event) => setParentDeckId(event.target.value || null)}><option value="">Sem deck pai</option>{decks.filter((item) => item.id !== deckId).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></div>
          <div className="section-head-actions"><button className="btn" type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Salvar alterações'}</button><button className="btn ghost" type="button" onClick={() => setEditing(false)}>Cancelar</button></div>
        </form> : <div className="section-head compact-head"><div><h2>Dados do deck</h2><p className="subtitle">{deck.visibility} · {deck.parent_deck_id ? 'deck hierárquico' : 'raiz'}</p></div><div className="section-head-actions"><button className="btn secondary" type="button" onClick={() => setEditing(true)}>Editar deck</button><button className="btn ghost" type="button" onClick={() => void moveToArchive(false)} disabled={busy}>Arquivar</button><button className="btn ghost" type="button" onClick={() => void moveToArchive(true)} disabled={busy}>Excluir (restaurável)</button></div></div>}
      </details>
    </>}
  </AppShell>;
}
