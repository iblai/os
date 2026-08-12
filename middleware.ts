import { NextRequest, NextResponse } from 'next/server';

/**
 * Content-Security-Policy middleware.
 *
 * Emits a per-request, nonce-based CSP so Next.js's inline hydration/bootstrap
 * scripts are trusted WITHOUT `script-src 'unsafe-inline'`. `'strict-dynamic'`
 * lets scripts that our nonced scripts load programmatically (the Google Drive
 * picker via `load-script`, Stripe.js, Sentry, etc.) inherit trust, so we don't
 * have to maintain a per-host script allowlist. Next.js reads the nonce off the
 * `Content-Security-Policy` request header and stamps it onto its own scripts.
 *
 * ── Mode ─────────────────────────────────────────────────────────────────────
 * **Enforced by default** (violations are blocked). Opt out with
 * `CSP_MODE=report-only` — which local dev sets in `.env.development` so
 * `next dev`'s HMR / eval / error overlay aren't blocked. Use `report-only`
 * anywhere to observe without blocking (e.g. to validate a new third-party
 * origin). Wire `CSP_REPORT_URI` to collect violations.
 *
 * NOTE: mode is deliberately NOT keyed off `NODE_ENV`. Next.js inlines
 * `process.env.NODE_ENV` into the middleware bundle at BUILD time, so an image
 * built with `NODE_ENV=development` (as some deploy pipelines do) would wrongly
 * stay report-only in production regardless of the runtime NODE_ENV.
 *
 * Any static `Content-Security-Policy` header set upstream (e.g. the current
 * Nginx `add_header`) MUST be removed when this ships — a browser intersects
 * multiple CSP headers, so the static `default-src 'self'` one would keep
 * blocking the nonced scripts and the Sentry Replay blob worker regardless of
 * this policy. Keep the *static* security headers (HSTS, X-Content-Type-Options,
 * Referrer-Policy) in Nginx; only CSP moves here because only CSP needs the nonce.
 */

// Read at request time (not module load) so it's unit-testable without
// re-importing. Enforce unless CSP_MODE is 'report-only'; an unrecognized value
// fails SAFE to report-only rather than surprise-blocking on a typo.
const isEnforce = () => {
  const mode = process.env.CSP_MODE;
  if (mode === 'report-only') return false;
  if (mode && mode !== 'enforce') return false; // unrecognized → fail safe
  return true; // 'enforce' or unset → enforce
};
// Optional violation sink (e.g. a Sentry CSP endpoint). Reports go to the
// browser console when unset — enough to validate the Report-Only rollout.
const reportUri = () => process.env.CSP_REPORT_URI;

// ibl.ai infrastructure — wildcarded because the concrete hosts (API base, DM,
// auth, LMS, ASGI, LiveKit, Sentry) are env-driven per deployment. Third-party
// origins are listed explicitly.
const IBL_HTTP = [
  'https://*.iblai.app',
  'https://*.ibl.ai',
  'https://*.ibl.network', // Sentry (sentry.ibl.network)
  // Non-`.app` first-party domains used by staging / some environments (e.g.
  // learn.stg1.iblai.org for the LMS/edX + APIs) — else enforce blocks them.
  'https://*.iblai.org',
  'https://*.iblai.tech',
];
const IBL_WS = [
  'wss://*.iblai.app',
  'wss://*.ibl.ai',
  'wss://*.iblai.org',
  'wss://*.iblai.tech',
]; // ASGI + LiveKit
const GOOGLE = [
  'https://apis.google.com',
  'https://*.googleapis.com',
  'https://accounts.google.com',
];
const STRIPE = ['https://js.stripe.com', 'https://api.stripe.com'];
// S3 presigned URLs for media (e.g. iblai-app-dm-media) — chat file uploads PUT
// straight to the bucket and downloads GET from it, which the browser treats as
// fetch/XHR connections, so the bucket host must be in connect-src. Virtual-hosted
// style; a CSP host wildcard only covers the leading label, so this matches
// <bucket>.s3.amazonaws.com. Regional endpoints (<bucket>.s3.<region>.amazonaws.com)
// would need that region added.
const AWS_S3 = ['https://*.s3.amazonaws.com'];
// Customer/partner institution domains served from the institution's own host
// (SSO / LMS / API endpoints). Override via CSP_PARTNER_HOSTS (comma/space-
// separated); defaults to Syracuse when unset. Read at request time (like
// isEnforce/reportUri) so it isn't frozen at module load / build time.
const DEFAULT_PARTNER_HOSTS = ['https://*.syr.edu']; // Syracuse University
const partnerHosts = () => {
  const raw = process.env.CSP_PARTNER_HOSTS?.trim();
  return raw ? raw.split(/[\s,]+/).filter(Boolean) : DEFAULT_PARTNER_HOSTS;
};

/** Allow the configured API base origin if it lives outside the ibl wildcards. */
function apiBaseOrigin(): string[] {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!apiBase) return [];
  try {
    const { origin, hostname } = new URL(apiBase);
    if (
      /(\.iblai\.app|\.ibl\.ai|\.ibl\.network|\.iblai\.org|\.iblai\.tech)$/.test(
        hostname,
      )
    )
      return [];
    return [origin];
  } catch {
    return [];
  }
}

/**
 * Allow the immutable-static CDN origin (e.g. assets.ibl.ai) when static assets
 * are served cross-origin from it. Derived from the SAME NEXT_PUBLIC_ASSET_CDN
 * that next.config.ts bakes into assetPrefix, so the CSP and the emitted asset
 * URLs can't drift. Accepts a bare host or a full URL; returns [] when unset
 * (assets served same-origin) so this is a no-op then. script-src/img-src/
 * media-src already allow it via strict-dynamic / `https:`; the gap this closes
 * is style-src + font-src (and connect-src for chunk prefetch/fetch).
 */
function assetCdnOrigin(): string[] {
  let cdn = process.env.NEXT_PUBLIC_ASSET_CDN?.trim();
  if (!cdn) return [];
  if (!/^https?:\/\//i.test(cdn)) cdn = `https://${cdn}`;
  try {
    return [new URL(cdn).origin];
  } catch {
    return [];
  }
}

function buildCsp(nonce: string): string {
  const extra = apiBaseOrigin();
  const assetCdn = assetCdnOrigin();
  const partners = partnerHosts();
  // connect-src also needs the wss:// origin of each https:// partner host —
  // browsers don't treat an https:// source as covering wss:// to the same host
  // (e.g. Syracuse's wss://asgi.data.ai.syr.edu needs wss://*.syr.edu).
  const partnerWs = partners
    .filter((h) => h.startsWith('https://'))
    .map((h) => `wss://${h.slice('https://'.length)}`);

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    // Modern browsers use nonce + strict-dynamic and IGNORE `'unsafe-inline'`
    // and `https:` here; those two are only a fallback for pre-CSP3 browsers.
    'script-src': [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      // eval is only needed by `next dev` (React Refresh); allow it in
      // report-only mode (which is what dev runs), never when enforcing.
      ...(!isEnforce() ? ["'unsafe-eval'"] : []),
      'https:',
      "'unsafe-inline'",
    ],
    // React `style={{…}}` attributes can't carry a nonce, so inline styles still
    // need 'unsafe-inline'. Tracked to migrate to CSS classes to drop this.
    'style-src': ["'self'", "'unsafe-inline'", ...assetCdn],
    'img-src': ["'self'", 'data:', 'blob:', 'https:'], // avatars/mentor images vary
    'font-src': ["'self'", 'data:', ...assetCdn],
    'media-src': ["'self'", 'data:', 'blob:', 'https:'], // TTS audio / recordings
    'connect-src': [
      "'self'",
      ...IBL_HTTP,
      ...IBL_WS,
      ...GOOGLE,
      ...STRIPE,
      ...AWS_S3,
      ...assetCdn,
      ...partners,
      ...partnerWs,
      ...extra,
    ],
    // Sentry Session Replay creates a compression worker from a blob: URL.
    'worker-src': ["'self'", 'blob:'],
    'frame-src': [
      "'self'",
      ...IBL_HTTP,
      ...partners,
      'https://accounts.google.com',
      'https://content.googleapis.com',
      'https://docs.google.com',
      'https://drive.google.com',
      'https://js.stripe.com',
      'https://hooks.stripe.com',
      'https://www.youtube.com',
      'https://www.youtube-nocookie.com',
    ],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'", ...IBL_HTTP],
    // NOTE: intentionally NO `frame-ancestors` — the app runs in EMBED mode
    // inside arbitrary customer sites, so framing must not be restricted here.
    // `upgrade-insecure-requests` is a no-op (and warns) in a report-only
    // policy, so it's only emitted when enforcing.
    ...(isEnforce() ? { 'upgrade-insecure-requests': [] } : {}),
  };

  const policy = Object.entries(directives)
    .map(([key, values]) =>
      values.length ? `${key} ${values.join(' ')}` : key,
    )
    .join('; ');

  const sink = reportUri();
  return sink ? `${policy}; report-uri ${sink}` : policy;
}

/** Cryptographically-random base64 nonce (Web Crypto — available in the edge runtime). */
function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export function middleware(request: NextRequest) {
  const nonce = generateNonce();
  const csp = buildCsp(nonce);

  // Next.js reads the nonce from the CSP on the REQUEST headers to stamp its own
  // scripts; `x-nonce` lets our components read it too when they need to inline.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(
    isEnforce()
      ? 'Content-Security-Policy'
      : 'Content-Security-Policy-Report-Only',
    csp,
  );
  return response;
}

export const config = {
  matcher: [
    // Documents only — skip API routes, static assets, the image optimizer, and
    // prefetches (they run no scripts, so the header would just be overhead).
    {
      source:
        '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|avif|woff2?|css|js|map)$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
