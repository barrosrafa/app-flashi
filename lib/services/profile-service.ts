import { createClient, type Tables } from '../supabase/client';
import type { Database, Json } from '../../src/types/database';

export type Profile = Tables<'profiles'>;
export type StudySettings = Tables<'study_settings'>;
export type ProfileData = { userId: string; email: string; profile: Profile | null; settings: StudySettings | null };
export type StudySettingsInput = {
  displayName: string;
  timezone?: string;
  newCardsPerDay: number;
  maxReviewsPerDay: number;
  algorithm: Database['public']['Enums']['srs_algorithm'];
  learningStepsMinutes: number[];
  relearningStepsMinutes: number[];
  graduatingIntervalDays: number;
  easyIntervalDays: number;
  startingEase: number;
  dayStartHour: number;
  fsrsDesiredRetention: number;
  fsrsMaximumIntervalDays: number;
  fsrsOptimizerThreshold: number;
  fsrsParams: Json;
  fsrsWeights: number[];
};

export async function getProfileData(): Promise<ProfileData> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('AUTH_REQUIRED');
  const [{ data: profile, error: profileError }, { data: settings, error: settingsError }] = await Promise.all([
    supabase.from('profiles').select('id,display_name,avatar_url,language,timezone,settings,created_at,updated_at').eq('id', user.id).maybeSingle(),
    supabase.from('study_settings').select('*').eq('user_id', user.id).maybeSingle(),
  ]);
  if (profileError) throw profileError;
  if (settingsError) throw settingsError;
  return { userId: user.id, email: user.email ?? '', profile, settings };
}

function integer(value: number, min: number, max: number, name: string) {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < min || value > max) throw new Error(`${name}_INVALID`);
  return value;
}

function steps(value: number[], name: string) {
  if (!Array.isArray(value) || value.length > 20 || value.some((item) => !Number.isInteger(item) || item < 0 || item > 1440)) throw new Error(`${name}_INVALID`);
  return value;
}

export async function updateProfilePreferences(input: StudySettingsInput) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('AUTH_REQUIRED');
  const retention = Number(input.fsrsDesiredRetention);
  if (!Number.isFinite(retention) || retention <= 0.5 || retention >= 1) throw new Error('FSRS_RETENTION_INVALID');
  if (!Array.isArray(input.fsrsWeights) || (input.fsrsWeights.length !== 0 && input.fsrsWeights.length !== 21) || input.fsrsWeights.some((weight) => !Number.isFinite(weight))) throw new Error('FSRS_WEIGHTS_INVALID');

  const profilePayload = {
    id: user.id,
    display_name: input.displayName.trim() || null,
    timezone: input.timezone?.trim() || 'America/Sao_Paulo',
  } satisfies Database['public']['Tables']['profiles']['Insert'];
  const settingsPayload = {
    user_id: user.id,
    new_cards_per_day: integer(input.newCardsPerDay, 0, 9999, 'NEW_CARDS'),
    max_reviews_per_day: integer(input.maxReviewsPerDay, 0, 9999, 'MAX_REVIEWS'),
    algorithm: input.algorithm,
    learning_steps_minutes: steps(input.learningStepsMinutes, 'LEARNING_STEPS'),
    relearning_steps_minutes: steps(input.relearningStepsMinutes, 'RELEARNING_STEPS'),
    graduating_interval_days: integer(input.graduatingIntervalDays, 1, 36500, 'GRADUATING_INTERVAL'),
    easy_interval_days: integer(input.easyIntervalDays, 1, 36500, 'EASY_INTERVAL'),
    starting_ease: input.startingEase,
    day_start_hour: integer(input.dayStartHour, 0, 23, 'DAY_START_HOUR'),
    fsrs_desired_retention: retention,
    fsrs_maximum_interval_days: integer(input.fsrsMaximumIntervalDays, 1, 36500, 'FSRS_MAXIMUM_INTERVAL'),
    fsrs_optimizer_threshold: integer(input.fsrsOptimizerThreshold, 100, 100000, 'FSRS_THRESHOLD'),
    fsrs_params: input.fsrsParams,
    fsrs_weights: input.fsrsWeights,
  } satisfies Database['public']['Tables']['study_settings']['Insert'];
  const [{ error: profileError }, { error: settingsError }] = await Promise.all([
    supabase.from('profiles').upsert(profilePayload),
    supabase.from('study_settings').upsert(settingsPayload),
  ]);
  if (profileError) throw profileError;
  if (settingsError) throw settingsError;
}
