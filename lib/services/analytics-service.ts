import { createClient } from '../supabase/client';

export type AnalyticsDay = {
  date: string;
  label: string;
  cards: number;
  minutes: number;
};

export type AnalyticsData = {
  retention: number;
  cardsThisWeek: number;
  cardsPreviousWeek: number;
  averageTimeSeconds: number;
  accuracy: number;
  accuracyPreviousWeek: number | null;
  totalTimeMs: number;
  days: AnalyticsDay[];
};

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDay(date: string) {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(new Date(`${date}T12:00:00`)).replace('.', '').slice(0, 1).toUpperCase();
}

export async function getAnalyticsData(): Promise<AnalyticsData> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('AUTH_REQUIRED');

  const now = new Date();
  const currentWeekStart = new Date(now);
  currentWeekStart.setDate(now.getDate() - 6);
  const previousWeekStart = new Date(now);
  previousWeekStart.setDate(now.getDate() - 13);
  const startDate = dateOnly(previousWeekStart);

  const [{ data: statistics, error: statisticsError }, { data: reviews, error: reviewsError }] = await Promise.all([
    supabase
      .from('daily_statistics')
      .select('stat_date,cards_studied,time_studied_ms,correct_count,incorrect_count')
      .eq('user_id', user.id)
      .gte('stat_date', startDate)
      .order('stat_date', { ascending: true })
      .limit(14),
    supabase
      .from('review_logs')
      .select('reviewed_at,rating,time_spent_ms')
      .eq('user_id', user.id)
      .gte('reviewed_at', `${startDate}T00:00:00.000Z`)
      .order('reviewed_at', { ascending: true })
      .limit(5000),
  ]);

  if (statisticsError) throw statisticsError;
  if (reviewsError) throw reviewsError;

  const currentStartDate = dateOnly(currentWeekStart);
  const currentStatistics = (statistics ?? []).filter((row) => row.stat_date >= currentStartDate);
  const previousStatistics = (statistics ?? []).filter((row) => row.stat_date < currentStartDate);
  const currentReviews = (reviews ?? []).filter((review) => review.reviewed_at >= `${currentStartDate}T00:00:00.000Z`);
  const correct = currentStatistics.reduce((sum, row) => sum + row.correct_count, 0);
  const incorrect = currentStatistics.reduce((sum, row) => sum + row.incorrect_count, 0);
  const totalAttempts = correct + incorrect;
  const accuracy = totalAttempts === 0 ? 0 : Math.round((correct / totalAttempts) * 100);
  const previousCorrect = previousStatistics.reduce((sum, row) => sum + row.correct_count, 0);
  const previousIncorrect = previousStatistics.reduce((sum, row) => sum + row.incorrect_count, 0);
  const previousAttempts = previousCorrect + previousIncorrect;
  const accuracyPreviousWeek = previousAttempts === 0 ? null : Math.round((previousCorrect / previousAttempts) * 100);
  const averageTimeSeconds = currentReviews.length === 0
    ? 0
    : Math.round(currentReviews.reduce((sum, review) => sum + (review.time_spent_ms ?? 0), 0) / currentReviews.length / 1000);
  const cardsThisWeek = currentStatistics.reduce((sum, row) => sum + row.cards_studied, 0);
  const cardsPreviousWeek = previousStatistics.reduce((sum, row) => sum + row.cards_studied, 0);

  const days: AnalyticsDay[] = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(currentWeekStart);
    date.setDate(currentWeekStart.getDate() + index);
    const key = dateOnly(date);
    const row = currentStatistics.find((item) => item.stat_date === key);
    return {
      date: key,
      label: formatDay(key),
      cards: row?.cards_studied ?? 0,
      minutes: Math.round((row?.time_studied_ms ?? 0) / 60000),
    };
  });

  return {
    retention: accuracy,
    cardsThisWeek,
    cardsPreviousWeek,
    averageTimeSeconds,
    accuracy,
    accuracyPreviousWeek,
    totalTimeMs: currentStatistics.reduce((sum, row) => sum + row.time_studied_ms, 0),
    days,
  };
}


export async function getAnalyticsRange(days: 7 | 30 | 90) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('AUTH_REQUIRED');
  const since = new Date(); since.setDate(since.getDate() - days + 1);
  const { data, error } = await supabase.from('daily_statistics').select('stat_date,cards_studied,time_studied_ms,correct_count,incorrect_count').eq('user_id', user.id).gte('stat_date', dateOnly(since)).order('stat_date');
  if (error) throw error;
  return data ?? [];
}

export async function getRetentionByDeck(deckId: string, days = 30) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('AUTH_REQUIRED');
  const since = new Date(); since.setDate(since.getDate() - days + 1);
  const { data, error } = await supabase.from('review_logs').select('reviewed_at,rating,card_id').eq('user_id', user.id).gte('reviewed_at', since.toISOString()).in('card_id', (await supabase.from('cards').select('id').eq('deck_id', deckId)).data?.map((row) => row.id) ?? []);
  if (error) throw error;
  const grouped = new Map<string, { total: number; correct: number }>();
  for (const row of data ?? []) { const date = row.reviewed_at.slice(0, 10); const item = grouped.get(date) ?? { total: 0, correct: 0 }; item.total += 1; if (row.rating !== 'again') item.correct += 1; grouped.set(date, item); }
  return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, retention: value.total ? Math.round(value.correct / value.total * 100) : 0 }));
}
