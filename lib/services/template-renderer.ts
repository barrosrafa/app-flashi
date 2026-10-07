export interface TemplateField { name: string; type?: 'text' | 'image' | 'audio' | 'cloze'; }
export interface CardGeneration { name?: string; front: string; back: string; }
export interface CardTemplate { field_definitions: TemplateField[]; card_generation: CardGeneration[]; }
export interface RenderedCard { name?: string; front: string; back: string; }

const TOKEN = /\{\{\s*([\w.-]+)\s*\}\}/g;

/** Return the exact field keys referenced by a template, using the same grammar as interpolation. */
export function placeholderNames(value: string): string[] {
  return [...value.matchAll(TOKEN)].map((match) => match[1]);
}

/** Detect an incomplete token without rejecting ordinary braces in card content. */
export function hasMalformedPlaceholders(value: string): boolean {
  return /\{\{|\}\}/.test(value.replace(TOKEN, ''));
}

export function interpolate(template: string, fields: Record<string, unknown>): string {
  return template.replace(TOKEN, (_match, key: string) => {
    const value = fields[key];
    return value === null || value === undefined ? '' : String(value);
  });
}

/** Render every configured generation; previews and persisted card generation share this path. */
export function renderCard(template: CardTemplate, fields: Record<string, unknown>): RenderedCard[] {
  const generations = Array.isArray(template.card_generation) ? template.card_generation : [];
  return generations.map((generation) => ({
    name: generation.name,
    front: interpolate(generation.front ?? '', fields),
    back: interpolate(generation.back ?? '', fields),
  }));
}

export function renderDefaultCard(fields: Record<string, unknown>): RenderedCard {
  const front = fields.Front ?? fields.front ?? '';
  const back = fields.Back ?? fields.back ?? '';
  return { front: String(front), back: String(back) };
}

export function normalizeTemplate(value: unknown): CardTemplate | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<CardTemplate>;
  if (!Array.isArray(candidate.card_generation)) return null;
  const fieldDefinitions = (Array.isArray(candidate.field_definitions) ? candidate.field_definitions : [])
    .filter((item): item is TemplateField => !!item && typeof item === 'object' && typeof (item as TemplateField).name === 'string')
    .map((field) => ({ ...field, name: field.name.trim() }));
  const cardGeneration = candidate.card_generation.filter(
    (item): item is CardGeneration => !!item && typeof item === 'object' && typeof (item as CardGeneration).front === 'string' && typeof (item as CardGeneration).back === 'string',
  );
  return { field_definitions: fieldDefinitions, card_generation: cardGeneration };
}
