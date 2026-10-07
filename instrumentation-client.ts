import { scrubSentryEvent,scrubBreadcrumb } from './lib/observability/privacy';
import * as Sentry from '@sentry/nextjs';
import posthog from 'posthog-js';

const numberEnv = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
};

const environment = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'production';
const release = process.env.NEXT_PUBLIC_APP_COMMIT ?? process.env.NEXT_PUBLIC_APP_VERSION ?? process.env.VERCEL_GIT_COMMIT_SHA ?? 'local';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment,
  release: `flashi@${release}`,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  tracesSampleRate: numberEnv('NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE', process.env.NODE_ENV === 'production' ? 0.1 : 1),
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  beforeSend: scrubSentryEvent,
  beforeBreadcrumb: scrubBreadcrumb,
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
    capture_pageview: false,
    capture_pageleave: false,
    persistence: 'localStorage+cookie',
    person_profiles: 'identified_only',
    loaded: (client) => { client.register({ app: 'flashi', app_version: release, environment }); },
    tracing_headers: supabaseHost ? [supabaseHost] : [],
    disable_session_recording: true,
  });
}
