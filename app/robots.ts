import type { MetadataRoute } from 'next';

import { DISALLOWED_PATHS, getSiteUrl } from '@/lib/seo';

/**
 * Served at `/robots.txt`. Disallows the private/app infrastructure routes and
 * points crawlers at the per-host sitemap. Crawlable routes are still kept out
 * of the index by the noindex default in `buildMetadata` until a page opts in.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = await getSiteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: DISALLOWED_PATHS,
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
