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

const settings: EmbedFormValues = {
  custom_css: '',
  description: '',
  website_url: '',
  mode: 'default',
  allow_anonymous: false,
  mentor_visibility: null,
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
  embed_show_attachment: true,
  embed_show_voice_call: true,
  embed_show_voice_record: true,
  show_catalogue: true,
  starter_prompts: 'guided_prompt',
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
