import * as Sentry from '@sentry/nextjs';

export function setUser(userId: string | null) { if (typeof window !== 'undefined') Sentry.setUser(userId ? { id: userId } : null); }
export function setTag(key: string, value: string | number | boolean) { Sentry.setTag(key, String(value)); }
export function captureException(error: unknown, context: { tags?: Record<string, string>; extra?: Record<string, unknown> } = {}) {
  Sentry.withScope((scope) => {
    Object.entries(context.tags ?? {}).forEach(([key, value]) => scope.setTag(key, value));
    Object.entries(context.extra ?? {}).forEach(([key, value]) => scope.setExtra(key, sanitizeExtra(value)));
    Sentry.captureException(error);
  });
}
function sanitizeExtra(value: unknown): unknown {
  if (value === null || value === undefined || typeof value !== 'object') return value;
  if (Array.isArray(value)) return `[array:${value.length}]`;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([key]) => !/token|secret|password|authorization|cookie|prompt|response|front|back|content/i.test(key)).map(([key, item]) => [key, typeof item === 'object' ? '[object]' : item]));
}
