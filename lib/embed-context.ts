// Embed-context params keep the mentor in its stripped-down embedded view when
// it's iframed by a host app (the `agent-ai` web component appends them:
// `embed=true`, `mode`, `component`, `extra-body-classes`). They live ONLY in
// the iframe URL's query string, so any client-side navigation that rebuilds
// the path drops them and flips the iframe back to the full app. The worst
// offenders are the automatic hard `window.location.href` resets on tenant
// mismatch / tenant redirect — those can't carry a query string forward at all,
// and once they fire the embed view is lost until the iframe is reloaded from
// the parent (which is why logging out and back in "fixes" it).
//
// To make embed mode survive ANY navigation — including hard resets — we mirror
// the params into `sessionStorage` and let readers fall back to the stored copy
// when the live URL has none.
//
// `sessionStorage` is scoped to the TAB, not to the browsing context: a
// same-origin iframe writes into its parent tab's store. A real host embed is
// cross-origin, so its storage is partitioned away from ours — but the Embed
// tab's own `internalPreview` iframe is same-origin, and its write would flip
// the surrounding app into embed mode on the next render. Hence the two guards
// below: we never persist from the internal preview, and we only trust the
// stored copy when this document is actually framed (`isInIframe`).

import { QUERY_PARAMS } from '@/lib/constants';
import { isInIframe } from '@/lib/utils';

export const EMBED_CONTEXT_KEYS = [
  QUERY_PARAMS.EMBED,
  'mode',
  'component',
  'extra-body-classes',
] as const;

const STORAGE_KEY = 'ibl:embed-context';

type EmbedContext = Record<string, string>;

/** The Embed tab's same-origin preview iframe, which must never persist. */
function isInternalPreview(): boolean {
  return (
    new URLSearchParams(window.location.search).get(
      QUERY_PARAMS.INTERNAL_PREVIEW,
    ) === 'true'
  );
}

function readUrlEmbedContext(): EmbedContext | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get(QUERY_PARAMS.EMBED) !== 'true') return null;
  const ctx: EmbedContext = {};
  for (const key of EMBED_CONTEXT_KEYS) {
    const value = params.get(key);
    if (value !== null) ctx[key] = value;
  }
  return ctx;
}

function readStoredEmbedContext(): EmbedContext | null {
  if (!isInIframe()) return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EmbedContext;
    return parsed?.[QUERY_PARAMS.EMBED] === 'true' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Persist the embed context from the current URL. Call once on first (embedded)
 * load — later hard navigations can then recover embed mode from the store even
 * after they've wiped the URL query. No-op when the URL isn't in embed mode.
 */
export function persistEmbedContextFromUrl(): void {
  if (typeof window === 'undefined' || isInternalPreview()) return;
  const ctx = readUrlEmbedContext();
  if (!ctx) return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ctx));
  } catch {
    // sessionStorage unavailable (private mode / disabled). The live-URL path
    // still works within a single page load; only cross-navigation recovery is lost.
  }
}

/** The embed context from the live URL, falling back to the stored copy. */
export function getEmbedContext(): EmbedContext | null {
  return readUrlEmbedContext() ?? readStoredEmbedContext();
}

/** Whether the app should render in embedded mode (URL or persisted). */
export function isEmbedMode(): boolean {
  return getEmbedContext()?.embed === 'true';
}

/**
 * The embed-context query string (with leading `?`), or '' when not embedded.
 * Append to same-origin navigation targets so they keep the embed view.
 */
export function embedContextQuery(): string {
  const ctx = getEmbedContext();
  if (!ctx) return '';
  const params = new URLSearchParams();
  for (const key of EMBED_CONTEXT_KEYS) {
    if (ctx[key] !== undefined) params.set(key, ctx[key]);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Append the embed-context query to any URL (absolute or path), preserving an
 * existing query/hash. Use for hard `window.location.href` navigations —
 * especially cross-origin ones (tenant custom domains), where sessionStorage
 * doesn't follow and the params must be carried explicitly.
 */
export function appendEmbedContext(url: string): string {
  const qs = embedContextQuery().replace(/^\?/, '');
  if (!qs) return url;
  const [beforeHash, hash] = url.split('#');
  const sep = beforeHash.includes('?') ? '&' : '?';
  return `${beforeHash}${sep}${qs}${hash !== undefined ? `#${hash}` : ''}`;
}
