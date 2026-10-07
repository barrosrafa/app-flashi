'use client';
import { useEffect, useState } from 'react';
import { noteService } from '../../lib/services/note-service';
import { referenceService } from '../../lib/services/reference-service';
import type { NoteReference } from '../../lib/types/note-reference';

function titleFromFields(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'Nota sem título';
  const fields = value as Record<string, unknown>;
  const title = fields.Front ?? fields.front ?? fields.Título ?? fields.titulo ?? Object.values(fields).find((item) => typeof item === 'string');
  return typeof title === 'string' && title.trim() ? title.trim() : 'Nota sem título';
}
export function ReferenceEditor({ noteId }: { noteId: string }) {
  const [refs, setRefs] = useState<NoteReference[]>([]);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [availableNotes, setAvailableNotes] = useState<Array<{ id: string; title: string }>>([]);
  const [target, setTarget] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [references, sourceNote] = await Promise.all([
          referenceService.listForNote(noteId),
          noteService.get(noteId),
        ]);
        const notes = sourceNote ? await noteService.list(sourceNote.deck_id) : [];
        if (cancelled) return;
        const titlesById: Record<string, string> = {};
        for (const note of notes) titlesById[note.id] = titleFromFields(note.fields);
        setRefs(references);
        setTitles(titlesById);
        setAvailableNotes(notes.filter((note) => note.id !== noteId).map((note) => ({ id: note.id, title: titleFromFields(note.fields) })));
      } catch {
        if (!cancelled) setMessage('Não foi possível carregar as notas relacionadas.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [noteId]);
  async function add() {
    if (!target) return;
    setBusy(true);
    setMessage('');
    try {
      await referenceService.create(noteId, target);
      setTarget('');
      setRefs(await referenceService.listForNote(noteId));
      setMessage('Nota relacionada adicionada.');
    } catch {
      setMessage('Não foi possível adicionar essa relação.');
    } finally {
      setBusy(false);
    }
  }
  async function remove(referenceId: string) {
    setBusy(true);
    setMessage('');
    try {
      await referenceService.remove(referenceId);
      setRefs((current) => current.filter((item) => item.id !== referenceId));
    } catch {
      setMessage('Não foi possível remover essa relação.');
    } finally {
      setBusy(false);
    }
  }
  const existing = new Set(refs.map((ref) => ref.target_note_id));
  const relatedOptions = availableNotes.filter((note) => !existing.has(note.id));
  return <div className="reference-editor" aria-busy={loading || busy}>
    <strong>Notas relacionadas</strong>
    {loading ? <p className="muted" role="status">Carregando notas…</p> : <>
      {refs.length > 0 && <ul>{refs.map((ref) => <li key={ref.id}><span>{titles[ref.target_note_id] ?? 'Outra nota relacionada'}</span><button className="link-button" type="button" onClick={() => void remove(ref.id)} disabled={busy}>Remover</button></li>)}</ul>}
      {relatedOptions.length > 0 ? <div className="reference-add"><label htmlFor={`related-note-${noteId}`}>Adicionar uma nota deste deck</label><select id={`related-note-${noteId}`} value={target} onChange={(event) => setTarget(event.target.value)}><option value="">Selecione uma nota</option>{relatedOptions.map((note) => <option data-user-content="" value={note.id} key={note.id}>{note.title}</option>)}</select><button className="btn ghost" type="button" onClick={() => void add()} disabled={!target || busy}>Adicionar relação</button></div> : <p className="muted">{refs.length ? 'Todas as outras notas deste deck já estão relacionadas.' : 'Crie outra nota neste deck para relacioná-la.'}</p>}
    </>}
    {message && <small className="status-text" role="status">{message}</small>}
  </div>;
}
