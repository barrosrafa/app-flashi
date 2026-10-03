import { isFeatureEnabled as readFlag, type FeatureFlag as ExistingFlag } from '../feature-flags';
export const FF = {
  sync_v2: process.env.NEXT_PUBLIC_FF_SYNC_V2 === '1', anki_io: process.env.NEXT_PUBLIC_FF_ANKI_IO === '1',
  occlusion: process.env.NEXT_PUBLIC_FF_OCCLUSION === '1', semantic_search: process.env.NEXT_PUBLIC_FF_SEMANTIC_SEARCH === '1',
  fsrs_opt: process.env.NEXT_PUBLIC_FF_FSRS_OPT === '1', ai_ingest: process.env.NEXT_PUBLIC_FF_AI_INGEST === '1',
  gamification: process.env.NEXT_PUBLIC_FF_GAMIFICATION === '1', exams: process.env.NEXT_PUBLIC_FF_EXAMS === '1', import_url: process.env.NEXT_PUBLIC_FF_IMPORT_URL === '1', mcp: process.env.NEXT_PUBLIC_FF_MCP === '1', template_renderer: process.env.NEXT_PUBLIC_FF_TEMPLATE_RENDERER !== '0', tags: process.env.NEXT_PUBLIC_FF_TAGS === '1', socratic: process.env.NEXT_PUBLIC_FF_SOCRATIC === '1', templates: process.env.NEXT_PUBLIC_FF_TEMPLATES === '1', references: process.env.NEXT_PUBLIC_FF_REFERENCES === '1',
} as const;
export type FeatureFlag = keyof typeof FF;
export function isEnabled(flag: FeatureFlag): boolean { return FF[flag] || readFlag(flag as ExistingFlag); }
