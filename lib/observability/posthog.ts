import posthog from 'posthog-js';

export type SafeAnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

const isEnabled = () => typeof window !== 'undefined' && Boolean(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) && process.env.NEXT_PUBLIC_POSTHOG_ENABLED !== '0';

export function identifyUser(userId: string, properties: SafeAnalyticsProperties = {}) { if (isEnabled()) posthog.identify(userId, properties); }
export function resetAnalytics() { if (isEnabled()) posthog.reset(); }
export function track(event: string, properties: SafeAnalyticsProperties = {}) { if (isEnabled()) posthog.capture(event, properties); }
export function getDistinctId() { return isEnabled() ? posthog.get_distinct_id() : null; }
