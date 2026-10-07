import type { NoteFields } from './note-service';

/**
 * F06 — campo estruturado.
 *
 * O editor convertia todo valor não textual em texto no carregamento e
 * novamente ao salvar, destruindo arrays, objetos, números e booleanos da nota.
 * `normalizeNoteFields` guarda os valores originais, `displayFieldValue` produz
 * somente o texto do rascunho e `mergeNoteFields` regrava apenas os campos cujo
 * texto mudou, mantendo os demais byte a byte.
 */
export function normalizeNoteFields(value: unknown): NoteFields {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>));
}

export function displayFieldValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export function draftFromFields(fields: NoteFields): Record<string, string> {
  return Object.fromEntries(Object.entries(fields).map(([name, value]) => [name, displayFieldValue(value)]));
}

export function mergeNoteFields(original: NoteFields, drafts: Record<string, string>): NoteFields {
  const next: NoteFields = { ...original };
  for (const [name, draft] of Object.entries(drafts)) {
    if (!(name in next)) { next[name] = draft; continue; }
    if (displayFieldValue(next[name]) === draft) continue;
    const previous = next[name];
    if (typeof previous === 'string') { next[name] = draft; continue; }
    let parsed: unknown;
    try { parsed = JSON.parse(draft); }
    catch { throw new Error(`O campo ${name} deve conter JSON válido para preservar seu tipo.`); }
    const sameType = previous === null ? parsed === null
      : Array.isArray(previous) ? Array.isArray(parsed)
      : typeof previous === 'object' ? parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      : typeof parsed === typeof previous;
    if (!sameType) throw new Error(`O campo ${name} deve preservar o tipo ${Array.isArray(previous) ? 'lista' : typeof previous}.`);
    next[name] = parsed;
  }
  return next;
}
