'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell, Topbar } from '../../../../../components/AppShell';
import { listNotesPage, type Note } from '../../../../../lib/services/note-service';
import type { PageCursor } from '../../../../../lib/services/pagination';
import { OcclusionEditor } from '../../../../../components/OcclusionEditor';
import { isEnabled } from '../../../../../lib/config/feature-flags';
import { actionableMediaError, mediaService } from '../../../../../lib/services/media-service';
import { actionableOcclusionError, occlusionService, type OcclusionMask } from '../../../../../lib/services/occlusion-service';

export default function NewOcclusionPage() {
  const { deckId } = useParams<{ deckId: string }>();
  const [message, setMessage] = useState('');
  const [noteId, setNoteId] = useState('');
  const [notes,setNotes]=useState<Note[]>([]);
  const [cursor,setCursor]=useState<PageCursor|null>(null);
  const [loading,setLoading]=useState(true);
  const loadNotes=useCallback(async(append=false,next:PageCursor|null=null)=>{setLoading(true);try{const page=await listNotesPage(deckId,{cursor:append?next:null});setNotes(old=>append?[...old,...page.items]:page.items);setCursor(page.nextCursor);}catch{setMessage('Não foi possível carregar as notas. Tente novamente.');}finally{setLoading(false);}},[deckId]);
  useEffect(()=>{void loadNotes();},[loadNotes]);
  const [assetId, setAssetId] = useState('');
  const [storagePath, setStoragePath] = useState('');
  const [url, setUrl] = useState('');
  const [masks, setMasks] = useState<OcclusionMask[]>([]);
  const [busy, setBusy] = useState(false);
  if (!isEnabled('occlusion')) return <AppShell><Topbar title="Oclusão" /><div className="card empty-state">Esta funcionalidade está desativada.</div></AppShell>;

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!noteId) { setMessage('Selecione uma nota antes de enviar a imagem.'); event.target.value = ''; return; }
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
      setMessage(`${result.cards.length} cartão(ões) criado(s) e imagem associada à nota.`);
    } catch (error) {
      setMessage(actionableOcclusionError(error));
    } finally { setBusy(false); }
  }

  return <AppShell><Topbar title="Nova oclusão de imagem" /><section className="card form">
    <label htmlFor="occlusion-note-id">Nota de destino</label>
    <select id="occlusion-note-id" value={noteId} onChange={event=>setNoteId(event.target.value)} disabled={loading||busy||Boolean(assetId)}><option value="">Selecione uma nota</option>{notes.map(note=>{const fields=note.fields as Record<string,unknown>;const title=fields.Front??fields.front??fields.Text??Object.values(fields).find(value=>typeof value==='string')??'Nota sem título';return <option data-user-content="" key={note.id} value={note.id}>{String(title).slice(0,100)}</option>;})}</select>
    {cursor&&<button className="btn secondary" disabled={loading||busy||Boolean(assetId)} onClick={()=>void loadNotes(true,cursor)}>Carregar mais notas</button>}
    <label className="sr-only" htmlFor="occlusion-image-upload">Selecionar imagem para oclusão</label>
    <input id="occlusion-image-upload" type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/avif,image/svg+xml" onChange={(event) => void upload(event)} disabled={busy || !noteId} />
    {url && <OcclusionEditor imageUrl={url} value={masks} onChange={setMasks} />}
    {storagePath && <p className="muted">Imagem pronta para associação. Se a criação falhar, corrija as regiões e tente novamente.</p>}
    <div className="inline-form"><button className="btn" onClick={() => void save()} disabled={busy || !noteId || !assetId || !masks.length}>Criar cartões Cloze</button>{assetId && <button className="btn secondary" type="button" onClick={() => void removeStagedAsset()} disabled={busy}>Remover upload pendente</button>}</div>
    <p role="status">{message}</p>
  </section></AppShell>;
}
