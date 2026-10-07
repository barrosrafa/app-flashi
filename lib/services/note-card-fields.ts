import { normalizeTemplate, renderCard } from './template-renderer';

type DerivedCard = { fields: unknown; card_ordinal?: number | null };
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function deriveNoteCardFields(previous: Record<string, unknown>, next: Record<string, unknown>, card: DerivedCard, template?: unknown) {
  const existing = record(card.fields);
  const normalized = normalizeTemplate(template);
  if (normalized) {
    const generated = renderCard(normalized, next)[card.card_ordinal ?? 0];
    if (!generated) throw new Error('O modelo não contém a definição deste cartão. Revise o modelo antes de salvar.');
    return { ...existing, ...next, Front: generated.front, Back: generated.back, __flashi_rendered_front:generated.front,__flashi_rendered_back:generated.back };
  }
  const result = { ...existing };
  // Basic and reversed cards retain their own orientation. Only fields with
  // a demonstrated relationship to the previous note are propagated.
  const pairs = [
    [previous.Front ?? previous.front, next.Front ?? next.front],
    [previous.Back ?? previous.back, next.Back ?? next.back],
  ];
  for (const [key, value] of Object.entries(existing)) {
    const direct = Object.keys(previous).find((name) => name.toLowerCase() === key.toLowerCase());
    if (direct && previous[direct] === value && direct in next) { result[key] = next[direct]; continue; }
    if (/^(front|back)$/i.test(key)) {
      const matching = pairs.find(([oldValue]) => oldValue !== undefined && oldValue === value);
      if (matching) result[key] = matching[1] ?? '';
    }
  }
  if ('__flashi_rendered_front' in existing) result.__flashi_rendered_front=result.Front??result.front??existing.__flashi_rendered_front;
  if ('__flashi_rendered_back' in existing) result.__flashi_rendered_back=result.Back??result.back??existing.__flashi_rendered_back;
  return result;
}
