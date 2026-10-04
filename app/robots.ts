import type { MetadataRoute } from 'next';
const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/dashboard', '/decks', '/study', '/exams', '/analytics', '/profile', '/tools', '/search', '/templates', '/leaderboard', '/occlusion', '/import', '/export', '/socratic', '/settings', '/media', '/login', '/register', '/forgot-password', '/reset-password'] }],
    ...(siteOrigin ? { sitemap: `${siteOrigin}/sitemap.xml`, host: siteOrigin } : {}),
  };
}
