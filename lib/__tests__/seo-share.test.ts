import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => ({
    get: (key: string) => (key.toLowerCase() === 'host' ? 'os.ibl.ai' : null),
  })),
}));

vi.mock('@/lib/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/config')>();
  return {
    ...actual,
    config: { ...actual.config, dmUrl: () => 'https://api.example.com/dm' },
  };
});

import {
  buildSharedChatMetadata,
  buildSharedChatSessionMetadata,
  fetchSharedChatMentor,
} from '@/lib/seo-share';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

function respond(json: unknown, ok = true) {
  fetchMock.mockResolvedValue({ ok, json: async () => json });
}

describe('buildSharedChatMetadata', () => {
  it('is always noindex, with the session-scoped canonical', async () => {
    respond({ allow_anonymous: true, mentor_name: 'Support Bot' });
    const m = await buildSharedChatMetadata('sess-1', 'acme', 'bot-1');
    expect(m.robots).toMatchObject({ index: false, follow: false });
    expect((m.alternates as any).canonical).toBe(
      'https://os.ibl.ai/share/chat/sess-1/acme/bot-1',
    );
  });

  it('builds a rich OG card from the mentor name + avatar', async () => {
    respond({
      allow_anonymous: true,
      mentor_name: 'Support Bot',
      profile_image: 'https://img/x.png',
    });
    const m = await buildSharedChatMetadata('sess-1', 'acme', 'bot-1');
    expect(m.title).toBe('Shared conversation with Support Bot');
    expect(m.description).toBe(
      'A shared conversation with Support Bot on ibl.ai.',
    );
    expect((m.openGraph as any).images).toEqual([{ url: 'https://img/x.png' }]);
    expect((m.openGraph as any).type).toBe('article');
  });

  it('falls back to a generic card when the mentor is unknown', async () => {
    respond({}, false);
    const m = await buildSharedChatMetadata('sess-1', 'acme', 'bot-1');
    expect(m.title).toBe('Shared conversation');
    expect(m.description).toBe('A shared conversation on ibl.ai.');
    expect((m.openGraph as any).images).toEqual([{ url: '/iblai-logo.png' }]);
  });
});

describe('fetchSharedChatMentor', () => {
  it('returns null for an empty sessionId', async () => {
    expect(await fetchSharedChatMentor('')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('calls the public shared-session endpoint and returns org + mentor', async () => {
    respond({ platform_key: 'acme', mentor_unique_id: 'bot-1' });
    const res = await fetchSharedChatMentor('sess-9');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/dm/api/ai-mentor/orgs//users/undefined/sessions/sess-9/shared/',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
    expect(res).toEqual({ org: 'acme', mentor: 'bot-1' });
  });

  it('returns null when platform_key or mentor_unique_id is missing', async () => {
    respond({ platform_key: 'acme' });
    expect(await fetchSharedChatMentor('sess-9')).toBeNull();
  });

  it('returns null on a non-ok response', async () => {
    respond({}, false);
    expect(await fetchSharedChatMentor('sess-9')).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    fetchMock.mockRejectedValue(new Error('network'));
    expect(await fetchSharedChatMentor('sess-9')).toBeNull();
  });
});

describe('buildSharedChatSessionMetadata', () => {
  it('resolves the mentor from the session and builds a rich card', async () => {
    // 1st fetch: shared session → org/mentor. 2nd fetch: mentor public settings.
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          platform_key: 'acme',
          mentor_unique_id: 'bot-1',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          allow_anonymous: true,
          mentor_name: 'Support Bot',
          profile_image: 'https://img/x.png',
        }),
      });

    const m = await buildSharedChatSessionMetadata('sess-1');
    expect(m.robots).toMatchObject({ index: false });
    expect(m.title).toBe('Shared conversation with Support Bot');
    expect((m.openGraph as any).images).toEqual([{ url: 'https://img/x.png' }]);
    // Canonical points at the SHORT link that was pasted.
    expect((m.alternates as any).canonical).toBe(
      'https://os.ibl.ai/share/chat/sess-1',
    );
  });

  it('falls back to a generic card when the session cannot be resolved', async () => {
    respond({}, false); // shared-session fetch fails
    const m = await buildSharedChatSessionMetadata('sess-1');
    expect(m.title).toBe('Shared conversation');
    expect(m.description).toBe('A shared conversation on ibl.ai.');
    expect((m.alternates as any).canonical).toBe(
      'https://os.ibl.ai/share/chat/sess-1',
    );
  });
});
