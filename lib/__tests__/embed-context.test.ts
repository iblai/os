// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import {
  persistEmbedContextFromUrl,
  getEmbedContext,
  isEmbedMode,
  embedContextQuery,
  appendEmbedContext,
} from '@/lib/embed-context';

/** Point window.location at a path+query the way a real navigation would. */
function setUrl(pathWithQuery: string) {
  window.history.replaceState({}, '', pathWithQuery);
}

/** Model an iframe: `window.top` is some other browsing context. */
function framed() {
  Object.defineProperty(window, 'top', {
    value: { name: 'host-page' },
    configurable: true,
  });
}

/** Model a standalone tab: `window.top` is this window. */
function topLevel() {
  Object.defineProperty(window, 'top', { value: window, configurable: true });
}

const EMBED_URL =
  '/platform/acme/bot-1?embed=true&mode=anonymous&component=chat&extra-body-classes=iframed-externally';

beforeEach(() => {
  window.sessionStorage.clear();
  setUrl('/');
  topLevel();
});

describe('not in embed mode', () => {
  it('returns empty/none when the URL has no embed param and nothing is stored', () => {
    expect(getEmbedContext()).toBeNull();
    expect(isEmbedMode()).toBe(false);
    expect(embedContextQuery()).toBe('');
  });

  it('persistEmbedContextFromUrl is a no-op when not embedded', () => {
    persistEmbedContextFromUrl();
    expect(window.sessionStorage.getItem('ibl:embed-context')).toBeNull();
  });

  it('appendEmbedContext leaves the URL unchanged', () => {
    expect(appendEmbedContext('/platform/acme/x')).toBe('/platform/acme/x');
  });
});

describe('reading embed context from the live URL', () => {
  beforeEach(() => setUrl(EMBED_URL));

  it('detects embed mode and preserves all four keys', () => {
    expect(isEmbedMode()).toBe(true);
    expect(getEmbedContext()).toEqual({
      embed: 'true',
      mode: 'anonymous',
      component: 'chat',
      'extra-body-classes': 'iframed-externally',
    });
    expect(embedContextQuery()).toBe(
      '?embed=true&mode=anonymous&component=chat&extra-body-classes=iframed-externally',
    );
  });

  it('omits keys that are not present in the URL', () => {
    setUrl('/platform/acme/bot-1?embed=true&mode=anonymous');
    expect(embedContextQuery()).toBe('?embed=true&mode=anonymous');
  });
});

describe('surviving a hard navigation that wipes the query (the bug)', () => {
  it('recovers embed mode from sessionStorage after window.location goes to "/"', () => {
    // 1. Embedded iframe loads with the params and persists them.
    framed();
    setUrl(EMBED_URL);
    persistEmbedContextFromUrl();

    // 2. A tenant-mismatch hard reset navigates to "/" with NO query.
    setUrl('/');
    expect(new URLSearchParams(window.location.search).get('embed')).toBeNull();

    // 3. Embed mode is still recovered from the persisted copy.
    expect(isEmbedMode()).toBe(true);
    expect(getEmbedContext()).toMatchObject({
      embed: 'true',
      mode: 'anonymous',
    });
    expect(embedContextQuery()).toContain('embed=true');
  });

  it('the live URL wins over a stale stored copy', () => {
    framed();
    setUrl('/platform/acme/bot-1?embed=true&component=analytics-overview');
    persistEmbedContextFromUrl();
    // A fresh embedded load with a different component.
    setUrl('/platform/acme/bot-1?embed=true&component=recent-messages');
    expect(getEmbedContext()?.component).toBe('recent-messages');
  });
});

describe('appendEmbedContext', () => {
  beforeEach(() => setUrl(EMBED_URL));

  it('appends with "?" to a bare path', () => {
    expect(appendEmbedContext('/')).toBe(
      '/?embed=true&mode=anonymous&component=chat&extra-body-classes=iframed-externally',
    );
  });

  it('appends with "&" when the target already has a query', () => {
    expect(appendEmbedContext('https://acme.ibl.ai/platform?foo=1')).toBe(
      'https://acme.ibl.ai/platform?foo=1&embed=true&mode=anonymous&component=chat&extra-body-classes=iframed-externally',
    );
  });

  it('preserves a trailing hash fragment', () => {
    expect(appendEmbedContext('/platform#section')).toBe(
      '/platform?embed=true&mode=anonymous&component=chat&extra-body-classes=iframed-externally#section',
    );
  });

  it('works cross-origin (tenant custom domain)', () => {
    expect(appendEmbedContext('https://tenant.example.com')).toBe(
      'https://tenant.example.com?embed=true&mode=anonymous&component=chat&extra-body-classes=iframed-externally',
    );
  });
});

describe('resilience', () => {
  it('ignores a stored copy whose embed flag is not "true"', () => {
    framed();
    setUrl('/');
    window.sessionStorage.setItem(
      'ibl:embed-context',
      JSON.stringify({ embed: 'false', mode: 'anonymous' }),
    );
    expect(isEmbedMode()).toBe(false);
    expect(getEmbedContext()).toBeNull();
  });

  it('ignores malformed JSON in storage', () => {
    framed();
    setUrl('/');
    window.sessionStorage.setItem('ibl:embed-context', '{not json');
    expect(getEmbedContext()).toBeNull();
  });

  it('swallows sessionStorage write failures', () => {
    setUrl(EMBED_URL);
    const spy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('QuotaExceeded');
      });
    expect(() => persistEmbedContextFromUrl()).not.toThrow();
    spy.mockRestore();
  });
});

describe('the Embed tab preview must not leak embed mode into the tab', () => {
  const PREVIEW_URL =
    '/platform/acme/bot-1?mentor=bot-1&embed=true&internalPreview=true&tenant=acme&mode=anonymous&chat=default';

  it('the internal preview never writes to sessionStorage', () => {
    framed();
    setUrl(PREVIEW_URL);
    persistEmbedContextFromUrl();
    expect(window.sessionStorage.getItem('ibl:embed-context')).toBeNull();
  });

  it('the internal preview is still in embed mode via its own URL', () => {
    framed();
    setUrl(PREVIEW_URL);
    expect(isEmbedMode()).toBe(true);
  });

  it('a top-level tab ignores a stored copy a same-origin iframe wrote', () => {
    window.sessionStorage.setItem(
      'ibl:embed-context',
      JSON.stringify({ embed: 'true', mode: 'anonymous' }),
    );
    setUrl('/platform/acme/bot-1');
    expect(isEmbedMode()).toBe(false);
    expect(getEmbedContext()).toBeNull();
    expect(embedContextQuery()).toBe('');
  });

  it('opening the Embed tab leaves the surrounding app out of embed mode', () => {
    // The app tab sits on a plain chat URL.
    setUrl('/platform/acme/bot-1');
    expect(isEmbedMode()).toBe(false);

    // The preview iframe boots inside it and runs its own Providers effect.
    framed();
    setUrl(PREVIEW_URL);
    persistEmbedContextFromUrl();

    // Back in the top-level tab: still the full app, on re-render and reload.
    topLevel();
    setUrl('/platform/acme/bot-1');
    expect(isEmbedMode()).toBe(false);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
