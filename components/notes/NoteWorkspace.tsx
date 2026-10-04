'use client';

import { useEffect, useMemo, useState } from 'react';
import { noteService, type Note, type NoteClozeDeletion, type NoteFields } from '../../lib/services/note-service';
import { ReferenceEditor } from './ReferenceEditor';
import { templateService } from '../../lib/services/template-service';
import type { CardTemplate } from '../../lib/types/card-template';

type Props = { deckId: string };
function asFields(value: unknown): NoteFields { return value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, String(item ?? '')])) : {}; }

export function NoteWorkspace({ deckId }: Props) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [fields, setFields] = useState<NoteFields>({ Front: '', Back: '' });
  const [newField, setNewField] = useState('');
  const [cloze, setCloze] = useState<NoteClozeDeletion[]>([]);
  const [clozeField, setClozeField] = useState('Front');
  const [clozeOrdinal, setClozeOrdinal] = useState('1');
  const [clozeHint, setClozeHint] = useState('');
  const [templates, setTemplates] = useState<CardTemplate[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try { const result = await noteService.list(deckId); setNotes(result); if (!selectedId && result[0]) select(result[0]); }
    catch { setMessage('Não foi possível carregar as notes.'); }
  }
  async function loadCloze(id: string) { setCloze(await noteService.listCloze(id)); }
  function select(note: Note) { setSelectedId(note.id); setTemplateId(note.template_id ?? ''); setFields(asFields(note.fields)); void loadCloze(note.id); }
  useEffect(() => { void load(); void templateService.list().then(setTemplates).catch(() => undefined); }, [deckId]);
  const visible = useMemo(() => notes.filter((note) => JSON.stringify(note.fields).toLowerCase().includes(query.toLowerCase())), [notes, query]);
  function setField(name: string, value: string) { setFields((current) => ({ ...current, [name]: value })); }
  function addField() { const name = newField.trim(); if (!name || name in fields) return; setFields((current) => ({ ...current, [name]: '' })); setNewField(''); }
  async function save() {
    setBusy(true); setMessage('');
    try { const note = selectedId ? await noteService.update(selectedId, { fields, templateId: templateId || null }) : await noteService.create({ deckId, fields, templateId: templateId || null }); setSelectedId(note.id); setNotes((current) => selectedId ? current.map((item) => item.id === note.id ? note : item) : [note, ...current]); await loadCloze(note.id); setMessage(selectedId ? 'Nota atualizada.' : 'Nota criada.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível salvar.'); }
    finally { setBusy(false); }
  }
  async function remove() { if (!selectedId) return; setBusy(true); try { await noteService.remove(selectedId); setNotes((current) => current.filter((item) => item.id !== selectedId)); setSelectedId(''); setFields({ Front: '', Back: '' }); setCloze([]); setMessage('Note removida.'); } catch { setMessage('Não foi possível remover a note.'); } finally { setBusy(false); } }
  async function saveCloze() { if (!selectedId || !clozeField.trim()) return; try { await noteService.saveCloze({ noteId: selectedId, fieldName: clozeField, clozeOrdinal: Number(clozeOrdinal), hint: clozeHint }); setCloze(await noteService.listCloze(selectedId)); setClozeHint(''); setMessage('Cloze salvo.'); } catch { setMessage('Não foi possível salvar o cloze.'); } }
  async function removeCloze(id: string) { await noteService.removeCloze(id); setCloze((current) => current.filter((item) => item.id !== id)); }

  return <section className="card" aria-labelledby="notes-heading">
    <div className="section-head"><div><h2 id="notes-heading">Notas</h2><p className="subtitle">Organize o conteúdo dos seus cards neste deck.</p></div><button className="btn secondary" type="button" onClick={() => { setSelectedId(''); setTemplateId(''); setFields({ Front: '', Back: '' }); setCloze([]); }}>Nova nota</button></div>
    {message && <p className="notice" role="status">{message}</p>}
    <div className="notes-layout">
      <div><div className="field"><label htmlFor="note-search">Buscar notas</label><input id="note-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar no conteúdo" /></div><div className="notes-list" aria-label="Lista de notes">{visible.map((note) => <button className={note.id === selectedId ? 'note-list-item active' : 'note-list-item'} type="button" key={note.id} onClick={() => select(note)}><strong>{asFields(note.fields).Front || asFields(note.fields).front || 'Nota sem título'}</strong><span>{Object.keys(asFields(note.fields)).length} campos</span></button>)}{!visible.length && <p className="muted">Nenhuma nota encontrada.</p>}</div></div>
      <div className="note-editor"><div className="section-head compact-head"><div><h3>{selectedId ? 'Editar nota' : 'Nova nota'}</h3><p className="muted">Cada campo é salvo como conteúdo estruturado.</p></div>{selectedId && <button className="link-button" type="button" onClick={() => void remove()} disabled={busy}>Excluir nota</button>}</div>
        <div className="field"><label htmlFor="note-template">Template e definições de campo</label><select id="note-template" value={templateId} onChange={(event) => { const value = event.target.value; setTemplateId(value); const template = templates.find((item) => item.id === value); if (template?.field_definitions?.length) setFields((current) => Object.fromEntries(template.field_definitions.map((field) => [field.name, current[field.name] ?? '']))); }}><option value="">Sem template</option>{templates.map((template) => <option value={template.id} key={template.id}>{template.name}{template.is_system ? ' (sistema)' : ''}</option>)}</select></div>
        {Object.entries(fields).map(([name, value]) => <div className="field" key={name}><label htmlFor={`note-field-${name}`}>{name}</label><textarea id={`note-field-${name}`} value={value} onChange={(event) => setField(name, event.target.value)} /></div>)}
        <div className="inline-form"><label className="sr-only" htmlFor="note-new-field">Nome do novo campo</label><input id="note-new-field" value={newField} onChange={(event) => setNewField(event.target.value)} placeholder="Nome do novo campo" /><button className="btn ghost" type="button" onClick={addField}>Adicionar campo</button></div>
        <button className="btn" type="button" onClick={() => void save()} disabled={busy}>{busy ? 'Salvando…' : 'Salvar nota'}</button>
        {selectedId && <details className="advanced-note-tools"><summary>Recursos avançados: lacunas e referências</summary><p className="muted">Use estes recursos para criar cartões especiais ou relacionar notas.</p><div className="subpanel"><h3>Cards de lacuna (cloze)</h3><div className="inline-form"><select value={clozeField} onChange={(event) => setClozeField(event.target.value)}>{Object.keys(fields).map((name) => <option key={name}>{name}</option>)}</select><input type="number" min="1" value={clozeOrdinal} onChange={(event) => setClozeOrdinal(event.target.value)} /><input value={clozeHint} onChange={(event) => setClozeHint(event.target.value)} placeholder="Dica opcional" /><button className="btn ghost" type="button" onClick={() => void saveCloze()}>Adicionar cloze</button></div>{cloze.map((item) => <div className="inline-row" key={item.id}><span>{item.field_name} · cloze {item.cloze_ordinal}{item.hint ? ` · ${item.hint}` : ''}</span><button className="link-button" type="button" onClick={() => void removeCloze(item.id)}>Remover</button></div>)}</div><ReferenceEditor noteId={selectedId} /></details>}
      </div>
    </div>
  </section>;
}
