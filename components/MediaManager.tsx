'use client';

import { useEffect, useState } from 'react';
import { listCards, type Flashcard } from '../lib/services/card-service';
import { mediaService, type CardMedia } from '../lib/services/media-service';
import { MediaViewer } from './MediaViewer';

function cardLabel(fields: unknown, fallback: string) { if (fields && typeof fields === 'object' && !Array.isArray(fields)) { const record = fields as Record<string, unknown>; return String(record.Front ?? record.front ?? fallback); } return fallback; }

export function MediaManager({ deckId }: { deckId: string }) {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [items, setItems] = useState<CardMedia[]>([]);
  const [cardId, setCardId] = useState('');
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function loadCards() { const result = await listCards(deckId); setCards(result); if (!cardId && result[0]) setCardId(result[0].id); }
  async function loadMedia(id = cardId) { if (!id) return; const result = await mediaService.listForCard(id); setItems(result); const signed = await mediaService.signMany(result.map((item) => item.storage_path)); setUrls(Object.fromEntries(signed.map((item) => [item.id, item.url]))); }
  useEffect(() => { void loadCards().catch(() => setMessage('Não foi possível carregar os cards.')); }, [deckId]);
  useEffect(() => { void loadMedia().catch(() => setMessage('Não foi possível carregar as mídias.')); }, [cardId]);
  async function upload(event: React.ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (!file || !cardId) return; setBusy(true); try { await mediaService.upload(file, undefined, cardId); await loadMedia(); setMessage('Mídia enviada e associada ao card.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível enviar a mídia.'); } finally { setBusy(false); event.target.value = ''; } }
  async function remove(id: string) { setBusy(true); try { await mediaService.remove(id); await loadMedia(); setMessage('Mídia removida do storage e do card.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível remover a mídia.'); } finally { setBusy(false); } }
  async function update(item: CardMedia, fieldName: string) { try { const changed = await mediaService.update(item.id, { fieldName: fieldName || null }); setItems((current) => current.map((entry) => entry.id === changed.id ? changed : entry)); setMessage('Campo da mídia atualizado.'); } catch { setMessage('Não foi possível atualizar a mídia.'); } }
  return <section className="card" aria-labelledby="media-manager-heading"><div className="section-head"><div><h2 id="media-manager-heading">Mídias</h2><p className="subtitle">Upload, associação, visualização, edição e exclusão no bucket privado.</p></div></div>{message && <p className="notice" role="status">{message}</p>}<div className="inline-form"><select aria-label="Card da mídia" value={cardId} onChange={(event) => setCardId(event.target.value)}><option value="">Selecione um card</option>{cards.map((card) => <option key={card.id} value={card.id}>{cardLabel(card.fields, card.id)}</option>)}</select><label className="btn secondary">{busy ? 'Enviando…' : 'Enviar mídia'}<input type="file" hidden onChange={(event) => void upload(event)} disabled={busy || !cardId} /></label></div>{!items.length ? <p className="muted">Nenhuma mídia associada a este card.</p> : <div className="media-grid">{items.map((item) => <article className="media-item" key={item.id}>{urls[item.storage_path] && <MediaViewer url={urls[item.storage_path]} mime={item.mime_type ?? item.media_type} />}<div className="field"><label htmlFor={`media-field-${item.id}`}>Campo associado</label><input id={`media-field-${item.id}`} defaultValue={item.field_name ?? ''} onBlur={(event) => void update(item, event.target.value)} placeholder="Front, Back…" /></div><small className="muted">{item.mime_type ?? item.media_type} · {item.file_size_bytes ?? 0} bytes</small><button className="link-button" type="button" onClick={() => void remove(item.id)} disabled={busy}>Excluir mídia</button></article>)}</div>}</section>;
}
