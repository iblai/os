import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getEmbedCode } from '../utils';
import type { EmbedFormValues } from '../hooks/useEmbedTab';

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
