// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getEmbedCode } from '../utils';
import type {
  CustomFloatingBubbleConfig,
  EmbedFormValues,
} from '../hooks/useEmbedTab';

const DM_BASE = 'https://api.iblai.org/dm';
const AXD_BASE = 'https://api.iblai.org/axd';
const SDK_URL = 'https://assets.ibl.ai/web/mentorai.js?versionId=test-version';

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
    legacyLmsUrl: () => 'https://learn.example.com',
    agentAiSdkUrl: () => SDK_URL,
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

const build = (
  overrides: Partial<typeof settings> = {},
  redirectToken = 'redirect-token',
  useCustomBubble?: boolean,
  bubbleConfig?: CustomFloatingBubbleConfig,
) =>
  getEmbedCode(
    'acme',
    { ...settings, ...overrides },
    redirectToken,
    useCustomBubble,
    bubbleConfig,
  );

/**
 * The attributes the snippet sets on `<agent-ai>`, read back out of the
 * generated `setAttribute` calls. Asserting on these rather than on the
 * iframe URL is the point of the change: the URL is the component's business
 * now, and this snippet's job is to describe the embed correctly.
 */
const attributesOf = (code: string): Record<string, string> => {
  const found: Record<string, string> = {};
  const pattern = /agent\.setAttribute\("([^"]+)", "([^"]*)"\)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(code)) !== null) {
    found[match[1]] = match[2];
  }
  return found;
};

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

describe('getEmbedCode loads the agent-ai bundle', () => {
  it('loads the pinned bundle the config names', async () => {
    const code = await build();

    expect(code).toContain(`<script src="${SDK_URL}"></script>`);
  });

  /**
   * A pasted snippet keeps running whatever it was generated with, so the
   * version has to be baked in — an unpinned URL would hand every existing
   * embed a new widget with nobody re-copying anything.
   */
  it('pins a version rather than tracking latest', async () => {
    expect(await build()).toContain('versionId=');
  });

  it('mounts the component rather than building an iframe itself', async () => {
    const code = await build();

    expect(code).toContain("document.createElement('agent-ai')");
    expect(code).not.toContain("document.createElement('iframe')");
  });

  /**
   * All of this moved into the component. Finding it here again would mean
   * the snippet had started duplicating auth or context handling that an
   * already-pasted embed can never be updated to fix.
   */
  it('hand-rolls no auth, context or tenant-switch logic', async () => {
    const code = await build({ is_context_aware: true });

    expect(code).not.toContain('MENTOR:AUTH_UPDATE');
    expect(code).not.toContain('MENTOR:CONTEXT_UPDATE');
    expect(code).not.toContain('getCleanBodyContent');
    expect(code).not.toContain('redirectToAuthSPA');
    expect(code).not.toContain('switchOrganizationViaAuthSPA');
    expect(code).not.toContain('ibl-data');
  });
});

describe('getEmbedCode agent attributes', () => {
  it('names where the agent, auth and LMS live', async () => {
    const attrs = attributesOf(await build());

    expect(attrs.mentorurl).toBe('https://mentor.example.com');
    expect(attrs.authurl).toBe('https://auth.example.com');
    expect(attrs.lmsurl).toBe('https://learn.example.com');
    expect(attrs.tenant).toBe('acme');
    expect(attrs.mentor).toBe('my-mentor');
  });

  it('tells the agent it is framed by someone else', async () => {
    expect(attributesOf(await build()).extraparams).toContain(
      'extra-body-classes=iframed-externally',
    );
  });

  it.each([
    ['isadvanced', { mode: 'advanced' as const }],
    ['isanonymous', { allow_anonymous: true }],
    ['iscontextaware', { is_context_aware: true }],
    ['allowmentorselection', { allow_mentor_selection: true }],
    ['allowfullscreen', { allow_fullscreen: true }],
  ])('sets %s when the setting is on', async (attr, overrides) => {
    expect(attributesOf(await build(overrides as never))).toHaveProperty(attr);
  });

  it.each([
    ['isadvanced', {}],
    ['isanonymous', {}],
    ['iscontextaware', {}],
    ['allowmentorselection', {}],
    ['allowfullscreen', {}],
  ])('leaves %s off when the setting is off', async (attr, overrides) => {
    expect(attributesOf(await build(overrides))).not.toHaveProperty(attr);
  });

  /**
   * A tenant wired to its own identity provider has to reach that provider's
   * login; without this the visitor lands on the default one.
   */
  it('forwards a custom SSO backend', async () => {
    expect(
      attributesOf(await build({ sso_provider: 'azuread-oauth2' })).ssoprovider,
    ).toBe('azuread-oauth2');
  });

  it('omits ssoprovider when the tenant uses the default login', async () => {
    expect(attributesOf(await build())).not.toHaveProperty('ssoprovider');
  });

  it('carries a redirect token so a signed-in visitor comes back here', async () => {
    expect(attributesOf(await build()).redirecttoken).toBe('redirect-token');
  });

  // An agent anyone may read never sends the visitor to sign in, so it has
  // nowhere to come back from.
  it('omits the redirect token when the agent allows anonymous access', async () => {
    expect(
      attributesOf(await build({ allow_anonymous: true })),
    ).not.toHaveProperty('redirecttoken');
  });
});

describe('getEmbedCode default launcher image', () => {
  it('fetches the thumbnail from the dm base, never /axd/', async () => {
    const code = await build();

    expect(code).toContain(DM_BASE);
    expect(code).not.toContain(AXD_BASE);
  });

  it('falls back to the main-tenant thumbnail on a non-ok primary response', async () => {
    // First call is this tenant's thumbnail, second is main's.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false } as Response)
      .mockResolvedValueOnce({ ok: true } as Response);
    vi.stubGlobal('fetch', fetchMock);

    const code = await build();

    expect(code).toContain(`${DM_BASE}/api/core/orgs/main/thumbnail/`);
    expect(code).not.toContain(AXD_BASE);
  });

  it('falls back to the bundled logo when neither thumbnail answers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false }) as Response),
    );

    expect(await build()).toContain('/images/ibl-logo-animated.gif');
  });
});

/**
 * The launcher stays here by decision: the component renders none, because
 * hosts that embed it inline — the Chrome extension side panel, a nested edX
 * frame — do not want one.
 */
describe('getEmbedCode launcher', () => {
  const bubble: CustomFloatingBubbleConfig = {
    image: 'https://cdn.example.com/logo.png',
    position: 'bottom-left',
    size: 'medium',
    backgroundColor: '#111111',
    textColor: '#ffffff',
    subtitleTextColor: '#cccccc',
    accentColor: '#2467eb',
    borderRadius: 12,
    shadow: true,
    title: 'Ask us',
    subtitle: 'We reply fast',
    height: 60,
    padding: 10,
    imageSize: 28,
    fontSize: 14,
    subtitleFontSize: 11,
    strokeColor: '#222222',
    strokeWidth: 1,
  };

  it('renders a launcher button that opens the panel', async () => {
    const code = await build();

    expect(code).toContain("bubble.className = 'ibl-chat-bubble'");
    expect(code).toContain("bubble.addEventListener('click', toggle)");
  });

  it('labels the launcher and reports whether the panel is open', async () => {
    const code = await build();

    expect(code).toContain("'aria-label', 'Open chat assistant'");
    expect(code).toContain("'aria-expanded', 'false'");
  });

  it.each([
    ['bottom-right', 'bottom: 20px; right: 30px;'],
    ['bottom-left', 'bottom: 20px; left: 30px;'],
    ['top-right', 'top: 20px; right: 30px;'],
    ['top-left', 'top: 20px; left: 30px;'],
  ])('places a custom launcher %s', async (position, expected) => {
    const code = await build({}, 'redirect-token', true, {
      ...bubble,
      position: position as CustomFloatingBubbleConfig['position'],
    });

    expect(code).toContain(expected);
  });

  it('uses the configured image, title and subtitle', async () => {
    const code = await build({}, 'redirect-token', true, bubble);

    expect(code).toContain('https://cdn.example.com/logo.png');
    expect(code).toContain('Ask us');
    expect(code).toContain('We reply fast');
  });

  it('uses the tenant thumbnail when no custom launcher is configured', async () => {
    const code = await build();

    expect(code).toContain(DM_BASE);
    expect(code).not.toContain('https://cdn.example.com/logo.png');
  });

  it('opens by itself when auto-open is on', async () => {
    expect(await build({ auto_open: true })).toContain(
      'setTimeout(function () { if (!injected) toggle(); }, 500);',
    );
  });

  it('waits to be clicked when auto-open is off', async () => {
    expect(await build()).not.toContain('if (!injected) toggle();');
  });

  // The agent asks to be closed; the launcher is ours, so the hiding is too.
  it('hides the panel when the agent asks to be closed', async () => {
    const code = await build();

    expect(code).toContain('message.closeEmbed');
    expect(code).toContain('toggle();');
  });
});

/**
 * The e2e suite reads the generated snippet as text, so two details of its
 * SHAPE — not just its meaning — are load-bearing:
 *
 * - `e2e/utils/embed-harness-client.ts`'s `rewriteSnippetOrigin` finds the
 *   baked app origin by matching the `mentorurl` setAttribute call, and
 *   repoints it at the app under test. When the snippet moved from building
 *   its own iframe to mounting `<agent-ai>`, the `iframe.src` line it used to
 *   match disappeared and the rewrite silently became a no-op — every
 *   real-snippet test then framed an unrelated app and showed an empty panel.
 * - `e2e/page-objects/edit-mentor/embed.tab.ts` waits for `DOMContentLoaded`
 *   to know the whole snippet has rendered into the dialog.
 *
 * Both are matched by regex against this text, so a reshape here must be made
 * there in the same change. These pin the markers so that break is a failing
 * unit test rather than a puzzling e2e trace.
 */
describe('getEmbedCode keeps the markers the e2e helpers match', () => {
  it('carries the app origin as a `mentorurl` attribute the origin rewrite can find', async () => {
    const code = await build();

    expect(code).toContain(
      'agent.setAttribute("mentorurl", "https://mentor.example.com")',
    );
    expect(
      code.match(
        /setAttribute\(\s*"mentorurl"\s*,\s*"(https?:\/\/[^/"]+)/,
      )?.[1],
    ).toBe('https://mentor.example.com');
  });

  it('ends with the DOMContentLoaded hand-off the readiness gate waits for', async () => {
    const code = await build();

    expect(code).toContain('DOMContentLoaded');
  });
});
