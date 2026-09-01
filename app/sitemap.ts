import type { MetadataRoute } from 'next';

import { getSiteUrl, joinUrl } from '@/lib/seo';

/**
 * Served at `/sitemap.xml`. Locale is cookie-based (no per-locale URLs), so each
 * public path appears once. Only genuinely public, indexable pages belong here.
 *
 * As we work through the app page-by-page, add public routes to
 * `STATIC_PUBLIC_PATHS` (and, for dynamic public content such as public mentors
 * or shared chats, fetch and map them into additional entries below).
 */
const STATIC_PUBLIC_PATHS: Array<{
  path: string;
  changeFrequency?: MetadataRoute.Sitemap[number]['changeFrequency'];
  priority?: number;
}> = [{ path: '/', changeFrequency: 'weekly', priority: 1 }];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await getSiteUrl();
  const lastModified = new Date();

  return STATIC_PUBLIC_PATHS.map(({ path, changeFrequency, priority }) => ({
    url: joinUrl(origin, path),
    lastModified,
    changeFrequency,
    priority,
  }));
}
