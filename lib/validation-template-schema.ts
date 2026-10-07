import type { CardTemplate } from './types/card-template';
import { hasMalformedPlaceholders, placeholderNames } from './services/template-renderer';

export function validateTemplate(t: Partial<CardTemplate>): string[] {
  const errors: string[] = [];
  if (!t.name?.trim()) errors.push('Nome é obrigatório');
  if (!t.field_definitions?.length) errors.push('Pelo menos um campo é obrigatório');
  if (!t.card_generation?.length) errors.push('Pelo menos uma regra de geração é obrigatória');

  const names = new Set<string>();
  for (const [index, field] of (t.field_definitions ?? []).entries()) {
    const name = typeof field.name === 'string' ? field.name.trim() : '';
    if (!name) errors.push(`Nome do campo ${index + 1} é obrigatório`);
    else if (names.has(name)) errors.push(`Campo "${name}" está duplicado`);
    else names.add(name);
  }

  for (const [index, rule] of (t.card_generation ?? []).entries()) {
    const front = typeof rule.front === 'string' ? rule.front : '';
    const back = typeof rule.back === 'string' ? rule.back : '';
    const source = `${front} ${back}`;
    if (!front.trim()) errors.push(`Frente da regra ${index + 1} é obrigatória`);
    if (!back.trim()) errors.push(`Verso da regra ${index + 1} é obrigatório`);
    if (hasMalformedPlaceholders(source)) errors.push(`Placeholder inválido na regra ${index + 1}; use {{NomeDoCampo}}`);
    for (const name of placeholderNames(source)) {
      if (!names.has(name)) errors.push(`Campo "${name}" referenciado na regra não existe`);
    }
  }
  return errors;
}
