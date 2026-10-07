'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell, Topbar } from '../../../../../components/AppShell';
import { OcclusionEditor } from '../../../../../components/OcclusionEditor';
import { isEnabled } from '../../../../../lib/config/feature-flags';
import { actionableMediaError, mediaService } from '../../../../../lib/services/media-service';
import { actionableOcclusionError, occlusionService, type OcclusionMask } from '../../../../../lib/services/occlusion-service';

export default function NewOcclusionPage() {
  const { deckId } = useParams<{ deckId: string }>();
  const [noteId, setNoteId] = useState('');
  const [assetId, setAssetId] = useState('');
  const [storagePath, setStoragePath] = useState('');
  const [url, setUrl] = useState('');
  const [masks, setMasks] = useState<OcclusionMask[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  if (!isEnabled('occlusion')) return <AppShell><Topbar title="Oclusão" /><div className="card empty-state">Esta funcionalidade está desativada.</div></AppShell>;

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!noteId) { setMessage('Informe o ID da nota antes de enviar a imagem.'); event.target.value = ''; return; }
    setBusy(true);
    try {
      const asset = await mediaService.upload(file, undefined, undefined, undefined, { noteId, deckId });
      if (!('storage_key' in asset)) throw new Error('MEDIA_ASSET_STAGING_FAILED');
      setAssetId(asset.asset_id);
      setStoragePath(asset.storage_key);
      setUrl((await mediaService.signedUrl(asset.storage_key)) ?? '');
      setMessage('Imagem em staging. Desenhe as regiões; o asset só será associado após criar os cartões.');
    } catch (error) {
      setMessage(actionableMediaError(error));
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  }

  async function removeStagedAsset() {
    if (!assetId) return;
    setBusy(true);
    try { await mediaService.removeAsset(assetId); setAssetId(''); setStoragePath(''); setUrl(''); setMasks([]); setMessage('Upload pendente removido com segurança.'); }
    catch (error) { setMessage(actionableMediaError(error)); }
    finally { setBusy(false); }
  }

  async function save() {
    setBusy(true);
    try {
      const result = await occlusionService.createNote({ noteId, deckId, assetId, masks });
      setMessage(`${result.cards.length} cartão(ões) criado(s). Código ${result.code}; requestId ${result.requestId}.`);
    } catch (error) {
      setMessage(actionableOcclusionError(error));
    } finally { setBusy(false); }
  }

  return <AppShell><Topbar title="Nova oclusão de imagem" /><section className="card form">
    <label htmlFor="occlusion-note-id">ID da nota</label>
    <input id="occlusion-note-id" value={noteId} onChange={(event) => setNoteId(event.target.value.trim())} placeholder="UUID da nota deste deck" />
    <label className="sr-only" htmlFor="occlusion-image-upload">Selecionar imagem para oclusão</label>
    <input id="occlusion-image-upload" type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/avif,image/svg+xml" onChange={(event) => void upload(event)} disabled={busy || !noteId} />
    {url && <OcclusionEditor imageUrl={url} value={masks} onChange={setMasks} />}
    {storagePath && <p className="muted">Asset em staging: {assetId}. Se a criação falhar, você pode corrigir as caixas e tentar novamente.</p>}
    <div className="inline-form"><button className="btn" onClick={() => void save()} disabled={busy || !noteId || !assetId || !masks.length}>Criar cartões Cloze</button>{assetId && <button className="btn secondary" type="button" onClick={() => void removeStagedAsset()} disabled={busy}>Remover upload pendente</button>}</div>
    <p role="status">{message}</p>
  </section></AppShell>;
}
