import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  listOrganizations,
  NoSessionError,
  setDefaultOrganization,
} from '../organizations';
import { installChromeStub } from './chrome.stub';

const CREDS = { dmToken: 'dm-token', org: 'acme', username: 'ada' };
const BASES = ['https://one.test', 'https://two.test'];

let fetchMock: ReturnType<typeof vi.fn>;

const answer = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const row = (over: Record<string, unknown> = {}) => ({
  platform_key: 'acme',
  name: 'Acme Inc',
  ...over,
});

beforeEach(() => {
  installChromeStub();
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

describe('listOrganizations', () => {
  it('asks DM for the signed-in user and authorises with the DM token', async () => {
    fetchMock.mockResolvedValueOnce(answer([row()]));

    await listOrganizations(CREDS, BASES);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://one.test/api/core/users/platforms/?username=ada');
    expect((init as RequestInit).headers).toEqual({
      Authorization: 'Token dm-token',
    });
  });

  it('reads a name, and falls back to the key when there is none', async () => {
    fetchMock.mockResolvedValueOnce(
      answer([row(), row({ platform_key: 'globex', name: undefined })]),
    );

    await expect(listOrganizations(CREDS, BASES)).resolves.toEqual([
      { key: 'acme', name: 'Acme Inc', isDefault: false },
      { key: 'globex', name: 'globex', isDefault: false },
    ]);
  });

  // DM has spelled the key three ways across these endpoints; a rename should
  // not empty the list.
  it.each([
    ['platform_key', { platform_key: 'zz', key: undefined }],
    ['key', { platform_key: undefined, key: 'zz' }],
    ['org', { platform_key: undefined, org: 'zz' }],
  ])('accepts the key spelled %s', async (_label, over) => {
    fetchMock.mockResolvedValueOnce(answer([row({ ...over, name: 'Zed' })]));
    await expect(listOrganizations(CREDS, BASES)).resolves.toEqual([
      { key: 'zz', name: 'Zed', isDefault: false },
    ]);
  });

  // `is_default` comes back as a string, not a boolean, so the list itself says
  // which one opens by default — no second request that 503s where the backing
  // table is not migrated.
  it.each([
    ['the string "true"', 'true'],
    ['the string "True"', 'True'],
    ['a real boolean', true],
  ])('marks the default from %s on the row', async (_label, value) => {
    fetchMock.mockResolvedValueOnce(answer([row({ is_default: value })]));
    const [org] = await listOrganizations(CREDS, BASES);
    expect(org.isDefault).toBe(true);
  });

  it.each([
    ['"false"', 'false'],
    ['absent', undefined],
  ])('is not the default when is_default is %s', async (_label, value) => {
    fetchMock.mockResolvedValueOnce(answer([row({ is_default: value })]));
    const [org] = await listOrganizations(CREDS, BASES);
    expect(org.isDefault).toBe(false);
  });

  // Picking a dead link starts an auth round-trip that cannot land, so it is
  // never offered.
  it.each([
    ['the link is inactive', { active: false }],
    ['the person is inactive there', { user_active: false }],
    ['the link has expired', { expired_on: '2000-01-01T00:00:00Z' }],
  ])('leaves out a row where %s', async (_label, over) => {
    fetchMock.mockResolvedValueOnce(answer([row(over)]));
    await expect(listOrganizations(CREDS, BASES)).resolves.toEqual([]);
  });

  // DM sends these booleans as strings as often as booleans, which is why this
  // file has a reader for them. `active: "false"` must not sail through.
  it.each([
    ['active', { active: 'false' }],
    ['user_active', { user_active: 'False' }],
  ])('leaves out a row whose %s is the string false', async (_label, over) => {
    fetchMock.mockResolvedValueOnce(answer([row(over)]));
    await expect(listOrganizations(CREDS, BASES)).resolves.toEqual([]);
  });

  it.each([
    ['active', { active: 'true' }],
    ['user_active', { user_active: 'True' }],
  ])('keeps a row whose %s is the string true', async (_label, over) => {
    fetchMock.mockResolvedValueOnce(answer([row(over)]));
    await expect(listOrganizations(CREDS, BASES)).resolves.toHaveLength(1);
  });

  it('keeps a row whose active flag is a word it cannot read', async () => {
    fetchMock.mockResolvedValueOnce(answer([row({ active: 'maybe' })]));
    await expect(listOrganizations(CREDS, BASES)).resolves.toHaveLength(1);
  });

  it('keeps a row whose expiry is still in the future', async () => {
    fetchMock.mockResolvedValueOnce(
      answer([row({ expired_on: '2999-01-01T00:00:00Z' })]),
    );
    await expect(listOrganizations(CREDS, BASES)).resolves.toHaveLength(1);
  });

  // Only an explicit false disqualifies: these fields are absent on some rows,
  // and a missing field is not a dead link.
  it('keeps a row that says nothing about being active', async () => {
    fetchMock.mockResolvedValueOnce(
      answer([row({ active: undefined, user_active: undefined })]),
    );
    await expect(listOrganizations(CREDS, BASES)).resolves.toHaveLength(1);
  });

  it('keeps a row whose expiry cannot be read', async () => {
    fetchMock.mockResolvedValueOnce(answer([row({ expired_on: 'whenever' })]));
    await expect(listOrganizations(CREDS, BASES)).resolves.toHaveLength(1);
  });

  // A personal platform's key is a 32-character blob that means nothing to the
  // person reading the list; the app calls it "Account".
  it('calls an unnamed personal platform Account', async () => {
    fetchMock.mockResolvedValueOnce(
      answer([row({ platform_key: 'a'.repeat(32), name: undefined })]),
    );
    const [org] = await listOrganizations(CREDS, BASES);
    expect(org.name).toBe('Account');
  });

  it('prefers a real name over Account', async () => {
    fetchMock.mockResolvedValueOnce(
      answer([row({ platform_key: 'a'.repeat(32), name: 'My Place' })]),
    );
    const [org] = await listOrganizations(CREDS, BASES);
    expect(org.name).toBe('My Place');
  });

  it('reads a paginated body as well as a bare array', async () => {
    fetchMock.mockResolvedValueOnce(answer({ results: [row()] }));
    await expect(listOrganizations(CREDS, BASES)).resolves.toHaveLength(1);
  });

  it('follows next, so nothing after the first page is lost', async () => {
    fetchMock
      .mockResolvedValueOnce(
        answer({ results: [row()], next: 'https://one.test/page2' }),
      )
      .mockResolvedValueOnce(
        answer({ results: [row({ platform_key: 'globex', name: 'Globex' })] }),
      );

    await expect(listOrganizations(CREDS, BASES)).resolves.toHaveLength(2);
    expect(fetchMock.mock.calls[1][0]).toBe('https://one.test/page2');
  });

  // `next` is a server-provided URL and we send a bearer token with it, so
  // anything off the base's own origin is dropped rather than followed.
  it('does not follow a next that points at another host', async () => {
    fetchMock.mockResolvedValueOnce(
      answer({ results: [row()], next: 'https://evil.example/page2' }),
    );

    await expect(listOrganizations(CREDS, BASES)).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls.map(([u]) => u).join(' ')).not.toContain(
      'evil.example',
    );
  });

  it('does not follow an unreadable next', async () => {
    fetchMock.mockResolvedValueOnce(
      answer({ results: [row()], next: 'not a url' }),
    );
    await expect(listOrganizations(CREDS, BASES)).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // A 200 with nothing recognisable is not an answer to stop on: another base
  // may hold the real list. Same shape as `listModels`.
  it('tries the next base when one answers with nothing usable', async () => {
    fetchMock
      .mockResolvedValueOnce(answer([]))
      .mockResolvedValueOnce(answer([row()]));

    await expect(listOrganizations(CREDS, BASES)).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('is empty only when every base says so', async () => {
    fetchMock.mockResolvedValue(answer([]));
    await expect(listOrganizations(CREDS, BASES)).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // A first page that arrived is still an answer. Losing it because a later
  // page 404s would empty a list that was perfectly readable.
  it('keeps the rows it already has when a later page fails', async () => {
    fetchMock
      .mockResolvedValueOnce(
        answer({ results: [row()], next: 'https://one.test/page2' }),
      )
      .mockResolvedValueOnce(answer({ detail: 'gone' }, 404));

    await expect(listOrganizations(CREDS, BASES)).resolves.toHaveLength(1);
    // No falling through to the other base: this one answered.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // A 200 carrying something we cannot read is not "this person has no
  // organizations" — another base may still hold the list.
  it('tries the next base when one answers with an unreadable body', async () => {
    fetchMock
      .mockResolvedValueOnce(answer({ unexpected: 'shape' }))
      .mockResolvedValueOnce(answer([row()]));

    await expect(listOrganizations(CREDS, BASES)).resolves.toHaveLength(1);
  });

  it('does not let an unreadable body hide a dead session', async () => {
    fetchMock
      .mockResolvedValueOnce(answer({ detail: 'no' }, 401))
      .mockResolvedValueOnce(answer({ unexpected: 'shape' }));

    await expect(listOrganizations(CREDS, BASES)).rejects.toThrow(
      NoSessionError,
    );
  });

  it('says in the log when a list came back short', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchMock
      .mockResolvedValueOnce(
        answer({ results: [row()], next: 'https://one.test/page2' }),
      )
      .mockResolvedValueOnce(answer({ detail: 'gone' }, 404));

    await expect(listOrganizations(CREDS, BASES)).resolves.toHaveLength(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('truncated'));
    warn.mockRestore();
  });

  // An account genuinely in one organization must not read as signed out just
  // because another base refused the token.
  it('prefers a base that answered emptily over another base 401', async () => {
    fetchMock
      .mockResolvedValueOnce(answer({ detail: 'no' }, 401))
      .mockResolvedValueOnce(answer([]));

    await expect(listOrganizations(CREDS, BASES)).resolves.toEqual([]);
  });

  // The token is present but the server will not take it. Presence is not
  // validity, and "check your connection" would be the wrong advice.
  it('treats a refused token as a dead session, not a network problem', async () => {
    fetchMock.mockResolvedValue(answer({ detail: 'invalid token' }, 401));
    await expect(listOrganizations(CREDS, BASES)).rejects.toThrow(
      NoSessionError,
    );
  });

  it('sorts by name so the list does not reorder between openings', async () => {
    fetchMock.mockResolvedValueOnce(
      answer([
        row({ platform_key: 'z', name: 'Zebra' }),
        row({ platform_key: 'a', name: 'Apple' }),
      ]),
    );
    const names = (await listOrganizations(CREDS, BASES)).map((o) => o.name);
    expect(names).toEqual(['Apple', 'Zebra']);
  });

  it('drops a duplicate key, which would switch to the same place twice', async () => {
    fetchMock.mockResolvedValueOnce(
      answer([row(), row({ name: 'Acme again' })]),
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
      .mockResolvedValueOnce(answer([row()]));

    await expect(listOrganizations(CREDS, BASES)).resolves.toHaveLength(1);
    expect(fetchMock.mock.calls[1][0]).toContain('https://two.test');
  });

  it('falls through when one base cannot be reached at all', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(answer([row()]));

    await expect(listOrganizations(CREDS, BASES)).resolves.toHaveLength(1);
  });

  it('reports which bases failed when none answer', async () => {
    fetchMock.mockResolvedValue(answer({}, 500));
    await expect(listOrganizations(CREDS, BASES)).rejects.toThrow(
      /one\.test.*two\.test/s,
    );
  });

  // A dead session is not a connection problem, and the panel says something
  // different about each.
  it('throws NoSessionError without a session, and calls nothing', async () => {
    await expect(listOrganizations(null, BASES)).rejects.toThrow(
      NoSessionError,
    );
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

  it('tries the next base when one cannot be reached', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(answer({}, 200));

    await setDefaultOrganization('acme', CREDS, BASES);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('treats a refused token as a dead session when saving too', async () => {
    fetchMock.mockResolvedValueOnce(answer({}, 401));
    await expect(setDefaultOrganization('acme', CREDS, BASES)).rejects.toThrow(
      NoSessionError,
    );
    // No point asking the next base with a token the server has rejected.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws NoSessionError without a session', async () => {
    await expect(setDefaultOrganization('acme', null, BASES)).rejects.toThrow(
      NoSessionError,
    );
  });
});
