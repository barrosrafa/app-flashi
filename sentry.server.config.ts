import * as Sentry from '@sentry/nextjs';
import { scrubSentryEvent,scrubBreadcrumb } from './lib/observability/privacy';
const dsn=process.env.SENTRY_DSN??process.env.NEXT_PUBLIC_SENTRY_DSN;
Sentry.init({ dsn,enabled:Boolean(dsn),environment:process.env.SENTRY_ENVIRONMENT??process.env.NODE_ENV,release:`flashi@${process.env.VERCEL_GIT_COMMIT_SHA??process.env.NEXT_PUBLIC_APP_COMMIT??'local'}`,tracesSampleRate:0.1,beforeSend:scrubSentryEvent,beforeBreadcrumb:scrubBreadcrumb });
