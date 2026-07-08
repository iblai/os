import { describe, it, expect, vi, beforeEach } from 'vitest';

// next/headers → controllable host for canonical/JSON-LD origin.
vi.mock('next/headers', () => ({
  headers: vi.fn(async () => ({
    get: (key: string) => (key.toLowerCase() === 'host' ? 'os.ibl.ai' : null),
  })),
}));

// Preserve the real config (constants.ts calls several members at load) and
// only override the API base URL.
vi.mock('@/lib/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/config')>();
  return {
    ...actual,
    config: { ...actual.config, dmUrl: () => 'https://api.example.com/dm' },
  };
});

import {
  fetchMentorPublicMeta,
  buildMentorMetadata,
  mentorJsonLd,
} from '@/lib/seo-mentor';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

function respond(json: unknown, ok = true) {
  fetchMock.mockResolvedValue({ ok, json: async () => json });
}

describe('fetchMentorPublicMeta', () => {
  it('returns null when org or mentor is missing', async () => {
    expect(await fetchMentorPublicMeta('', 'm')).toBeNull();
    expect(await fetchMentorPublicMeta('o', '')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('builds the public-settings URL for the anonymous user', async () => {
    respond({ allow_anonymous: true });
    await fetchMentorPublicMeta('acme', 'bot-1');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/dm/api/ai-mentor/orgs/acme/users/anonymous/mentors/bot-1/public-settings/',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
  });

  it('marks a mentor public when allow_anonymous is true', async () => {
    respond({
      allow_anonymous: true,
      mentor_name: 'Support Bot',
      description: 'Helps customers',
      profile_image: 'https://img/x.png',
    });
    const meta = await fetchMentorPublicMeta('acme', 'bot-1');
    expect(meta).toEqual({
      isPublic: true,
      name: 'Support Bot',
      description: 'Helps customers',
      image: 'https://img/x.png',
    });
  });

  it('marks a mentor public when visibility is viewable_by_anyone', async () => {
    respond({ mentor_visibility: 'viewable_by_anyone', name: 'Guide' });
    const meta = await fetchMentorPublicMeta('acme', 'g');
    expect(meta?.isPublic).toBe(true);
    expect(meta?.name).toBe('Guide');
  });

  it('marks a mentor private when neither flag is set', async () => {
    respond({ mentor_visibility: 'viewable_by_tenant_admins' });
    const meta = await fetchMentorPublicMeta('acme', 'g');
    expect(meta?.isPublic).toBe(false);
  });

  it('falls back across field-name variants', async () => {
    respond({ allow_anonymous: true, display_name: 'Alt', avatar: 'a.png' });
    const meta = await fetchMentorPublicMeta('acme', 'g');
    expect(meta?.name).toBe('Alt');
    expect(meta?.image).toBe('a.png');
    expect(meta?.description).toBeNull();
  });

  it('returns null on a non-ok response', async () => {
    respond({}, false);
    expect(await fetchMentorPublicMeta('acme', 'g')).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    fetchMock.mockRejectedValue(new Error('network'));
    expect(await fetchMentorPublicMeta('acme', 'g')).toBeNull();
  });
});

describe('buildMentorMetadata', () => {
  it('is noindex for a private mentor', async () => {
    respond({ allow_anonymous: false });
    const m = await buildMentorMetadata('acme', 'g');
    expect(m.robots).toMatchObject({ index: false });
    expect((m.alternates as any).canonical).toBe(
      'https://os.ibl.ai/platform/acme/g',
    );
  });

  it('is indexable with name/description/image for a public mentor', async () => {
    respond({
      allow_anonymous: true,
      mentor_name: 'Support Bot',
      description: 'Helps customers',
      profile_image: 'https://img/x.png',
    });
    const m = await buildMentorMetadata('acme', 'bot-1');
    expect(m.robots).toMatchObject({ index: true });
    expect(m.title).toBe('Support Bot');
    expect(m.description).toBe('Helps customers');
    expect((m.openGraph as any).images).toEqual([{ url: 'https://img/x.png' }]);
    expect((m.openGraph as any).type).toBe('profile');
  });

  it('falls back to a generated title/description when fields are missing', async () => {
    respond({ allow_anonymous: true });
    const m = await buildMentorMetadata('acme', 'g');
    expect(m.title).toBe('AI Agent');
    expect(m.description).toBe('Chat with AI Agent, an AI agent on ibl.ai.');
  });
});

describe('mentorJsonLd', () => {
  it('returns null for a private mentor', async () => {
    respond({ allow_anonymous: false });
    expect(await mentorJsonLd('acme', 'g')).toBeNull();
  });

  it('builds SoftwareApplication JSON-LD for a public mentor', async () => {
    respond({
      allow_anonymous: true,
      mentor_name: 'Support Bot',
      profile_image: 'https://img/x.png',
    });
    const ld = await mentorJsonLd('acme', 'bot-1');
    expect(ld).toMatchObject({
      '@type': 'SoftwareApplication',
      name: 'Support Bot',
      url: 'https://os.ibl.ai/platform/acme/bot-1',
      image: 'https://img/x.png',
      provider: { '@type': 'Organization', name: 'ibl.ai' },
    });
  });
});
