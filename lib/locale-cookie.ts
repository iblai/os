import { config } from '@/lib/config';
import {
  LOCALE_COOKIE,
  OPENEDX_LOCALE_COOKIE,
  resolveLocale,
  type Locale,
} from '@/i18n/config';

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Compute the registrable parent domain for the shared Open edX cookie so it is
 * visible across subdomains. For `mentorai.iblai.app` this returns `.iblai.app`.
 *
 * Prefers the configured platform base domain (`NEXT_PUBLIC_PLATFORM_BASE_DOMAIN`),
 * falling back to dropping the left-most label of the current hostname. Returns
 * `undefined` for localhost / bare IPs (browsers reject a domain attribute there).
 */
export function getParentCookieDomain(): string | undefined {
  const hostname =
    typeof window !== 'undefined' ? window.location.hostname : '';
  // localhost / bare IP: browsers reject a `domain` attribute → host-only cookie.
  if (
    !hostname ||
    hostname === 'localhost' ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)
  ) {
    return undefined;
  }
  // Prefer the configured platform base domain, but only when the current host
  // actually lives under it (otherwise the browser would reject the cookie).
  const base = config.platformBaseDomain?.();
  if (base) {
    const normalized = base.startsWith('.') ? base.slice(1) : base;
    if (hostname === normalized || hostname.endsWith(`.${normalized}`)) {
      return `.${normalized}`;
    }
  }
  // Fallback: drop the left-most label of the current host.
  const labels = hostname.split('.');
  if (labels.length <= 2) return `.${hostname}`;
  return `.${labels.slice(1).join('.')}`;
}

function writeCookie(name: string, value: string, domain?: string) {
  const parts = [
    `${name}=${value}`,
    'path=/',
    `max-age=${ONE_YEAR}`,
    'samesite=lax',
  ];
  if (domain) parts.push(`domain=${domain}`);
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    parts.push('secure');
  }
  document.cookie = parts.join('; ');
}

/**
 * Persist the selected language to both cookies:
 * - `NEXT_LOCALE` (host-only) so next-intl SSR serves it on the next request.
 * - `openedx-language-preference` on the parent domain so the choice syncs
 *   across all IBL subdomain apps (and Open edX).
 *
 * Call from any client UI that changes the language, then `router.refresh()`.
 */
export function syncLanguageCookies(locale: string): Locale {
  const value = resolveLocale(locale);
  writeCookie(LOCALE_COOKIE, value);
  writeCookie(OPENEDX_LOCALE_COOKIE, value, getParentCookieDomain());
  return value;
}
