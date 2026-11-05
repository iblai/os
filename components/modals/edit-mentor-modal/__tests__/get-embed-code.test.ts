// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getEmbedCode } from '../utils';
import type {
  CustomFloatingBubbleConfig,
  EmbedFormValues,
} from '../hooks/useEmbedTab';

const DM_BASE = 'https://api.iblai.org/dm';
const AXD_BASE = 'https://api.iblai.org/axd';

// The default launcher thumbnail is a DM (manager) endpoint. On the unified API
// gateway axdUrl() resolves to an invalid `/axd` prefix (HTTP 404), so the embed
// code builder must use dmUrl() for the thumbnail. These mocks let us assert the
// exact base used without hitting the network.
vi.mock('@/lib/config', () => ({
  config: {
    dmUrl: () => DM_BASE,
    axdUrl: () => AXD_BASE,
    mentorIframeUrl: () => 'https://mentor.example.com',
    authUrl: () => 'https://auth.example.com',
  },
}));

// `allow_anonymous` is no longer an embed-form field (#2476); the hook reads it
// from the persisted mentor settings and passes it in alongside the form values.
const settings: EmbedFormValues & { allow_anonymous: boolean } = {
  description: '',
  website_url: '',
  mode: 'default',
  allow_anonymous: false,
  is_context_aware: false,
  safety_disclaimer: false,
  sso: false,
  auto_open: false,
  sso_provider: '',
  metadata: {
    primary_color: '#2467eb',
    secondary_color: '#000',
    safety_disclaimer: false,
  },
  slug: 'my-mentor',
  icon_selection: 'default',
  show_catalogue: true,
  starter_prompts: 'guided_prompt',
  strip_page_content_html: false,
};

describe('getEmbedCode default bubble image (thumbnail uses dm, not axd)', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true }) as Response),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('fetches the thumbnail from the dm base, never /axd/', async () => {
    const code = await getEmbedCode('acme', settings, 'redirect-token');

    const expectedThumbnailUrl = `${DM_BASE}/api/core/orgs/acme/thumbnail/`;

    // fetch was called with the dm thumbnail URL...
    expect(fetch).toHaveBeenCalledWith(expectedThumbnailUrl);

    // ...and never with an /axd/ thumbnail URL.
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const fetchedUrls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(fetchedUrls.some((u) => u.includes('/axd/'))).toBe(false);

    // The generated embed snippet wires the bubble image to the dm URL.
    expect(code).toContain(expectedThumbnailUrl);
    expect(code).not.toContain(`${AXD_BASE}/api/core/orgs/`);
  });

  it('falls back to the main-tenant thumbnail via the dm base on a non-ok primary response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false } as Response)
      .mockResolvedValueOnce({ ok: true } as Response);
    vi.stubGlobal('fetch', fetchMock);

    const code = await getEmbedCode('acme', settings, 'redirect-token');

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `${DM_BASE}/api/core/orgs/acme/thumbnail/`,
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `${DM_BASE}/api/core/orgs/main/thumbnail/`,
    );
    expect(code).toContain(`${DM_BASE}/api/core/orgs/main/thumbnail/`);
  });
});

describe('getEmbedCode allow-mentor-selection param', () => {
  const EMBED_URL =
    'https://mentor.example.com/platform/acme/my-mentor?embed=true&extra-body-classes=iframed-externally';

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true }) as Response),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('leaves the embed URL unchanged by default', async () => {
    const code = await getEmbedCode('acme', settings, 'redirect-token');

    expect(code).toContain(`iframe.src = '${EMBED_URL}';`);
    expect(code).not.toContain('allow-mentor-selection');
  });

  it('produces the same code when allow_mentor_selection is false', async () => {
    const baseline = await getEmbedCode('acme', settings, 'redirect-token');
    const off = await getEmbedCode(
      'acme',
      { ...settings, allow_mentor_selection: false },
      'redirect-token',
    );

    expect(off).toBe(baseline);
  });

  it('adds allow-mentor-selection=true to the embed URL when allow_mentor_selection is on', async () => {
    const code = await getEmbedCode(
      'acme',
      { ...settings, allow_mentor_selection: true },
      'redirect-token',
    );

    expect(code).toContain(
      `iframe.src = '${EMBED_URL}&allow-mentor-selection=true';`,
    );
  });

  it('keeps chat=advanced alongside allow-mentor-selection', async () => {
    const code = await getEmbedCode(
      'acme',
      { ...settings, mode: 'advanced', allow_mentor_selection: true },
      'redirect-token',
    );

    expect(code).toContain(
      `iframe.src = '${EMBED_URL}&chat=advanced&allow-mentor-selection=true';`,
    );
  });
});

describe('getEmbedCode allow-fullscreen', () => {
  const EMBED_URL =
    'https://mentor.example.com/platform/acme/my-mentor?embed=true&extra-body-classes=iframed-externally';
  const anonymous = { ...settings, allow_anonymous: true };
  const hostListeners: EventListener[] = [];

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true }) as Response),
    );
    // The snippet focuses the iframe on a 100ms timer, which would otherwise
    // fire after jsdom is torn down.
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    hostListeners
      .splice(0)
      .forEach((listener) => window.removeEventListener('message', listener));
    document.body.innerHTML = '';
  });

  function runSnippet(code: string) {
    const script = code.split('<script>')[1].split('</script>')[0];
    new Function(script)();
    const add = vi.spyOn(window, 'addEventListener');
    (window.onload as () => void)();
    add.mock.calls
      .filter(([type]) => type === 'message')
      .forEach(([, listener]) => hostListeners.push(listener as EventListener));
    add.mockRestore();
  }

  function postToHost(data: unknown) {
    window.dispatchEvent(new MessageEvent('message', { data }));
  }

  const widget = () =>
    document.getElementById('ibl-chat-widget-container') as HTMLDivElement;
  const bubble = () =>
    document.querySelector('.ibl-chat-bubble') as HTMLButtonElement;

  it('leaves the URL and the snippet unchanged when off', async () => {
    const baseline = await getEmbedCode('acme', settings, 'redirect-token');
    const off = await getEmbedCode(
      'acme',
      { ...settings, allow_fullscreen: false },
      'redirect-token',
    );

    expect(off).toBe(baseline);
    expect(off).not.toContain('allow-fullscreen');
    expect(off).not.toContain('embedFullscreen');
    expect(off).not.toContain('setWidgetFullscreen');
  });

  it('adds allow-fullscreen=true to the embed URL and the handler when on', async () => {
    const code = await getEmbedCode(
      'acme',
      { ...settings, allow_mentor_selection: true, allow_fullscreen: true },
      'redirect-token',
    );

    expect(code).toContain(
      `iframe.src = '${EMBED_URL}&allow-mentor-selection=true&allow-fullscreen=true';`,
    );
    expect(code).toContain('message?.embedFullscreen');
  });

  it('switches the widget to full screen and back on embedFullscreen messages', async () => {
    const code = await getEmbedCode(
      'acme',
      { ...anonymous, allow_fullscreen: true },
      'redirect-token',
    );
    runSnippet(code);
    bubble().click();
    const normal = widget().style.cssText;
    const iframe = widget().querySelector('iframe') as HTMLIFrameElement;

    postToHost({ embedFullscreen: true });
    expect(widget().style.position).toBe('fixed');
    expect(widget().style.width).toBe('100vw');
    expect(widget().style.height).toBe('100vh');
    expect(widget().style.getPropertyPriority('width')).toBe('important');
    expect(iframe.style.borderRadius).toBe('0');
    expect(bubble().style.display).toBe('none');

    postToHost(JSON.stringify({ embedFullscreen: true }));
    postToHost({ embedFullscreen: false });
    expect(widget().style.cssText).toBe(normal);
    expect(iframe.style.borderRadius).toBe('13px');
    expect(bubble().style.display).toBe('');

    postToHost({ embedFullscreen: false });
    expect(widget().style.cssText).toBe(normal);
  });

  it('reopens at normal size after being closed while full screen', async () => {
    const code = await getEmbedCode(
      'acme',
      { ...anonymous, allow_fullscreen: true },
      'redirect-token',
    );
    runSnippet(code);
    bubble().click();
    const normal = widget().style.cssText;

    postToHost({ embedFullscreen: true });
    postToHost({ closeEmbed: true });
    expect(widget().style.display).toBe('none');
    expect(bubble().style.display).toBe('');

    bubble().click();
    expect(widget().style.cssText).toBe(normal);
  });

  it('ignores embedFullscreen before the widget exists', async () => {
    const code = await getEmbedCode(
      'acme',
      { ...anonymous, allow_fullscreen: true },
      'redirect-token',
    );
    runSnippet(code);

    expect(() => postToHost({ embedFullscreen: true })).not.toThrow();
    expect(widget()).toBeNull();
  });

  it('ignores embedFullscreen messages when off', async () => {
    const code = await getEmbedCode('acme', anonymous, 'redirect-token');
    runSnippet(code);
    bubble().click();
    const normal = widget().style.cssText;

    postToHost({ embedFullscreen: true });
    expect(widget().style.cssText).toBe(normal);
  });
});

describe('getEmbedCode snippet variants', () => {
  const bubble: CustomFloatingBubbleConfig = {
    image: '',
    position: 'bottom-right',
    size: 'medium',
    backgroundColor: '#fff',
    textColor: '#000',
    subtitleTextColor: '#333',
    accentColor: '#2467eb',
    borderRadius: 12,
    shadow: true,
    title: 'Ask us',
    subtitle: 'We reply fast',
    height: 60,
    padding: 10,
    imageSize: 32,
    fontSize: 14,
    subtitleFontSize: 12,
    strokeColor: '#ccc',
    strokeWidth: 1,
  } as CustomFloatingBubbleConfig;

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubThumbnail(ok: (url: string) => boolean) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => ({ ok: ok(url) }) as Response),
    );
  }

  it.each([
    ['bottom-right', 'right: 30px'],
    ['bottom-left', 'left: 30px'],
    ['top-right', 'right: 30px'],
    ['top-left', 'left: 30px'],
  ] as const)(
    'places a custom %s launcher and its widget',
    async (position, side) => {
      stubThumbnail(() => true);
      const code = await getEmbedCode(
        'acme',
        { ...settings, mode: 'advanced' },
        'redirect-token',
        true,
        { ...bubble, position },
      );
      expect(code).toContain(side);
      expect(code).toContain('Ask us');
      expect(code).toContain('We reply fast');
      expect(code).toContain('box-shadow');
      expect(code).toContain('border: 1px solid #ccc;');
    },
  );

  it('pins a top-left launcher widget in the default window size', async () => {
    stubThumbnail(() => true);
    const code = await getEmbedCode('acme', settings, 'redirect-token', true, {
      ...bubble,
      position: 'top-left',
      subtitle: '',
    });
    expect(code).toContain('top: 92px; left: 30px;');
    expect(code).not.toContain('We reply fast');
  });

  it('renders a subtitle without a title', async () => {
    stubThumbnail(() => true);
    const code = await getEmbedCode('acme', settings, 'redirect-token', true, {
      ...bubble,
      title: '',
    });
    expect(code).toContain('We reply fast');
    expect(code).not.toContain('Ask us');
  });

  it('renders a plain custom launcher without title, shadow or stroke', async () => {
    stubThumbnail(() => true);
    const code = await getEmbedCode('acme', settings, 'redirect-token', true, {
      ...bubble,
      title: '',
      subtitle: '',
      shadow: false,
      strokeWidth: 0,
      image: '',
      imageSize: 0,
    });
    expect(code).not.toContain('box-shadow');
    expect(code).toContain('border: none;');
    expect(code).toContain('width: 32px');
  });

  it('emits context-aware and auto-open code when those are on', async () => {
    stubThumbnail(() => true);
    const code = await getEmbedCode(
      'acme',
      {
        ...settings,
        allow_anonymous: true,
        is_context_aware: true,
        auto_open: true,
        sso_provider: 'okta',
      },
      'redirect-token',
    );
    expect(code).toContain('MENTOR:CONTEXT_UPDATE');
    expect(code).toContain('sendHostInfoToIframe();');
    expect(code).toContain('if (!isWidgetInjected)');
    expect(code).toContain('custom_sso_backend_path=okta');
    expect(code).not.toContain('redirect-token=redirect-token');
  });

  it('falls back to the main thumbnail, then to the default image', async () => {
    stubThumbnail((url) => url.includes('/orgs/main/'));
    expect(await getEmbedCode('acme', settings, 't')).toContain(
      `${DM_BASE}/api/core/orgs/main/thumbnail/`,
    );

    stubThumbnail(() => false);
    expect(await getEmbedCode('acme', settings, 't')).toContain(
      '/images/ibl-logo-animated.gif',
    );
    expect(await getEmbedCode('main', settings, 't')).toContain(
      '/images/ibl-logo-animated.gif',
    );
  });

  it('keeps the default image when the thumbnail request throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    expect(await getEmbedCode('acme', settings, 't')).toContain(
      '/images/ibl-logo-animated.gif',
    );
  });
});

// An embed whose tab is seeded from a sibling on another organization lands on
// the wrong one and cannot recover alone: `authExpired` only re-sends the same
// organization's auth, so the embed would ask forever. It posts `tenantSwitch`
// instead, which `agent-ai` answers — and so, now, does the generated snippet.
describe('getEmbedCode tenant switch', () => {
  const anonymous = { ...settings, allow_anonymous: true };
  const hostListeners: EventListener[] = [];
  let realLocation: Location;
  const origin = window.location.origin;

  const session = (tenant: string) =>
    encodeURIComponent(
      JSON.stringify({ tenant, userData: JSON.stringify({ user_id: 7 }) }),
    );

  // Same origin as the test document: the snippet strips `ibl-data` with
  // history.replaceState, which jsdom refuses across origins.
  function setUrl(search: string) {
    const href = `${origin}/page${search}`;
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: {
        href,
        origin,
        pathname: '/page',
        search,
        toString: () => href,
      },
    });
  }

  beforeEach(() => {
    realLocation = window.location;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true }) as Response),
    );
    vi.useFakeTimers();
    setUrl('');
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: realLocation,
    });
    hostListeners
      .splice(0)
      .forEach((listener) => window.removeEventListener('message', listener));
    document.body.innerHTML = '';
  });

  function runSnippet(code: string) {
    const script = code.split('<script>')[1].split('</script>')[0];
    new Function(script)();
    const add = vi.spyOn(window, 'addEventListener');
    (window.onload as () => void)();
    add.mock.calls
      .filter(([type]) => type === 'message')
      .forEach(([, listener]) => hostListeners.push(listener as EventListener));
    add.mockRestore();
  }

  function postToHost(data: unknown) {
    window.dispatchEvent(new MessageEvent('message', { data }));
  }

  /** Opens the widget and watches what the host posts into the iframe. */
  function openWidget() {
    (document.querySelector('.ibl-chat-bubble') as HTMLButtonElement).click();
    const iframe = document.querySelector(
      '#ibl-chat-widget-container iframe',
    ) as HTMLIFrameElement;
    return vi.spyOn(iframe.contentWindow!, 'postMessage');
  }

  it('re-sends the cached session when the embed asks for the pinned organization', async () => {
    setUrl(`?ibl-data=${session('acme')}`);
    runSnippet(await getEmbedCode('acme', settings, 'redirect-token'));
    const posted = openWidget();

    postToHost({ tenantSwitch: true, tenant: 'acme' });

    expect(posted).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'MENTOR:AUTH_UPDATE' }),
      '*',
    );
  });

  it('accepts the JSON-string form the embed chain also carries', async () => {
    setUrl(`?ibl-data=${session('acme')}`);
    runSnippet(await getEmbedCode('acme', settings, 'redirect-token'));
    const posted = openWidget();

    postToHost(JSON.stringify({ tenantSwitch: true, tenant: 'acme' }));

    expect(posted).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'MENTOR:AUTH_UPDATE' }),
      '*',
    );
  });

  it('refuses a request for an organization this embed is not pinned to', async () => {
    setUrl(`?ibl-data=${session('acme')}`);
    runSnippet(await getEmbedCode('acme', settings, 'redirect-token'));
    const posted = openWidget();
    const before = window.location.href;

    postToHost({ tenantSwitch: true, tenant: 'other-org' });

    expect(posted).not.toHaveBeenCalled();
    expect(window.location.href).toBe(before);
  });

  it('ignores a request that names no organization', async () => {
    setUrl(`?ibl-data=${session('acme')}`);
    runSnippet(await getEmbedCode('acme', settings, 'redirect-token'));
    const posted = openWidget();

    postToHost({ tenantSwitch: true });

    expect(posted).not.toHaveBeenCalled();
  });

  // The embed cannot reach the chooser itself: navigating a storage-partitioned
  // iframe would tear it out of this page. It hands over the address instead,
  // and the host opens a real tab, which comes back with the new session.
  it('opens the organization chooser in a tab when the embed hands over its address', async () => {
    const open = vi.fn();
    Object.defineProperty(window, 'open', {
      value: open,
      writable: true,
      configurable: true,
    });
    setUrl(`?ibl-data=${session('acme')}`);
    runSnippet(await getEmbedCode('acme', settings, 'redirect-token'));
    const posted = openWidget();
    const before = window.location.href;

    postToHost({
      tenantSwitch: true,
      chooserUrl: 'https://login.example.com/me?action=switch-tenant&popup=1',
    });

    expect(open).toHaveBeenCalledWith(
      'https://login.example.com/me?action=switch-tenant&popup=1',
      'ibl-organizations',
    );
    // The page the embed lives on is left exactly as it was.
    expect(window.location.href).toBe(before);
    expect(posted).not.toHaveBeenCalled();
  });

  it('sends the user to sign in when the cached session is another organization’s', async () => {
    setUrl(`?ibl-data=${session('other-org')}`);
    runSnippet(await getEmbedCode('acme', settings, 'redirect-token'));
    const posted = openWidget();

    postToHost({ tenantSwitch: true, tenant: 'acme' });

    expect(posted).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'MENTOR:AUTH_UPDATE' }),
      '*',
    );
    expect(window.location.href).toContain('https://auth.example.com/login');
    expect(window.location.href).toContain('tenant=acme');
    expect(window.location.href).not.toContain('logout=true');
  });

  it('sends the user to sign in when there is no cached session at all', async () => {
    runSnippet(await getEmbedCode('acme', settings, 'redirect-token'));
    openWidget();

    postToHost({ tenantSwitch: true, tenant: 'acme' });

    expect(window.location.href).toContain('tenant=acme');
  });

  it('survives an unreadable ibl-data rather than throwing at the embed', async () => {
    setUrl('?ibl-data=not-json');
    runSnippet(await getEmbedCode('acme', settings, 'redirect-token'));
    openWidget();

    expect(() =>
      postToHost({ tenantSwitch: true, tenant: 'acme' }),
    ).not.toThrow();
  });

  it('leaves an anonymous embed where it is, having no session to switch', async () => {
    runSnippet(await getEmbedCode('acme', anonymous, 'redirect-token'));
    const posted = openWidget();
    const before = window.location.href;

    postToHost({ tenantSwitch: true, tenant: 'acme' });

    expect(posted).not.toHaveBeenCalled();
    expect(window.location.href).toBe(before);
  });
});
