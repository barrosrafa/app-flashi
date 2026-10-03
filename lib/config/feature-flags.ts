import { isFeatureEnabled as readFlag, type FeatureFlag as ExistingFlag } from '../feature-flags';

/** One source of truth; legacy names remain aliases for existing callers. */
export const FF = {
  sync_worker: readFlag('sync_worker'),
  sync_v2: process.env.NEXT_PUBLIC_FF_SYNC_V2 === '1' || readFlag('sync_worker'),
  media: readFlag('media'),
  semantic: readFlag('semantic') || process.env.NEXT_PUBLIC_FF_SEMANTIC_SEARCH === '1',
  semantic_search: readFlag('semantic') || process.env.NEXT_PUBLIC_FF_SEMANTIC_SEARCH === '1',
  anki: readFlag('anki') || readFlag('anki_io'),
  anki_io: readFlag('anki_io') || readFlag('anki'),
  ai_ingest: readFlag('ai_ingest'),
  gamification: readFlag('gamification'),
  collab: readFlag('collab'),
  fsrs_opt: readFlag('fsrs_opt'),
  exams: readFlag('exams'),
  occlusion: readFlag('occlusion'),
  tags: readFlag('tags'),
  socratic: readFlag('socratic'),
  templates: readFlag('templates'),
  template_renderer: process.env.NEXT_PUBLIC_FF_TEMPLATE_RENDERER !== '0',
  references: readFlag('references'),
  import_url: process.env.NEXT_PUBLIC_FF_IMPORT_URL === '1',
  mcp: process.env.NEXT_PUBLIC_FF_MCP === '1',
} as const;
export type FeatureFlag = keyof typeof FF;
export function isEnabled(flag: FeatureFlag): boolean { return FF[flag] ?? readFlag(flag as ExistingFlag); }
