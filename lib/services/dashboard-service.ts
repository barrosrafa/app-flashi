import { createClient, isSupabaseConfigured } from '../supabase/client';
import type { Database } from '../../src/types/database';
import { listDecks, type Deck } from './deck-service';

export type DueCard =
  Database['public']['Functions']['get_due_cards']['Returns'][number];

export type DashboardData = {
  decks: Deck[];
  dueCards: DueCard[];
  dueNewCount: number;
  dueReviewCount: number;
  currentStreak: number;
  bestStreak: number;
  weeklyCards: number;
  weeklyTimeMs: number;
  weeklyAccuracy: number;
  xpTotal: number;
  nextDeck: Deck | null;
};

export async function getDashboardData(): Promise<DashboardData> {
  if (!isSupabaseConfigured()) throw new Error('SUPABASE_NOT_CONFIGURED');
  const supabase = createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    if (error.status === 401 || error.name === 'AuthSessionMissingError') throw new Error('AUTH_REQUIRED');
    throw error;
  }
  const user = data.user;
  if (!user) throw new Error('AUTH_REQUIRED');

  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - 6);
  const startDate = weekStart.toISOString().slice(0, 10);

  const [
    decks,
    dueCardsResponse,
    streakResponse,
    statisticsResponse,
    gamificationResponse,
  ] = await Promise.all([
    listDecks(),
    supabase.rpc('get_due_cards', { p_limit: 500 }),
    supabase.rpc('get_current_streak'),
    supabase
      .from('daily_statistics')
      .select('stat_date,cards_studied,time_studied_ms,correct_count,incorrect_count')
      .eq('user_id', user.id)
      .gte('stat_date', startDate)
      .order('stat_date', { ascending: true })
      .limit(7),
    supabase
      .from('user_gamification_profiles')
      .select('xp_total,highest_streak_count,streak_days_count')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  if (dueCardsResponse.error) throw dueCardsResponse.error;
  if (streakResponse.error) throw streakResponse.error;
  if (statisticsResponse.error) throw statisticsResponse.error;
  if (gamificationResponse.error) throw gamificationResponse.error;

  const dueCards = dueCardsResponse.data ?? [];
  const dueNewCount = dueCards.filter((card) => card.state === 'new').length;
  const dueReviewCount = dueCards.length - dueNewCount;
  const stats = statisticsResponse.data ?? [];
  const weeklyCards = stats.reduce((sum, row) => sum + row.cards_studied, 0);
  const weeklyTimeMs = stats.reduce((sum, row) => sum + row.time_studied_ms, 0);
  const correct = stats.reduce((sum, row) => sum + row.correct_count, 0);
  const incorrect = stats.reduce((sum, row) => sum + row.incorrect_count, 0);
  const weeklyAccuracy = correct + incorrect === 0
    ? 0
    : Math.round((correct / (correct + incorrect)) * 100);
  const dueByDeck = new Map<string, number>();
  for (const card of dueCards) dueByDeck.set(card.deck_id, (dueByDeck.get(card.deck_id) ?? 0) + 1);
  const nextDeck = [...decks]
    .filter((deck) => (dueByDeck.get(deck.id) ?? 0) > 0)
    .sort((left, right) => (dueByDeck.get(right.id) ?? 0) - (dueByDeck.get(left.id) ?? 0))[0] ?? null;

  return {
    decks,
    dueCards,
    dueNewCount,
    dueReviewCount,
    currentStreak: streakResponse.data ?? 0,
    bestStreak: gamificationResponse.data?.highest_streak_count ?? 0,
    weeklyCards,
    weeklyTimeMs,
    weeklyAccuracy,
    xpTotal: gamificationResponse.data?.xp_total ?? 0,
    nextDeck,
  };
}
