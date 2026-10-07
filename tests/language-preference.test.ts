import { describe, expect, it } from 'vitest';
import { shouldApplySyncedLocale } from '../contexts/LanguageContext';

describe('language preference synchronization', () => {
  it('applies only the latest committed profile read', () => {
    expect(shouldApplySyncedLocale({
      syncGeneration: 2,
      latestSyncGeneration: 2,
      preferenceGeneration: 0,
      latestPreferenceGeneration: 0,
      committedPreferenceGeneration: 0,
      requestStartedWhileSaving: false,
      hasPendingPreference: false,
    })).toBe(true);

    // The first read can resolve after a newer SIGNED_IN read.
    expect(shouldApplySyncedLocale({
      syncGeneration: 1,
      latestSyncGeneration: 2,
      preferenceGeneration: 0,
      latestPreferenceGeneration: 0,
      committedPreferenceGeneration: 0,
      requestStartedWhileSaving: false,
      hasPendingPreference: false,
    })).toBe(false);
  });

  it('does not let a profile read overwrite a new selection while it is saving', () => {
    // A stale read started before selecting EN/ES has an older preference generation.
    expect(shouldApplySyncedLocale({
      syncGeneration: 1,
      latestSyncGeneration: 1,
      preferenceGeneration: 0,
      latestPreferenceGeneration: 1,
      committedPreferenceGeneration: 0,
      requestStartedWhileSaving: false,
      hasPendingPreference: true,
    })).toBe(false);

    // A read started during the save is also discarded even if the save finishes first.
    expect(shouldApplySyncedLocale({
      syncGeneration: 2,
      latestSyncGeneration: 2,
      preferenceGeneration: 1,
      latestPreferenceGeneration: 1,
      committedPreferenceGeneration: 1,
      requestStartedWhileSaving: true,
      hasPendingPreference: false,
    })).toBe(false);

    // A later read, after the new preference is committed, may update the UI.
    expect(shouldApplySyncedLocale({
      syncGeneration: 3,
      latestSyncGeneration: 3,
      preferenceGeneration: 1,
      latestPreferenceGeneration: 1,
      committedPreferenceGeneration: 1,
      requestStartedWhileSaving: false,
      hasPendingPreference: false,
    })).toBe(true);
  });
});
