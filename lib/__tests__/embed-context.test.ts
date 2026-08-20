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

const EMBED_URL =
  '/platform/acme/bot-1?embed=true&mode=anonymous&component=chat&extra-body-classes=iframed-externally';

beforeEach(() => {
  window.sessionStorage.clear();
  setUrl('/');
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
    setUrl('/');
    window.sessionStorage.setItem(
      'ibl:embed-context',
      JSON.stringify({ embed: 'false', mode: 'anonymous' }),
    );
    expect(isEmbedMode()).toBe(false);
    expect(getEmbedContext()).toBeNull();
  });

  it('ignores malformed JSON in storage', () => {
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

afterEach(() => {
  vi.restoreAllMocks();
});
