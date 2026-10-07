'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell, Topbar } from '../../../components/AppShell';
import { isEnabled } from '../../../lib/config/feature-flags';
import { hasBrowserSession, isUuid } from '../../../lib/supabase/guards';
import { claimSubmission, releaseSubmission } from '../../../lib/services/tag-service';
import { templateEditPath, templateService } from '../../../lib/services/template-service';
import { renderCard } from '../../../lib/services/template-renderer';
import { validateTemplate } from '../../../lib/validation-template-schema';
import type { CardGenerationRule, CardTemplate, FieldDefinition } from '../../../lib/types/card-template';

const emptyTemplate: Partial<CardTemplate> = {
  name: '',
  field_definitions: [{ name: 'Front' }, { name: 'Back' }],
  card_generation: [{ name: 'Card 1', front: '{{Front}}', back: '{{Back}}' }],
};

export default function TemplateEditor({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [id, setId] = useState('');
  const [template, setTemplate] = useState<Partial<CardTemplate>>(emptyTemplate);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void params.then(async ({ id: value }) => {
      setId(value);
      if (value === 'new') return;
      if (!isUuid(value)) { setMessage('Este template não possui um identificador válido.'); return; }
      if (!(await hasBrowserSession())) { setMessage('Entre na sua conta para carregar este template.'); return; }
      try {
        const item = await templateService.get(value);
        if (!cancelled && item) setTemplate(item);
        if (!cancelled && !item) setMessage('Template não encontrado.');
      } catch {
        if (!cancelled) setMessage('Não foi possível carregar o template.');
      }
    });
    return () => { cancelled = true; };
  }, [params]);

  if (!isEnabled('templates')) return <AppShell><Topbar title="Template" /><div className="card empty-state">Esta funcionalidade está desativada.</div></AppShell>;

  const fields = (template.field_definitions ?? []) as FieldDefinition[];
  const generations = (template.card_generation ?? []) as CardGenerationRule[];
  const normalizedFields = fields.map((field) => ({ ...field, name: field.name.trim() }));
  const previewFields = Object.fromEntries(fields.map((field) => {
    const name = field.name.trim();
    return [name, name ? `Exemplo de ${name}` : ''];
  }));
  const previews = renderCard({ field_definitions: fields, card_generation: generations }, previewFields);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!claimSubmission(savingRef)) return;
    setSaving(true);
    setMessage('');
    try {
      const errors = validateTemplate({ ...template, field_definitions: normalizedFields });
      if (errors.length) { setMessage(errors.join(' · ')); return; }
      if (!(await hasBrowserSession())) { setMessage('Entre na sua conta para salvar templates.'); return; }

      if (id === 'new') {
        const created = await templateService.create({ name: template.name!, field_definitions: normalizedFields, card_generation: generations });
        setTemplate(created);
        router.push(templateEditPath(created.id));
        return;
      }
      if (!isUuid(id)) { setMessage('Este template não possui um identificador válido.'); return; }
      const persisted = await templateService.update(id, { name: template.name, field_definitions: normalizedFields, card_generation: generations });
      setTemplate(persisted);
      setMessage('Template salvo.');
    } catch {
      // Do not reset template state: the user can retry with all fields intact.
      setMessage('Não foi possível salvar o template. Tente novamente.');
    } finally {
      releaseSubmission(savingRef);
      setSaving(false);
    }
  }

  return <AppShell><Topbar title={id === 'new' ? 'Novo template' : 'Editar template'} /><form className="card form" onSubmit={save} aria-busy={saving}><label htmlFor="template-name">Nome</label><input id="template-name" value={template.name ?? ''} onChange={(event) => setTemplate({ ...template, name: event.target.value })} required /><h2>Campos</h2>{fields.map((field, index) => <input key={index} value={field.name} onChange={(event) => setTemplate({ ...template, field_definitions: fields.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item) })} aria-label={`Campo ${index + 1}`} required />)}<button className="link-button" type="button" onClick={() => setTemplate({ ...template, field_definitions: [...fields, { name: `Field${fields.length + 1}` }] })} disabled={saving}>Adicionar campo</button><h2>Gerações</h2>{generations.map((rule, index) => <div key={index} className="grid"><input value={rule.front} onChange={(event) => setTemplate({ ...template, card_generation: generations.map((item, itemIndex) => itemIndex === index ? { ...item, front: event.target.value } : item) })} aria-label={`Frente ${index + 1}`} required /><input value={rule.back} onChange={(event) => setTemplate({ ...template, card_generation: generations.map((item, itemIndex) => itemIndex === index ? { ...item, back: event.target.value } : item) })} aria-label={`Verso ${index + 1}`} required /></div>)}<section className="sample-card" aria-labelledby="template-preview-heading"><h2 id="template-preview-heading">Prévia</h2>{previews.length ? previews.map((card, index) => <article className="result-item" key={index}><strong><span data-user-content="">{card.name ?? `Card ${index + 1}`}</span></strong><div className="sample-label">Frente</div><p><span data-user-content="">{card.front || '—'}</span></p><div className="sample-label">Verso</div><p><span data-user-content="">{card.back || '—'}</span></p></article>) : <p className="muted">Adicione uma regra de geração para visualizar a prévia.</p>}</section><button className="btn" type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar template'}</button>{message && <p className="status-text" role="status">{message}</p>}</form></AppShell>;
}
