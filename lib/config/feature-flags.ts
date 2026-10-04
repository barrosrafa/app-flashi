import { isFeatureEnabled as readFlag, type FeatureFlag } from '../feature-flags';

export const FF = {
  sync_worker: readFlag('sync_worker'),
  sync_v2: readFlag('sync_v2'),
  media: readFlag('media'),
  semantic: readFlag('semantic'),
  semantic_search: readFlag('semantic_search'),
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
  template_renderer: readFlag('template_renderer'),
  references: readFlag('references'),
  import_url: readFlag('import_url'),
  mcp: readFlag('mcp'),
} satisfies Record<FeatureFlag, boolean>;

export type { FeatureFlag };
export function isEnabled(flag: FeatureFlag): boolean {
  return FF[flag];
}
