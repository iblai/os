import type { Metadata } from 'next';
import { headers } from 'next/headers';

import { config } from '@/lib/config';

/**
 * SEO core module.
 *
 * The mentor app is a multi-tenant SPA served across many hostnames
 * (os.ibl.ai, *.iblai.app, custom domains). Canonical / Open Graph URLs and the
 * robots + sitemap hosts are therefore derived from the *request* host at
 * runtime rather than a single hardcoded domain. The root layout is
 * `force-dynamic`, so reading `headers()` here is free.
 *
 * Indexing is OFF by default (`buildMetadata` sets robots noindex). Individual
 * public pages opt in with `buildMetadata({ index: true, ... })`. This keeps the
 * authenticated app surface out of search results unless a page is explicitly
 * marked public.
 */

/** Human-facing brand/site name. */
export const SITE_NAME = 'ibl.ai';

/** Default document title (used as the template default). */
export const DEFAULT_TITLE = 'ibl.ai | Agentic OS';

/** Default meta description. Keep under ~160 chars. */
export const DEFAULT_DESCRIPTION =
  'ibl.ai is an agentic OS for building, training, and deploying AI mentors and assistants.';

/** Twitter/X handle for `twitter:site` (leave empty to omit). */
export const TWITTER_HANDLE = '';

/** Default social share image (replace with a dedicated 1200x630 asset). */
export const DEFAULT_OG_IMAGE = '/iblai-logo.png';

/**
 * Route prefixes that are private/app-only and must never be crawled or
 * indexed. Consumed by `app/robots.ts`. Keep in sync with new infra routes.
 */
export const DISALLOWED_PATHS: string[] = [
  '/api/',
  '/sso-login',
  '/sso-login-complete',
  '/mobile-sso-login',
  '/google-oauth-callback',
  '/provider-association',
  '/create-mentor',
  '/reports',
  '/uploads',
  '/version',
  '/error',
];

/**
 * Resolve the absolute origin for the current request (no trailing slash).
 *
 * Priority: forwarded/host request headers → `NEXT_PUBLIC_MENTOR_URL` →
 * the mentor default. Works per-tenant so each hostname advertises itself in
 * canonical tags, robots, and the sitemap.
 */
export async function getSiteUrl(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get('x-forwarded-host') ?? h.get('host');
    if (host) {
      const proto =
        h.get('x-forwarded-proto') ??
        (host.startsWith('localhost') || host.startsWith('127.0.0.1')
          ? 'http'
          : 'https');
      return `${proto}://${host}`.replace(/\/$/, '');
    }
  } catch {
    // headers() unavailable (e.g. build-time) — fall through to env.
  }
  return config.mentorUrl().replace(/\/$/, '');
}

/** Join a path onto an origin, guarding against double slashes. */
export function joinUrl(origin: string, path = '/'): string {
  if (!path || path === '/') return `${origin}/`;
  return `${origin}/${path.replace(/^\/+/, '')}`;
}

export interface BuildMetadataOptions {
  /** Page-specific title. Rendered as "<title> | ibl.ai" via the template. */
  title?: string;
  /** Page-specific description (falls back to the site default). */
  description?: string;
  /** Pathname for the canonical URL, e.g. "/share/chat/abc". */
  path?: string;
  /** Absolute or root-relative image URLs for OG/Twitter cards. */
  images?: string[];
  /** Opt this page IN to indexing. Defaults to false (noindex). */
  index?: boolean;
  /** Extra keywords. */
  keywords?: string[];
  /** Open Graph type. */
  type?: 'website' | 'article' | 'profile';
  /** Marks this as the root layout metadata (adds title template + manifest). */
  root?: boolean;
}

/**
 * Build a Next.js `Metadata` object with sane, multi-tenant-aware defaults.
 * Use in a route's `generateMetadata()`:
 *
 * @example
 * export async function generateMetadata() {
 *   return buildMetadata({ title: 'Shared chat', path: '/share/chat/abc', index: true });
 * }
 */
export async function buildMetadata(
  options: BuildMetadataOptions = {},
): Promise<Metadata> {
  const {
    title,
    description = DEFAULT_DESCRIPTION,
    path = '/',
    images = [DEFAULT_OG_IMAGE],
    index = false,
    keywords,
    type = 'website',
    root = false,
  } = options;

  const origin = await getSiteUrl();
  const canonical = joinUrl(origin, path);

  const metadata: Metadata = {
    metadataBase: new URL(origin),
    description,
    applicationName: SITE_NAME,
    keywords,
    alternates: { canonical },
    robots: {
      index,
      follow: index,
      googleBot: {
        index,
        follow: index,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
    openGraph: {
      type,
      siteName: SITE_NAME,
      title: title ?? DEFAULT_TITLE,
      description,
      url: canonical,
      images: images.map((url) => ({ url })),
    },
    twitter: {
      card: 'summary_large_image',
      title: title ?? DEFAULT_TITLE,
      description,
      images,
      ...(TWITTER_HANDLE ? { site: TWITTER_HANDLE } : {}),
    },
  };

  // Title handling: the root sets the default + template; a page with an
  // explicit title flows through the `%s | ibl.ai` template. A page with NO
  // title omits the key entirely so Next inherits the root default (setting
  // `title: undefined` would instead drop the <title> tag).
  if (root) {
    metadata.title = { default: DEFAULT_TITLE, template: `%s | ${SITE_NAME}` };
  } else if (title) {
    metadata.title = title;
  }

  if (root) {
    metadata.icons = {
      icon: '/favicon.png',
      shortcut: '/favicon.png',
      apple: '/favicon.png',
    };
    metadata.manifest = '/manifest.webmanifest';
  }

  return metadata;
}

/** JSON-LD Organization node for the site. */
export function organizationJsonLd(origin: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: `${origin}/`,
    logo: joinUrl(origin, DEFAULT_OG_IMAGE),
  };
}

/** JSON-LD WebSite node for the site. */
export function websiteJsonLd(origin: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: `${origin}/`,
  };
}
