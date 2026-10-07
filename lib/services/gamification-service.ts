import { createClient, type Tables } from '../supabase/client';

export type GamificationProfile = Tables<'user_gamification_profiles'>;
export type BadgeDefinition = Tables<'badges_definition'>;
export type UserBadge = Tables<'user_badges'>;
export type SessionXpResult = { session_id: string; review_count: number; xp_awarded: number; xp_total: number; level_current: number };
export type LeaderboardEntry = { rank: number; user_id: string; display_name: string | null; xp_total: number; level_current: number; updated_at: string };

export const gamificationService = {
  async profile(userId: string) { const { data, error } = await createClient().from('user_gamification_profiles').select('*').eq('user_id', userId).maybeSingle(); if (error) throw error; return data; },
  async definitions() { const { data, error } = await createClient().from('badges_definition').select('*').order('xp_requirement', { ascending: true }); if (error) throw error; return data ?? []; },
  async userBadges(userId: string) { const { data, error } = await createClient().from('user_badges').select('*').eq('user_id', userId); if (error) throw error; return data ?? []; },
  async addXp(userId: string, amount: number) { const { data, error } = await createClient().rpc('add_user_xp', { p_user_id: userId, p_xp_amount: amount }); if (error) throw error; return data; },
  async syncSessionXp(sessionId: string, expectedReviewCount: number): Promise<SessionXpResult> {
    if (!Number.isInteger(expectedReviewCount) || expectedReviewCount < 1) throw new Error('SESSION_REVIEW_COUNT_INVALID');
    const { data, error } = await (createClient() as any).rpc('sync_session_xp_confirmed', {
      p_session_id: sessionId, p_expected_review_count: expectedReviewCount,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error('SESSION_XP_EMPTY');
    return row as SessionXpResult;
  },
  async refreshLeaderboard() { const { error } = await (createClient() as any).rpc('refresh_leaderboard_entries'); if (error) throw error; },
  async leaderboard(limit = 50): Promise<LeaderboardEntry[]> { const { data, error } = await (createClient() as any).rpc('list_leaderboard_entries', { p_limit: Math.min(100, Math.max(1, limit)) }); if (error) throw error; return (data ?? []) as LeaderboardEntry[]; },
};

export async function getGamificationData() {
  const { data: { user } } = await createClient().auth.getUser();
  if (!user) throw new Error('AUTH_REQUIRED');
  const [profile, badges, definitions] = await Promise.all([gamificationService.profile(user.id), gamificationService.userBadges(user.id), gamificationService.definitions()]);
  return { profile, badges, definitions };
}
