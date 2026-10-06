import { withSentryConfig } from '@sentry/nextjs/config';
import type { NextConfig } from 'next';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://fchpvgfjjxjpxfmtsrnc.supabase.co';
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // F01 — Edge Functions are proxied through the application origin so delivery
  // never depends on per-function CORS configuration. Companion client change:
  // lib/supabase/client.ts (withSameOriginEdgeProxy).
  async rewrites() {
    return [{ source: '/functions/v1/:path*', destination: `${supabaseUrl}/functions/v1/:path*` }];
  },
};
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  widenClientFileUpload: true,
});
