import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  defaultOrganization,
  listOrganizations,
  setDefaultOrganization,
} from '../organizations';

const CREDS = { dmToken: 'dm-token', org: 'acme', username: 'ada' };
const BASES = ['https://one.test', 'https://two.test'];

let fetchMock: ReturnType<typeof vi.fn>;

const answer = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

beforeEach(() => {
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

describe('listOrganizations', () => {
  it('asks DM for the signed-in user and authorises with the DM token', async () => {
    fetchMock.mockResolvedValueOnce(answer([{ platform_key: 'acme' }]));

    await listOrganizations(CREDS, BASES);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://one.test/api/core/users/platforms/?username=ada');
    expect((init as RequestInit).headers).toEqual({
      Authorization: 'Token dm-token',
    });
  });

  it('reads a name, and falls back to the key when there is none', async () => {
    fetchMock.mockResolvedValueOnce(
      answer([
        { platform_key: 'acme', name: 'Acme Inc' },
        { platform_key: 'globex' },
      ]),
    );

    await expect(listOrganizations(CREDS, BASES)).resolves.toEqual([
      { key: 'acme', name: 'Acme Inc' },
      { key: 'globex', name: 'globex' },
    ]);
  });

  // DM has spelled the key three ways across these endpoints; a rename should
  // not empty the list.
  it.each([
    ['platform_key', { platform_key: 'acme' }],
    ['key', { key: 'acme' }],
    ['org', { org: 'acme' }],
  ])('accepts the key spelled %s', async (_label, row) => {
    fetchMock.mockResolvedValueOnce(answer([row]));
    await expect(listOrganizations(CREDS, BASES)).resolves.toEqual([
      { key: 'acme', name: 'acme' },
    ]);
  });

  it('reads a paginated body as well as a bare array', async () => {
    fetchMock.mockResolvedValueOnce(
      answer({ results: [{ platform_key: 'acme', name: 'Acme' }] }),
    );
    await expect(listOrganizations(CREDS, BASES)).resolves.toEqual([
      { key: 'acme', name: 'Acme' },
    ]);
  });

  it('sorts by name so the list does not reorder between openings', async () => {
    fetchMock.mockResolvedValueOnce(
      answer([
        { platform_key: 'z', name: 'Zebra' },
        { platform_key: 'a', name: 'Apple' },
      ]),
    );
    await expect(listOrganizations(CREDS, BASES)).resolves.toEqual([
      { key: 'a', name: 'Apple' },
      { key: 'z', name: 'Zebra' },
    ]);
  });

  it('drops a duplicate key, which would switch to the same place twice', async () => {
    fetchMock.mockResolvedValueOnce(
      answer([
        { platform_key: 'acme', name: 'Acme' },
        { platform_key: 'acme', name: 'Acme again' },
      ]),
    );
    await expect(listOrganizations(CREDS, BASES)).resolves.toHaveLength(1);
  });

  it('skips a row with no usable key rather than listing a blank', async () => {
    fetchMock.mockResolvedValueOnce(
      answer([{ name: 'No key' }, { key: '  ' }]),
    );
    await expect(listOrganizations(CREDS, BASES)).resolves.toEqual([]);
  });

  // The platform serves this from more than one host; one 403 must not strand
  // the panel on an empty list.
  it('falls through to the next base when one refuses', async () => {
    fetchMock
      .mockResolvedValueOnce(answer({ detail: 'no' }, 403))
      .mockResolvedValueOnce(answer([{ platform_key: 'acme' }]));

    await expect(listOrganizations(CREDS, BASES)).resolves.toHaveLength(1);
    expect(fetchMock.mock.calls[1][0]).toContain('https://two.test');
  });

  it('falls through when one base cannot be reached at all', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(answer([{ platform_key: 'acme' }]));

    await expect(listOrganizations(CREDS, BASES)).resolves.toHaveLength(1);
  });

  it('reports which bases failed when none answer', async () => {
    fetchMock.mockResolvedValue(answer({}, 500));
    await expect(listOrganizations(CREDS, BASES)).rejects.toThrow(
      /one\.test.*two\.test/s,
    );
  });

  it('refuses without a session rather than calling out unauthenticated', async () => {
    await expect(listOrganizations(null, BASES)).rejects.toThrow('no session');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('defaultOrganization', () => {
  it.each([
    ['platform_key', { platform_key: 'acme' }],
    ['key', { key: 'acme' }],
    ['org', { org: 'acme' }],
    ['a nested platform', { platform: { platform_key: 'acme' } }],
  ])('reads the key from %s', async (_label, body) => {
    fetchMock.mockResolvedValueOnce(answer(body));
    await expect(defaultOrganization(CREDS, BASES)).resolves.toBe('acme');
  });

  // 503 here means the backing table is not migrated in this environment. The
  // list is still usable, so this must not fail the screen.
  it('is null when the endpoint cannot answer', async () => {
    fetchMock.mockResolvedValue(answer({}, 503));
    await expect(defaultOrganization(CREDS, BASES)).resolves.toBeNull();
  });

  it('is null when nothing has been chosen', async () => {
    fetchMock.mockResolvedValueOnce(answer({}));
    await expect(defaultOrganization(CREDS, BASES)).resolves.toBeNull();
  });

  it('is null without a session', async () => {
    await expect(defaultOrganization(null, BASES)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('setDefaultOrganization', () => {
  it('posts the key as JSON with the DM token', async () => {
    fetchMock.mockResolvedValueOnce(answer({}, 200));

    await setDefaultOrganization('acme', CREDS, BASES);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://one.test/api/core/users/platforms/default/');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ platform_key: 'acme' }));
    expect(init.headers).toMatchObject({ Authorization: 'Token dm-token' });
  });

  it('stops at the first base that accepts it', async () => {
    fetchMock.mockResolvedValueOnce(answer({}, 200));
    await setDefaultOrganization('acme', CREDS, BASES);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('tries the next base when one refuses', async () => {
    fetchMock
      .mockResolvedValueOnce(answer({}, 404))
      .mockResolvedValueOnce(answer({}, 200));

    await setDefaultOrganization('acme', CREDS, BASES);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws when no base accepts it, so the caller can say so', async () => {
    fetchMock.mockResolvedValue(answer({}, 500));
    await expect(setDefaultOrganization('acme', CREDS, BASES)).rejects.toThrow(
      /one\.test/,
    );
  });

  it('refuses without a session', async () => {
    await expect(setDefaultOrganization('acme', null, BASES)).rejects.toThrow(
      'no session',
    );
  });
});
