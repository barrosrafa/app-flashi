import { track } from './posthog';

export type AnalyticsEventMap = {
  page_viewed: { route: string };
  signup_started: { surface: 'register' };
  signup_completed: { email_confirmation_required: boolean };
  login_succeeded: { surface: 'login' };
  login_failed: { error_code: string };
  activation_viewed: { surface: 'activation' | 'onboarding' };
  activation_submitted: { surface: 'activation' | 'onboarding'; has_goal: boolean; has_target_date: boolean; weekly_minutes_bucket: string };
  activation_completed: { surface: 'activation' | 'onboarding'; status: 'ACTIVE' | 'PENDING' | 'VALIDATING' | 'FAILED' | 'SUSPENDED'; duration_ms: number; request_id: string | null };
  activation_failed: { surface: 'activation' | 'onboarding'; error_code: string; status: number; request_id: string | null; retryable: boolean };
  sync_started: { pending_mutations: number };
  sync_completed: { synced: number; failed: number; duration_ms: number };
  sync_failed: { error_code: string; pending_mutations: number };
  study_session_started: { deck_id: string; due_cards: number };
  card_rated: { deck_id: string; rating: 'again' | 'hard' | 'good' | 'easy'; response_time_bucket: string };
  study_session_completed: { deck_id: string; cards_reviewed: number; duration_ms: number };
  deck_created: { source: 'manual' | 'import' | 'ai' };
  card_created: { source: 'manual' | 'import' | 'ai'; card_kind: string };
  ai_generation_started: { source_type: string };
  ai_generation_completed: { source_type: string; notes_created: number; cards_created: number };
  ai_generation_failed: { source_type: string; error_code: string };
};

export const weeklyMinutesBucket = (value: string | number | null | undefined) => {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return 'none';
  if (minutes < 60) return '0-59';
  if (minutes < 180) return '60-179';
  if (minutes < 360) return '180-359';
  if (minutes < 600) return '360-599';
  if (minutes < 1200) return '600-1199';
  return '1200+';
};

export const normalizeErrorCode = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? 'UNKNOWN_ERROR');
  const match = message.match(/[A-Z][A-Z0-9_]{2,}/);
  return match?.[0] ?? 'UNKNOWN_ERROR';
};

export function capture<K extends keyof AnalyticsEventMap>(event: K, properties: AnalyticsEventMap[K]) {
  track(event, properties);
}
