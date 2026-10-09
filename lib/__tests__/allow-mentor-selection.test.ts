// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';

import {
  isMentorSelectionAllowed,
  withMentorSelectionEmbedParams,
} from '@/lib/allow-mentor-selection';
import { persistEmbedContextFromUrl } from '@/lib/embed-context';

function setUrl(pathWithQuery: string) {
  window.history.replaceState({}, '', pathWithQuery);
}

function setTop(top: unknown) {
  Object.defineProperty(window, 'top', { value: top, configurable: true });
}

beforeEach(() => {
  window.sessionStorage.clear();
  setUrl('/');
  setTop(window);
});

describe('isMentorSelectionAllowed', () => {
  it('is true only for allow-mentor-selection=true', () => {
    expect(
      isMentorSelectionAllowed(
        new URLSearchParams('allow-mentor-selection=true'),
      ),
    ).toBe(true);
    expect(
      isMentorSelectionAllowed(
        new URLSearchParams('allow-mentor-selection=false'),
      ),
    ).toBe(false);
    expect(
      isMentorSelectionAllowed(new URLSearchParams('allow-mentor-selection=1')),
    ).toBe(false);
    expect(isMentorSelectionAllowed(new URLSearchParams())).toBe(false);
    expect(isMentorSelectionAllowed(null)).toBe(false);
  });

  it('falls back to the persisted embed context when the URL lost the flag', () => {
    setTop({ name: 'host-page' });
    setUrl('/platform/acme/bot-1?embed=true&allow-mentor-selection=true');
    persistEmbedContextFromUrl();
    setUrl('/platform/acme/explore');
    expect(isMentorSelectionAllowed(new URLSearchParams())).toBe(true);
  });

  it('does not trust the persisted flag when the live URL says otherwise', () => {
    setTop({ name: 'host-page' });
    setUrl('/platform/acme/bot-1?embed=true&allow-mentor-selection=true');
    persistEmbedContextFromUrl();
    setUrl('/platform/acme/bot-1?embed=true');
    expect(isMentorSelectionAllowed(new URLSearchParams('embed=true'))).toBe(
      false,
    );
  });
});

describe('withMentorSelectionEmbedParams', () => {
  const EMBED_QUERY =
    'embed=true&mode=anonymous&allow-mentor-selection=true&hide-navbar=true&hide-sidebar=false&compact=false&foo=bar';

  beforeEach(() => {
    setUrl(`/platform/acme/bot-1?${EMBED_QUERY}`);
  });

  it('carries the embed context and display params, but not unrelated ones', () => {
    const out = withMentorSelectionEmbedParams(
      '/platform/acme/bot-1/explore',
      new URLSearchParams(EMBED_QUERY),
    );
    const [path, query] = out.split('?');
    const params = new URLSearchParams(query);
    expect(path).toBe('/platform/acme/bot-1/explore');
    expect(params.get('embed')).toBe('true');
    expect(params.get('mode')).toBe('anonymous');
    expect(params.get('allow-mentor-selection')).toBe('true');
    expect(params.get('hide-navbar')).toBe('true');
    expect(params.get('hide-sidebar')).toBe('false');
    expect(params.get('compact')).toBe('false');
    expect(params.has('foo')).toBe(false);
  });

  it('keeps an existing query and hash on the target', () => {
    const out = withMentorSelectionEmbedParams(
      '/platform/acme/bot-2?switching-mentor=true#top',
      new URLSearchParams(EMBED_QUERY),
    );
    expect(out.startsWith('/platform/acme/bot-2?switching-mentor=true&')).toBe(
      true,
    );
    expect(out.endsWith('#top')).toBe(true);
    expect(out).toContain('allow-mentor-selection=true');
  });

  it('does not override a display param already on the target', () => {
    const out = withMentorSelectionEmbedParams(
      '/platform/acme/bot-2?hide-navbar=false',
      new URLSearchParams(EMBED_QUERY),
    );
    expect(
      new URLSearchParams(out.split('?')[1]).getAll('hide-navbar'),
    ).toEqual(['false']);
  });

  it('returns the bare path when there is nothing to carry', () => {
    setUrl('/platform/acme/bot-1');
    expect(withMentorSelectionEmbedParams('/platform/acme/explore', null)).toBe(
      '/platform/acme/explore',
    );
  });
});
