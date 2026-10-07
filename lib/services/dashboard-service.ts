import { createClient, isSupabaseConfigured } from '../supabase/client';
import type { Database } from '../../src/types/database';
import { listDecks, type Deck } from './deck-service';
import { decodeLearningPreferences, type LearningPreferences } from './onboarding-service';

export type DueCard = Database['public']['Functions']['get_due_cards']['Returns'][number];

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
  estimatedMinutes: number | null;
  learningPlan: LearningPreferences;
};

export type DashboardQueueData = {
  dueCards: DueCard[];
  dueNewCount: number;
  dueReviewCount: number;
};

export type DashboardStatsData = Pick<DashboardData, 'currentStreak' | 'bestStreak' | 'weeklyCards' | 'weeklyTimeMs' | 'weeklyAccuracy' | 'xpTotal'>;
export type DashboardLearningPlanData = LearningPreferences;

export type DashboardSectionError = {
  kind: 'auth' | 'setup' | 'unknown';
  cause: unknown;
};

export type DashboardSectionState<T> =
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: DashboardSectionError };

async function requireDashboardUser() {
  if (!isSupabaseConfigured()) throw new Error('SUPABASE_NOT_CONFIGURED');
  const { data, error } = await createClient().auth.getUser();
  if (error) {
    if (error.status === 401 || error.name === 'AuthSessionMissingError') throw new Error('AUTH_REQUIRED');
    throw error;
  }
  if (!data.user) throw new Error('AUTH_REQUIRED');
  return data.user;
}

export function classifyDashboardError(reason: unknown): DashboardSectionError {
  if (reason instanceof Error && reason.message === 'AUTH_REQUIRED') return { kind: 'auth', cause: reason };
  if (reason instanceof Error && reason.message === 'SUPABASE_NOT_CONFIGURED') return { kind: 'setup', cause: reason };
  return { kind: 'unknown', cause: reason };
}

/** Resolve one dashboard query without allowing its failure to reject other sections. */
export async function loadDashboardSection<T>(loader: () => Promise<T>): Promise<DashboardSectionState<T>> {
  try {
    return { status: 'success', data: await loader() };
  } catch (cause: unknown) {
    return { status: 'error', error: classifyDashboardError(cause) };
  }
}

export async function getDashboardDecksData(): Promise<Deck[]> {
  return listDecks();
}

export async function getDashboardQueueData(): Promise<DashboardQueueData> {
  await requireDashboardUser();
  const { data, error } = await createClient().rpc('get_due_cards', { p_limit: 500 });
  if (error) throw error;
  const dueCards = data ?? [];
  const dueNewCount = dueCards.filter((card) => card.state === 'new').length;
  return { dueCards, dueNewCount, dueReviewCount: dueCards.length - dueNewCount };
}

export async function getDashboardStatsData(): Promise<DashboardStatsData> {
  const user = await requireDashboardUser();
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - 6);
  const startDate = weekStart.toISOString().slice(0, 10);
  const [streakResponse, statisticsResponse, gamificationResponse] = await Promise.all([
    createClient().rpc('get_current_streak'),
    createClient()
      .from('daily_statistics')
      .select('stat_date,cards_studied,time_studied_ms,correct_count,incorrect_count')
      .eq('user_id', user.id)
      .gte('stat_date', startDate)
      .order('stat_date', { ascending: true })
      .limit(7),
    createClient()
      .from('user_gamification_profiles')
      .select('xp_total,highest_streak_count,streak_days_count')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);
  if (streakResponse.error) throw streakResponse.error;
  if (statisticsResponse.error) throw statisticsResponse.error;
  if (gamificationResponse.error) throw gamificationResponse.error;
  const stats = statisticsResponse.data ?? [];
  const weeklyCards = stats.reduce((sum, row) => sum + row.cards_studied, 0);
  const weeklyTimeMs = stats.reduce((sum, row) => sum + row.time_studied_ms, 0);
  const correct = stats.reduce((sum, row) => sum + row.correct_count, 0);
  const incorrect = stats.reduce((sum, row) => sum + row.incorrect_count, 0);
  return {
    currentStreak: streakResponse.data ?? 0,
    bestStreak: gamificationResponse.data?.highest_streak_count ?? 0,
    weeklyCards,
    weeklyTimeMs,
    weeklyAccuracy: correct + incorrect === 0 ? 0 : Math.round((correct / (correct + incorrect)) * 100),
    xpTotal: gamificationResponse.data?.xp_total ?? 0,
  };
}

export async function getDashboardLearningPlanData(): Promise<LearningPreferences> {
  const user = await requireDashboardUser();
  const { data, error } = await createClient()
    .from('learning_plans')
    .select('goal,target_date,weekly_minutes,updated_at')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  return data
    ? decodeLearningPreferences({ goal: data.goal, targetDate: data.target_date, weeklyMinutes: data.weekly_minutes, completedAt: data.updated_at })
    : decodeLearningPreferences(null);
}

export function selectNextDashboardDeck(decks: Deck[], dueCards: DueCard[]): Deck | null {
  const dueByDeck = new Map<string, number>();
  for (const card of dueCards) dueByDeck.set(card.deck_id, (dueByDeck.get(card.deck_id) ?? 0) + 1);
  return [...decks]
    .filter((deck) => (dueByDeck.get(deck.id) ?? 0) > 0)
    .sort((left, right) => (dueByDeck.get(right.id) ?? 0) - (dueByDeck.get(left.id) ?? 0))[0] ?? null;
}

export function estimateDashboardMinutes(weeklyCards: number, weeklyTimeMs: number, dueCards: number): number | null {
  return weeklyCards > 0 && weeklyTimeMs > 0 && dueCards > 0
    ? Math.max(1, Math.round((weeklyTimeMs / weeklyCards) * dueCards / 60000))
    : null;
}

/** Backwards-compatible aggregate used by non-interactive callers. The dashboard UI uses the section loaders above. */
export async function getDashboardData(): Promise<DashboardData> {
  const [decks, queue, stats, learningPlan] = await Promise.all([
    getDashboardDecksData(),
    getDashboardQueueData(),
    getDashboardStatsData(),
    getDashboardLearningPlanData(),
  ]);
  return {
    decks,
    ...queue,
    ...stats,
    nextDeck: selectNextDashboardDeck(decks, queue.dueCards),
    estimatedMinutes: estimateDashboardMinutes(stats.weeklyCards, stats.weeklyTimeMs, queue.dueCards.length),
    learningPlan,
  };
}
