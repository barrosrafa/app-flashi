import { describe, expect, it } from 'vitest';
import { shouldRedirectToOnboarding } from '../lib/onboarding-gate';

const staleRequiredMetadata = { flashi_onboarding_required: true };

describe('onboarding route gate', () => {
  it('keeps onboarding required when there is no completed metadata or persisted activation', () => {
    expect(shouldRedirectToOnboarding(staleRequiredMetadata, false, 'UNKNOWN')).toBe(true);
  });

  it('allows the dashboard when the persisted plan is active even if metadata is stale', () => {
    expect(shouldRedirectToOnboarding(staleRequiredMetadata, true, 'ACTIVE')).toBe(false);
  });

  it('allows onboarding completion recorded in auth metadata', () => {
    expect(shouldRedirectToOnboarding({
      flashi_onboarding_required: true,
      flashi_product_preferences: { completedAt: '2026-10-07T11:00:00.000Z' },
    }, false, 'UNKNOWN')).toBe(false);
  });

  it('keeps the gate closed while persisted activation is pending or failed', () => {
    expect(shouldRedirectToOnboarding(staleRequiredMetadata, true, 'PENDING')).toBe(true);
    expect(shouldRedirectToOnboarding(staleRequiredMetadata, true, 'FAILED')).toBe(true);
  });

  it('does not gate users without the onboarding-required flag', () => {
    expect(shouldRedirectToOnboarding({}, false, 'UNKNOWN')).toBe(false);
  });
});
