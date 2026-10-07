'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { claimSubmission, normalizeTagName, releaseSubmission, tagErrorMessage, tagService } from '../../lib/services/tag-service';
import { useTags } from '../../hooks/useTags';
import type { Tag } from '../../lib/types/tag';

export function TagSelector({ cardId }: { cardId: string }) {
  const { tags, loading, reload } = useTags();
  const [selected, setSelected] = useState<Tag[]>([]);
  const [newName, setNewName] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const datalistId = `tag-options-${cardId}`;

  useEffect(() => {
    void tagService.listForCard(cardId).then(setSelected).catch((error: unknown) => setMessage(tagErrorMessage(error)));
  }, [cardId]);

  const selectedIds = new Set(selected.map((tag) => tag.id));

  async function choose(id: string) {
    if (!id || selectedIds.has(id) || !claimSubmission(savingRef)) return;
    setSaving(true);
    setMessage('');
    try {
      await tagService.addToCard(cardId, id);
      const tag = tags.find((item) => item.id === id);
      if (tag) setSelected((value) => value.some((item) => item.id === tag.id) ? value : [...value, tag]);
      setMessage('Tag adicionada.');
    } catch (error: unknown) {
      setMessage(tagErrorMessage(error));
    } finally {
      releaseSubmission(savingRef);
      setSaving(false);
    }
  }

  async function remove(tag: Tag) {
    if (!claimSubmission(savingRef)) return;
    setSaving(true);
    setMessage('');
    try {
      await tagService.removeFromCard(cardId, tag.id);
      setSelected((value) => value.filter((item) => item.id !== tag.id));
      setMessage('Tag removida.');
    } catch (error: unknown) {
      setMessage(tagErrorMessage(error));
    } finally {
      releaseSubmission(savingRef);
      setSaving(false);
    }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!claimSubmission(savingRef)) return;
    const value = normalizeTagName(newName);
    if (!value) {
      releaseSubmission(savingRef);
      setMessage('Informe um nome para a tag.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const tag = await tagService.create(value);
      await tagService.addToCard(cardId, tag.id);
      setSelected((current) => current.some((item) => item.id === tag.id) ? current : [...current, tag]);
      setNewName('');
      setMessage('Tag adicionada.');
      void reload().catch(() => undefined);
    } catch (error: unknown) {
      // Keep newName intact after a failed persistence so retry is possible.
      setMessage(tagErrorMessage(error));
    } finally {
      releaseSubmission(savingRef);
      setSaving(false);
    }
  }

  return <div className="tag-selector"><div className="flex flex-wrap gap-1" aria-label="Tags selecionadas">{selected.map((tag) => <span className="pill" key={tag.id}><span><span data-user-content="">{tag.name}</span></span><button type="button" aria-label={`Remover tag ${tag.name}`} onClick={() => void remove(tag)} disabled={saving}>×</button></span>)}</div><select aria-label="Adicionar tag" disabled={loading || saving} value="" onChange={(e) => void choose(e.target.value)}><option value="">Adicionar tag…</option>{tags.filter((tag) => !selectedIds.has(tag.id)).map((tag) => <option data-user-content="" key={tag.id} value={tag.id}>{tag.name}</option>)}</select><form onSubmit={(event) => void create(event)}><input aria-label="Nova tag" list={datalistId} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nova tag" disabled={saving} /><datalist id={datalistId}>{tags.filter((tag) => !selectedIds.has(tag.id)).map((tag) => <option key={tag.id} value={tag.name} />)}</datalist><button type="submit" className="link-button" disabled={saving}>{saving ? 'Salvando…' : 'Criar'}</button></form>{message && <p className="status-text" role="status">{message}</p>}</div>;
}
