'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell, Topbar } from '../../../../../components/AppShell';
import { OcclusionEditor } from '../../../../../components/OcclusionEditor';
import { isEnabled } from '../../../../../lib/config/feature-flags';
import { useTranslation } from '../../../../../contexts/LanguageContext';
import { noteService, type Note } from '../../../../../lib/services/note-service';
import {
  OcclusionMediaAssociationError,
  occlusionService,
  type OcclusionMask,
} from '../../../../../lib/services/occlusion-service';

export default function NewOcclusionPage() {
  const { deckId } = useParams<{ deckId: string }>();
  const { t } = useTranslation();
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteId, setNoteId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [masks, setMasks] = useState<OcclusionMask[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void noteService.list(deckId).then((items) => {
      if (!active) return;
      setNotes(items);
      setNoteId(items[0]?.id ?? '');
    }).catch((reason: unknown) => {
      if (!active) return;
      setError(reason instanceof Error && reason.message === 'AUTH_REQUIRED'
        ? 'Entre na sua conta para carregar as notas.'
        : 'Não foi possível carregar as notas deste deck.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [deckId]);

  useEffect(() => {
    if (!file) {
      setPreview('');
      return undefined;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  function chooseFile(selected?: File) {
    if (!selected) return;
    if (!selected.type.startsWith('image/')) {
      setError('Selecione um arquivo de imagem.');
      return;
    }
    setError('');
    setMessage('Imagem pronta para associar aos cartões.');
    setFile(selected);
    setMasks([]);
  }

  async function save() {
    if (!noteId || !file || !masks.length) {
      setError('Selecione uma nota, uma imagem e pelo menos uma região.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await occlusionService.createForDeck({ deckId, noteId, masks, imageFile: file });
      setMessage(`${result.cards.length} cartão(ões) criado(s) e imagem associada a todos.`);
    } catch (reason: unknown) {
      if (reason instanceof OcclusionMediaAssociationError) {
        setError(`${reason.cardsCreated} cartão(ões) foram criados; imagem anexada a ${reason.mediaAttached}. Reenvie a imagem aos cartões sem mídia.`);
      } else {
        const code = reason instanceof Error ? reason.message : '';
        setError(code === 'AUTH_REQUIRED' ? 'Entre na sua conta para criar oclusões.'
          : code === 'NOTE_NOT_IN_DECK' ? 'A nota selecionada não pertence a este deck.'
          : code === 'NOTE_NOT_FOUND' ? 'A nota não foi encontrada.'
          : 'Não foi possível criar a oclusão. Tente novamente.');
      }
    } finally {
      setBusy(false);
    }
  }

  if (!isEnabled('occlusion')) {
    return <AppShell><Topbar title="Oclusão" /><div className="card empty-state">Esta funcionalidade está desativada.</div></AppShell>;
  }

  return <AppShell>
    <Topbar title="Nova oclusão de imagem" subtitle="Selecione uma nota deste deck e associe a imagem aos cartões Cloze." />
    <section className="card form" aria-labelledby="occlusion-heading">
      <h2 id="occlusion-heading">Oclusão</h2>
      {loading && <p className="muted" role="status">{t('common.loading')}</p>}
      {!loading && error && notes.length === 0 && <p className="notice error" role="alert">{error}</p>}
      {!loading && notes.length === 0 && !error && <div className="empty-state"><strong>Este deck ainda não tem notas.</strong><span>Crie uma nota antes de usar o editor.</span></div>}
      {!loading && notes.length > 0 && <>
        <label htmlFor="occlusion-note">Nota do deck</label>
        <select id="occlusion-note" value={noteId} onChange={(event) => setNoteId(event.target.value)} disabled={busy}>
          {notes.map((note) => <option value={note.id} key={note.id}>{note.id}</option>)}
        </select>
        <label htmlFor="occlusion-image">Imagem</label>
        <input id="occlusion-image" type="file" accept="image/*" onChange={(event) => chooseFile(event.target.files?.[0])} disabled={busy} />
        {preview && <OcclusionEditor imageUrl={preview} value={masks} onChange={setMasks} />}
        {masks.length > 0 && <p className="status-text">{masks.length} região(ões) pronta(s).</p>}
        <button className="btn" type="button" onClick={() => void save()} disabled={busy || !file || !masks.length}>
          {busy ? t('common.saving') : 'Criar cartões Cloze'}
        </button>
      </>}
      {error && !(notes.length === 0 && !loading) && <p className="notice error" role="alert">{error}</p>}
      {message && <p className="notice success" role="status">{message}</p>}
    </section>
  </AppShell>;
}
