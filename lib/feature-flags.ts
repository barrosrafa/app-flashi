export type FeatureFlag =
  | 'media'
  | 'semantic'
  | 'anki'
  | 'anki_io'
  | 'ai_ingest'
  | 'gamification'
  | 'collab'
  | 'fsrs_opt'
  | 'exams'
  | 'occlusion'
  | 'sync_worker'
  | 'sync_v2'
  | 'tags'
  | 'socratic'
  | 'templates'
  | 'references'
  | 'semantic_search'
  | 'import_url'
  | 'mcp'
  | 'template_renderer';

// NEXT_PUBLIC_* references must be static for Next.js to inline them in browser builds.
const ENV_VALUES: Record<FeatureFlag, string | undefined> = {
  media: process.env.NEXT_PUBLIC_FF_MEDIA,
  semantic: process.env.NEXT_PUBLIC_FF_SEMANTIC,
  anki: process.env.NEXT_PUBLIC_FF_ANKI,
  anki_io: process.env.NEXT_PUBLIC_FF_ANKI_IO,
  ai_ingest: process.env.NEXT_PUBLIC_FF_AI_INGEST,
  gamification: process.env.NEXT_PUBLIC_FF_GAMIFICATION,
  collab: process.env.NEXT_PUBLIC_FF_COLLAB,
  fsrs_opt: process.env.NEXT_PUBLIC_FF_FSRS_OPT,
  exams: process.env.NEXT_PUBLIC_FF_EXAMS,
  occlusion: process.env.NEXT_PUBLIC_FF_OCCLUSION,
  sync_worker: process.env.NEXT_PUBLIC_FF_SYNC_WORKER,
  sync_v2: process.env.NEXT_PUBLIC_FF_SYNC_V2,
  tags: process.env.NEXT_PUBLIC_FF_TAGS,
  socratic: process.env.NEXT_PUBLIC_FF_SOCRATIC,
  templates: process.env.NEXT_PUBLIC_FF_TEMPLATES,
  references: process.env.NEXT_PUBLIC_FF_REFERENCES,
  semantic_search: process.env.NEXT_PUBLIC_FF_SEMANTIC_SEARCH,
  import_url: process.env.NEXT_PUBLIC_FF_IMPORT_URL,
  mcp: process.env.NEXT_PUBLIC_FF_MCP,
  template_renderer: process.env.NEXT_PUBLIC_FF_TEMPLATE_RENDERER,
};

export function parseFeatureFlag(value: string | undefined): boolean {
  return value === '1' || value?.toLowerCase() === 'true';
}

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return parseFeatureFlag(ENV_VALUES[flag]);
}

export function getFeatureFlags(): Record<FeatureFlag, boolean> {
  return (Object.keys(ENV_VALUES) as FeatureFlag[]).reduce(
    (result, flag) => {
      result[flag] = isFeatureEnabled(flag);
      return result;
    },
    {} as Record<FeatureFlag, boolean>,
  );
}
