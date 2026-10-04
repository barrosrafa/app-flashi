'use client';

import { useEffect, useState } from 'react';
import { AppShell, Topbar } from '../../components/AppShell';
import { OcclusionEditor } from '../../components/OcclusionEditor';
import { isFeatureEnabled } from '../../lib/feature-flags';
import { noteService } from '../../lib/services/note-service';
import {
  OcclusionMediaAssociationError,
  occlusionService,
  type OcclusionMask,
} from '../../lib/services/occlusion-service';

export default function OcclusionPage() {
  const [noteId, setNoteId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [masks, setMasks] = useState<OcclusionMask[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

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
    setMessage('Arraste sobre a imagem para desenhar cada região a ocultar.');
    setFile(selected);
    setMasks([]);
  }

  async function save() {
    if (!noteId.trim() || !file || !masks.length) {
      setError('Informe o ID da nota, selecione uma imagem e desenhe pelo menos uma região.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const note = await noteService.get(noteId.trim());
      if (!note) throw new Error('NOTE_NOT_FOUND');
      const result = await occlusionService.createForDeck({
        deckId: note.deck_id,
        noteId: note.id,
        masks,
        imageFile: file,
      });
      setMessage(`${result.cards.length} cartão(ões) criado(s) e imagem associada a todos.`);
    } catch (reason: unknown) {
      if (reason instanceof OcclusionMediaAssociationError) {
        setError(`${reason.cardsCreated} cartão(ões) foram criados; imagem anexada a ${reason.mediaAttached}. Reenvie a imagem aos cartões sem mídia.`);
      } else {
        const code = reason instanceof Error ? reason.message : '';
        setError(code === 'NOTE_NOT_FOUND' ? 'A nota não foi encontrada.'
          : code === 'AUTH_REQUIRED' ? 'Entre na sua conta para criar oclusões.'
          : 'Não foi possível criar a oclusão. Tente novamente.');
      }
    } finally {
      setBusy(false);
    }
  }

  if (!isFeatureEnabled('occlusion')) {
    return <AppShell><Topbar title="Oclusão de imagem" /><div className="card empty-state">Esta funcionalidade está desativada.</div></AppShell>;
  }

  return <AppShell>
    <Topbar title="Oclusão de imagem" subtitle="As caixas usam coordenadas percentuais e são associadas à imagem em cada cartão Cloze." />
    <section className="card form" aria-labelledby="occlusion-heading">
      <h2 id="occlusion-heading">Criar cartões com oclusão</h2>
      <label htmlFor="occlusion-note-id">ID da nota</label>
      <input id="occlusion-note-id" value={noteId} onChange={(event) => setNoteId(event.target.value)} disabled={busy} />
      <label htmlFor="occlusion-image">Imagem</label>
      <input id="occlusion-image" type="file" accept="image/*" onChange={(event) => chooseFile(event.target.files?.[0])} disabled={busy} />
      {preview && <OcclusionEditor imageUrl={preview} value={masks} onChange={setMasks} />}
      {masks.length > 0 && <p>{masks.length} região(ões) definida(s).</p>}
      <button className="btn" type="button" onClick={() => void save()} disabled={busy || !noteId.trim() || !file || !masks.length}>
        {busy ? 'Criando cartões…' : 'Criar cartões Cloze'}
      </button>
      {error && <p className="notice error" role="alert">{error}</p>}
      {message && <p className="notice success" role="status">{message}</p>}
    </section>
  </AppShell>;
}
