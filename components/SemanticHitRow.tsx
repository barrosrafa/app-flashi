'use client';
import { useTranslation } from '../contexts/LanguageContext';
import { translateUiText } from '../contexts/autoTranslations';
export function SemanticHitRow({ hit }: { hit: { note_id: string; similarity: number; match_type: string; fields: unknown } }) {
  const { locale } = useTranslation();
  const text = typeof hit.fields === 'object' && hit.fields !== null ? Object.values(hit.fields).filter((value): value is string => typeof value === 'string').join(' · ') : String(hit.fields);
  return <li className="result-item"><strong>{Math.round(hit.similarity * 100)}%</strong> · {translateUiText(hit.match_type, locale)}<p>{text}</p><small>{locale === 'en' ? 'Note' : 'Nota'} {hit.note_id}</small></li>;
}
