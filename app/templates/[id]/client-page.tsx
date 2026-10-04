'use client';

import { useEffect, useState } from 'react';
import { AppShell, Topbar } from '../../../components/AppShell';
import { isEnabled } from '../../../lib/config/feature-flags';
import { hasBrowserSession, isUuid } from '../../../lib/supabase/guards';
import { templateService } from '../../../lib/services/template-service';
import { validateTemplate } from '../../../lib/validation-template-schema';
import type { CardGenerationRule, CardTemplate, FieldDefinition } from '../../../lib/types/card-template';

const emptyTemplate: Partial<CardTemplate> = {
  name: '',
  field_definitions: [{ name: 'Front' }, { name: 'Back' }],
  card_generation: [{ name: 'Card 1', front: '{{Front}}', back: '{{Back}}' }],
};

export default function TemplateEditor({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState('');
  const [template, setTemplate] = useState<Partial<CardTemplate>>(emptyTemplate);
  const [message, setMessage] = useState('');

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

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const errors = validateTemplate(template);
    if (errors.length) { setMessage(errors.join(' · ')); return; }
    if (!(await hasBrowserSession())) { setMessage('Entre na sua conta para salvar templates.'); return; }
    try {
      if (id === 'new') await templateService.create({ name: template.name!, field_definitions: fields, card_generation: generations });
      else if (isUuid(id)) await templateService.update(id, { name: template.name, field_definitions: fields, card_generation: generations });
      else { setMessage('Este template não possui um identificador válido.'); return; }
      setMessage('Template salvo.');
    } catch {
      setMessage('Não foi possível salvar o template.');
    }
  }

  return <AppShell><Topbar title={id === 'new' ? 'Novo template' : 'Editar template'} /><form className="card form" onSubmit={save}><label htmlFor="template-name">Nome</label><input id="template-name" value={template.name ?? ''} onChange={(event) => setTemplate({ ...template, name: event.target.value })} required /><h2>Campos</h2>{fields.map((field, index) => <input key={index} value={field.name} onChange={(event) => setTemplate({ ...template, field_definitions: fields.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item) })} aria-label={`Campo ${index + 1}`} required />)}<button className="link-button" type="button" onClick={() => setTemplate({ ...template, field_definitions: [...fields, { name: `Field${fields.length + 1}` }] })}>Adicionar campo</button><h2>Gerações</h2>{generations.map((rule, index) => <div key={index} className="grid"><input value={rule.front} onChange={(event) => setTemplate({ ...template, card_generation: generations.map((item, itemIndex) => itemIndex === index ? { ...item, front: event.target.value } : item) })} aria-label={`Frente ${index + 1}`} required /><input value={rule.back} onChange={(event) => setTemplate({ ...template, card_generation: generations.map((item, itemIndex) => itemIndex === index ? { ...item, back: event.target.value } : item) })} aria-label={`Verso ${index + 1}`} required /></div>)}<button className="btn" type="submit">Salvar template</button>{message && <p className="status-text" role="status">{message}</p>}</form></AppShell>;
}
