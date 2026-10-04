import * as Sentry from '@sentry/nextjs';
import posthog from 'posthog-js';

const numberEnv = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
};

const environment = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'production';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  tracesSampleRate: numberEnv('NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE', process.env.NODE_ENV === 'production' ? 0.1 : 1),
  replaysSessionSampleRate: numberEnv('NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE', 0.05),
  replaysOnErrorSampleRate: numberEnv('NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE', 1),
  integrations: [Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true })],
  beforeSend(event) {
    if (event.request?.headers) {
      delete event.request.headers.authorization;
      delete event.request.headers.cookie;
      delete event.request.headers['x-supabase-auth'];
    }
    return event;
  },
});

const posthogToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const supabaseHost = (() => {
  try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname; } catch { return ''; }
})();

if (posthogToken && process.env.NEXT_PUBLIC_POSTHOG_ENABLED !== '0') {
  posthog.init(posthogToken, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    defaults: '2026-05-30',
    autocapture: false,
    capture_pageview: true,
    capture_pageleave: true,
    persistence: 'localStorage+cookie',
    person_profiles: 'identified_only',
    tracing_headers: supabaseHost ? [supabaseHost] : [],
    session_recording: { maskAllInputs: true, blockClass: 'flashi-private-content' },
  });
}
