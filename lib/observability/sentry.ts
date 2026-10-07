import { safeProperties } from './privacy';
import * as Sentry from '@sentry/nextjs';

export function setUser(userId: string | null) { if (typeof window !== 'undefined') Sentry.setUser(userId ? { id: userId } : null); }
export function setTag(key: string, value: string | number | boolean) { Sentry.setTag(key, String(value)); }
export function captureException(error: unknown, context: { tags?: Record<string, string>; extra?: Record<string, unknown> } = {}) {
  Sentry.withScope((scope) => {
    Object.entries(context.tags ?? {}).forEach(([key, value]) => scope.setTag(key, value));
    Object.entries(context.extra ?? {}).forEach(([key, value]) => scope.setExtra(key, safeProperties({[key]:value})[key]));
    Sentry.captureException(error);
  });
}
