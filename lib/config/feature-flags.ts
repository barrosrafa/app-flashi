import { isFeatureEnabled as readFlag, type FeatureFlag as ExistingFlag } from '../feature-flags';

/** Todas as funcionalidades são expostas ao usuário final; flags permanecem como contrato de compatibilidade. */
export const FF = {
  sync_worker: readFlag('sync_worker'),
  sync_v2: readFlag('sync_worker'),
  media: readFlag('media'),
  semantic: readFlag('semantic'),
  semantic_search: readFlag('semantic'),
  anki: readFlag('anki'),
  anki_io: readFlag('anki_io'),
  ai_ingest: readFlag('ai_ingest'),
  gamification: readFlag('gamification'),
  collab: readFlag('collab'),
  fsrs_opt: readFlag('fsrs_opt'),
  exams: readFlag('exams'),
  occlusion: readFlag('occlusion'),
  tags: readFlag('tags'),
  socratic: readFlag('socratic'),
  templates: readFlag('templates'),
  template_renderer: true,
  references: readFlag('references'),
  import_url: true,
  mcp: true,
} as const;

export type FeatureFlag = keyof typeof FF;
export function isEnabled(flag: FeatureFlag): boolean {
  return FF[flag] ?? readFlag(flag as ExistingFlag);
}
