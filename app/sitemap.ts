import type { MetadataRoute } from 'next';
export const dynamic = 'force-dynamic';
export default function sitemap(): MetadataRoute.Sitemap {
  const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  if (!siteOrigin) return [];
  return [''].map((path) => ({
    url: `${siteOrigin}${path}`,
    changeFrequency: path ? 'yearly' : 'weekly',
    priority: path ? 0.4 : 1,
  }));
}
