export type FeatureFlag = 'media' | 'semantic' | 'anki' | 'anki_io' | 'ai_ingest' | 'gamification' | 'collab' | 'fsrs_opt' | 'exams' | 'occlusion' | 'sync_worker' | 'tags' | 'socratic' | 'templates' | 'references';

const ENV_KEYS: Record<FeatureFlag, string> = {
  media: 'NEXT_PUBLIC_FF_MEDIA',
  semantic: 'NEXT_PUBLIC_FF_SEMANTIC',
  anki: 'NEXT_PUBLIC_FF_ANKI',
  anki_io: 'NEXT_PUBLIC_FF_ANKI_IO',
  ai_ingest: 'NEXT_PUBLIC_FF_AI_INGEST',
  gamification: 'NEXT_PUBLIC_FF_GAMIFICATION',
  collab: 'NEXT_PUBLIC_FF_COLLAB',
  fsrs_opt: 'NEXT_PUBLIC_FF_FSRS_OPT',
  exams: 'NEXT_PUBLIC_FF_EXAMS',
  occlusion: 'NEXT_PUBLIC_FF_OCCLUSION',
  sync_worker: 'NEXT_PUBLIC_FF_SYNC_WORKER',
  tags: 'NEXT_PUBLIC_FF_TAGS',
  socratic: 'NEXT_PUBLIC_FF_SOCRATIC',
  templates: 'NEXT_PUBLIC_FF_TEMPLATES',
  references: 'NEXT_PUBLIC_FF_REFERENCES',
};

/**
 * Todas as capacidades de produto ficam disponíveis no build final.
 * As variáveis são mantidas no contrato para compatibilidade, mas não podem
 * remover a UI nem esconder uma rota do usuário final.
 */
export function isFeatureEnabled(_flag: FeatureFlag): boolean {
  return true;
}

export function getFeatureFlags(): Record<FeatureFlag, boolean> {
  return (Object.keys(ENV_KEYS) as FeatureFlag[]).reduce(
    (flags, flag) => ({ ...flags, [flag]: true }),
    {} as Record<FeatureFlag, boolean>,
  );
}
