import { createClient, type Tables } from '../supabase/client';
export type GamificationProfile = Tables<'user_gamification_profiles'>;
export type BadgeDefinition = Tables<'badges_definition'>;
export type UserBadge = Tables<'user_badges'>;
export async function getGamificationData() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('AUTH_REQUIRED');
  const [{ data: profile, error: profileError }, { data: badges, error: badgesError }, { data: definitions, error: definitionsError }] = await Promise.all([
    supabase.from('user_gamification_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('user_badges').select('*').eq('user_id', user.id).order('unlocked_at', { ascending: false }),
    supabase.from('badges_definition').select('*').order('xp_requirement', { ascending: true }),
  ]);
  if (profileError) throw profileError; if (badgesError) throw badgesError; if (definitionsError) throw definitionsError;
  return { profile, badges: badges ?? [], definitions: definitions ?? [] };
}
