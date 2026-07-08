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

import { fetchTenantAgentNames, buildExploreMetadata } from '@/lib/seo-explore';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

function respond(json: unknown, ok = true) {
  fetchMock.mockResolvedValue({ ok, json: async () => json });
}

describe('fetchTenantAgentNames', () => {
  it('returns [] for an empty org', async () => {
    expect(await fetchTenantAgentNames('')).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('calls the public agent-search endpoint and extracts names', async () => {
    respond({
      results: [
        { name: 'Support Bot' },
        { display_name: 'Sales Coach' },
        { mentor_name: 'Onboarding Guide' },
        { id: 4 }, // no name → skipped
      ],
    });
    const names = await fetchTenantAgentNames('acme', 5);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/dm/api/ai-search/mentors/?platform_key=acme&limit=5&include_main_public_mentors=true',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
    expect(names).toEqual(['Support Bot', 'Sales Coach', 'Onboarding Guide']);
  });

  it('caps the result at the requested limit', async () => {
    respond({ results: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] });
    expect(await fetchTenantAgentNames('acme', 2)).toEqual(['A', 'B']);
  });

  it('returns [] on non-ok or malformed responses', async () => {
    respond({}, false);
    expect(await fetchTenantAgentNames('acme')).toEqual([]);
    respond({ results: 'nope' });
    expect(await fetchTenantAgentNames('acme')).toEqual([]);
  });

  it('returns [] when fetch throws', async () => {
    fetchMock.mockRejectedValue(new Error('network'));
    expect(await fetchTenantAgentNames('acme')).toEqual([]);
  });
});

describe('buildExploreMetadata', () => {
  it('is indexable with an "Explore Agents" title and canonical', async () => {
    respond({ results: [] });
    const m = await buildExploreMetadata('/platform/acme/explore', 'acme');
    expect(m.robots).toMatchObject({ index: true, follow: true });
    expect(m.title).toBe('Explore Agents');
    expect((m.alternates as any).canonical).toBe(
      'https://os.ibl.ai/platform/acme/explore',
    );
  });

  it('lists the first agents in the description', async () => {
    respond({
      results: [{ name: 'Support Bot' }, { name: 'Sales Coach' }],
    });
    const m = await buildExploreMetadata('/platform/acme/explore', 'acme');
    expect(m.description).toBe(
      'Browse and chat with AI agents on ibl.ai, including Support Bot and Sales Coach.',
    );
  });

  it('formats three or more names with an Oxford comma', async () => {
    respond({
      results: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
    });
    const m = await buildExploreMetadata('/platform/acme/explore', 'acme');
    expect(m.description).toBe(
      'Browse and chat with AI agents on ibl.ai, including A, B, and C.',
    );
  });

  it('lists a single agent without a conjunction list', async () => {
    respond({ results: [{ name: 'Solo Agent' }] });
    const m = await buildExploreMetadata('/platform/acme/explore', 'acme');
    expect(m.description).toBe(
      'Browse and chat with AI agents on ibl.ai, including Solo Agent.',
    );
  });

  it('falls back to a generic description when no agents are found', async () => {
    respond({ results: [] });
    const m = await buildExploreMetadata('/platform/acme/explore', 'acme');
    expect(m.description).toBe('Browse and chat with AI agents on ibl.ai.');
  });
});
