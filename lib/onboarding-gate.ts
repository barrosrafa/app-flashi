function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Metadata is a convenience cache. A persisted plan with an active (or absent)
 * activation record is authoritative, matching the onboarding service contract.
 */
export function shouldRedirectToOnboarding(
  userMetadata: unknown,
  hasPersistedPlan: boolean,
  activationStatus: string | null,
): boolean {
  if (!isRecord(userMetadata) || userMetadata.flashi_onboarding_required !== true) return false;

  const preferences = isRecord(userMetadata.flashi_product_preferences)
    ? userMetadata.flashi_product_preferences
    : null;
  if (preferences?.completedAt) return false;

  const persistedActivationIsComplete = hasPersistedPlan
    && (activationStatus === null || activationStatus === 'ACTIVE');
  return !persistedActivationIsComplete;
}
