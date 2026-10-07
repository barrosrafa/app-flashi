import posthog from 'posthog-js';
import { safeProperties, safeRoute } from './privacy';
export type SafeAnalyticsProperties = Record<string,string|number|boolean|null|undefined>;
const isEnabled = () => typeof window !== 'undefined' && Boolean(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) && process.env.NEXT_PUBLIC_POSTHOG_ENABLED !== '0';
export function identifyUser(userId:string,properties:SafeAnalyticsProperties={}) { if(isEnabled()) posthog.identify(userId,safeProperties(properties)); }
export function resetAnalytics() { if(isEnabled()) posthog.reset(); }
export function track(event:string,properties:SafeAnalyticsProperties={}) { if(isEnabled()) posthog.capture(event,safeProperties({environment:process.env.NODE_ENV,commit_sha:process.env.NEXT_PUBLIC_APP_COMMIT,route:safeRoute(window.location.pathname),...properties})); }
export function getDistinctId() { return isEnabled()?posthog.get_distinct_id():null; }
