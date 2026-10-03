export type FeatureFlag = 'media' | 'semantic' | 'anki' | 'anki_io' | 'ai_ingest' | 'gamification' | 'collab' | 'fsrs_opt' | 'exams' | 'occlusion' | 'sync_worker' | 'tags' | 'socratic' | 'templates' | 'references';
const ENV_KEYS: Record<FeatureFlag, string> = {
  media: 'NEXT_PUBLIC_FF_MEDIA', semantic: 'NEXT_PUBLIC_FF_SEMANTIC', anki: 'NEXT_PUBLIC_FF_ANKI', anki_io: 'NEXT_PUBLIC_FF_ANKI_IO', ai_ingest: 'NEXT_PUBLIC_FF_AI_INGEST',
  gamification: 'NEXT_PUBLIC_FF_GAMIFICATION', collab: 'NEXT_PUBLIC_FF_COLLAB', fsrs_opt: 'NEXT_PUBLIC_FF_FSRS_OPT', exams: 'NEXT_PUBLIC_FF_EXAMS', occlusion: 'NEXT_PUBLIC_FF_OCCLUSION', sync_worker: 'NEXT_PUBLIC_FF_SYNC_WORKER', tags: 'NEXT_PUBLIC_FF_TAGS', socratic: 'NEXT_PUBLIC_FF_SOCRATIC', templates: 'NEXT_PUBLIC_FF_TEMPLATES', references: 'NEXT_PUBLIC_FF_REFERENCES',
};
export function isFeatureEnabled(flag: FeatureFlag): boolean { const value = process.env[ENV_KEYS[flag]]; return value === '1' || value === 'true'; }
export function getFeatureFlags(): Record<FeatureFlag, boolean> { return (Object.keys(ENV_KEYS) as FeatureFlag[]).reduce((flags, flag) => ({ ...flags, [flag]: isFeatureEnabled(flag) }), {} as Record<FeatureFlag, boolean>); }
