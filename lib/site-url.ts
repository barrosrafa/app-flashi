const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

if (process.env.NODE_ENV === 'production' && !configuredSiteUrl) {
  throw new Error('NEXT_PUBLIC_SITE_URL must be set to the public HTTPS origin before a production build.');
}

const siteUrl = new URL(configuredSiteUrl || 'http://localhost:3000');

if (siteUrl.pathname !== '/' || siteUrl.search || siteUrl.hash) {
  throw new Error('NEXT_PUBLIC_SITE_URL must contain only the origin, without a path, query, or fragment.');
}

if (
  process.env.NODE_ENV === 'production' &&
  (siteUrl.protocol !== 'https:' || ['localhost', '127.0.0.1', '::1'].includes(siteUrl.hostname))
) {
  throw new Error('NEXT_PUBLIC_SITE_URL must be a public HTTPS origin in production.');
}

export { siteUrl };
