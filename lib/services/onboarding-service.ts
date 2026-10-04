import { createClient, isSupabaseConfigured } from '../supabase/client';

export const learningGoals = ['exam', 'competition', 'language', 'university', 'other'] as const;
export type LearningGoal = typeof learningGoals[number];

export type LearningPreferences = {
  goal: LearningGoal | null;
  targetDate: string | null;
  weeklyMinutes: number | null;
  completedAt: string | null;
};

export type LearningDraft = Omit<LearningPreferences, 'completedAt'> & {
  step: 1 | 2;
};

export type OnboardingState = {
  preferences: LearningPreferences;
  draft: LearningDraft | null;
  required: boolean;
};

const emptyPreferences: LearningPreferences = {
  goal: null,
  targetDate: null,
  weeklyMinutes: null,
  completedAt: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function isLearningGoal(value: unknown): value is LearningGoal {
  return typeof value === 'string' && learningGoals.includes(value as LearningGoal);
}

function validWeeklyMinutes(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isInteger(value) && value >= 15 && value <= 10080);
}

export function decodeLearningPreferences(value: unknown): LearningPreferences {
  if (!isRecord(value)) return emptyPreferences;
  return {
    goal: isLearningGoal(value.goal) ? value.goal : null,
    targetDate: isIsoDate(value.targetDate) ? value.targetDate : null,
    weeklyMinutes: validWeeklyMinutes(value.weeklyMinutes) ? value.weeklyMinutes : null,
    completedAt: typeof value.completedAt === 'string' ? value.completedAt : null,
  };
}

export function decodeLearningDraft(value: unknown): LearningDraft | null {
  if (!isRecord(value) || (value.step !== 1 && value.step !== 2)) return null;
  const preferences = decodeLearningPreferences(value);
  return {
    goal: preferences.goal,
    targetDate: preferences.targetDate,
    weeklyMinutes: preferences.weeklyMinutes,
    step: value.step,
  };
}

export function isOnboardingRequired(userMetadata: unknown): boolean {
  if (!isRecord(userMetadata)) return false;
  const preferences = decodeLearningPreferences(userMetadata.flashi_product_preferences);
  return userMetadata.flashi_onboarding_required === true && !preferences.completedAt;
}

export function validateLearningPreferences(input: {
  goal: LearningGoal | null;
  targetDate: string | null;
  weeklyMinutes: number | null;
}): string | null {
  if (input.goal !== null && !isLearningGoal(input.goal)) return 'ONBOARDING_GOAL_INVALID';
  if (input.targetDate !== null && !isIsoDate(input.targetDate)) return 'ONBOARDING_DATE_INVALID';
  if (input.targetDate && !input.goal) return 'ONBOARDING_GOAL_REQUIRED_FOR_DATE';
  if (!validWeeklyMinutes(input.weeklyMinutes)) return 'ONBOARDING_CAPACITY_INVALID';
  return null;
}

async function requireUser() {
  if (!isSupabaseConfigured()) throw new Error('SUPABASE_NOT_CONFIGURED');
  const supabase = createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    if (error.name === 'AuthSessionMissingError' || error.status === 401) throw new Error('AUTH_REQUIRED');
    throw error;
  }
  if (!data.user) throw new Error('AUTH_REQUIRED');
  return { supabase, user: data.user };
}

async function updateUserMetadata(updates: Record<string, unknown>) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.auth.updateUser({
    data: { ...(user.user_metadata ?? {}), ...updates },
  });
  if (error) throw error;
}

export async function getOnboardingState(): Promise<OnboardingState> {
  const { user } = await requireUser();
  const metadata = user.user_metadata ?? {};
  return {
    preferences: decodeLearningPreferences(metadata.flashi_product_preferences),
    draft: decodeLearningDraft(metadata.flashi_onboarding_draft),
    required: isOnboardingRequired(metadata),
  };
}

export async function saveOnboardingDraft(input: {
  goal: LearningGoal;
  targetDate: string | null;
  weeklyMinutes: number | null;
  step: 1 | 2;
}) {
  const validationError = validateLearningPreferences(input);
  if (validationError) throw new Error(validationError);
  const draft: LearningDraft = { ...input };
  await updateUserMetadata({ flashi_onboarding_draft: draft });
  return draft;
}

export async function saveLearningPreferences(input: {
  goal: LearningGoal | null;
  targetDate: string | null;
  weeklyMinutes: number | null;
}) {
  const validationError = validateLearningPreferences(input);
  if (validationError) throw new Error(validationError);
  const preferences: LearningPreferences = {
    ...input,
    completedAt: new Date().toISOString(),
  };
  await updateUserMetadata({
    flashi_onboarding_required: false,
    flashi_onboarding_draft: null,
    flashi_product_preferences: preferences,
  });
  return preferences;
}

export async function skipOnboarding() {
  return saveLearningPreferences({ goal: null, targetDate: null, weeklyMinutes: null });
}
