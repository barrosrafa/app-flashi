import { describe, expect, it } from 'vitest';
import {
  decodeLearningDraft,
  decodeLearningPreferences,
  isOnboardingRequired,
  validateLearningPreferences,
} from '../lib/services/onboarding-service';

describe('onboarding preference contracts', () => {
  it('decodes only supported goals, real calendar dates, and bounded weekly minutes', () => {
    expect(decodeLearningPreferences({
      goal: 'language',
      targetDate: '2027-03-20',
      weeklyMinutes: 180,
      completedAt: '2026-10-04T00:00:00.000Z',
    })).toEqual({
      goal: 'language',
      targetDate: '2027-03-20',
      weeklyMinutes: 180,
      completedAt: '2026-10-04T00:00:00.000Z',
    });
    expect(decodeLearningPreferences({ goal: 'unknown', targetDate: '2027-02-31', weeklyMinutes: 10081 }))
      .toEqual({ goal: null, targetDate: null, weeklyMinutes: null, completedAt: null });
  });

  it('only gates a newly registered user who still has an incomplete onboarding flag', () => {
    expect(isOnboardingRequired({ flashi_onboarding_required: true })).toBe(true);
    expect(isOnboardingRequired({ flashi_onboarding_required: false })).toBe(false);
    expect(isOnboardingRequired({})).toBe(false);
    expect(isOnboardingRequired({
      flashi_onboarding_required: true,
      flashi_product_preferences: { goal: 'exam', completedAt: '2026-10-04T00:00:00.000Z' },
    })).toBe(false);
  });

  it('accepts a resumable draft only for the supported steps', () => {
    expect(decodeLearningDraft({ goal: 'exam', targetDate: null, weeklyMinutes: null, step: 2 }))
      .toEqual({ goal: 'exam', targetDate: null, weeklyMinutes: null, step: 2 });
    expect(decodeLearningDraft({ goal: 'exam', step: 3 })).toBeNull();
  });

  it('keeps target dates optional and validates weekly capacity at the service boundary', () => {
    expect(validateLearningPreferences({ goal: 'exam', targetDate: null, weeklyMinutes: null })).toBeNull();
    expect(validateLearningPreferences({ goal: null, targetDate: null, weeklyMinutes: 15 })).toBeNull();
    expect(validateLearningPreferences({ goal: 'exam', targetDate: '2026-10-04', weeklyMinutes: 10081 }))
      .toBe('ONBOARDING_CAPACITY_INVALID');
    expect(validateLearningPreferences({ goal: null, targetDate: '2027-01-01', weeklyMinutes: null }))
      .toBe('ONBOARDING_GOAL_REQUIRED_FOR_DATE');
  });
});
