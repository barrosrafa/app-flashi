import { createClient, type Tables } from '../supabase/client';
import type { Database } from '../../src/types/database';

export type Profile = Tables<'profiles'>;
export type StudySettings = Tables<'study_settings'>;

export type ProfileData = {
  userId: string;
  email: string;
  profile: Profile | null;
  settings: StudySettings | null;
};

export async function getProfileData(): Promise<ProfileData> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('AUTH_REQUIRED');

  const [{ data: profile, error: profileError }, { data: settings, error: settingsError }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id,display_name,avatar_url,language,timezone,settings,created_at,updated_at')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('study_settings')
      .select('user_id,new_cards_per_day,max_reviews_per_day,algorithm,created_at,day_start_hour,easy_interval_days,fsrs_desired_retention,fsrs_last_optimized_at,fsrs_maximum_interval_days,fsrs_optimizer_threshold,fsrs_params,fsrs_version,fsrs_weights,graduating_interval_days,learning_steps_minutes,relearning_steps_minutes,starting_ease,updated_at,usn')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  if (profileError) throw profileError;
  if (settingsError) throw settingsError;
  return { userId: user.id, email: user.email ?? '', profile, settings };
}

export async function updateProfilePreferences(input: {
  displayName: string;
  newCardsPerDay: number;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('AUTH_REQUIRED');

  const profilePayload = {
    id: user.id,
    display_name: input.displayName.trim() || null,
  } satisfies Database['public']['Tables']['profiles']['Insert'];
  const settingsPayload = {
    user_id: user.id,
    new_cards_per_day: Math.max(0, Math.min(999, Math.round(input.newCardsPerDay))),
  } satisfies Database['public']['Tables']['study_settings']['Insert'];

  const [{ error: profileError }, { error: settingsError }] = await Promise.all([
    supabase.from('profiles').upsert(profilePayload),
    supabase.from('study_settings').upsert(settingsPayload),
  ]);

  if (profileError) throw profileError;
  if (settingsError) throw settingsError;
}
