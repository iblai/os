import { describe, it, expect, vi, beforeEach } from 'vitest';

let mockIsTauri = true;
let mockInvokeResult: unknown = 'acme';
let mockInvokeThrows = false;

vi.mock('@/types/tauri', () => ({
  isTauriApp: () => mockIsTauri,
  TAURI_COMMANDS: { GET_LOCKED_TENANT: 'get_locked_tenant' },
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => {
    if (mockInvokeThrows) throw new Error('command unavailable');
    return mockInvokeResult;
  }),
}));

// Fresh module each test → resets the per-session promise cache.
async function load() {
  vi.resetModules();
  return import('@/lib/locked-tenant');
}

beforeEach(() => {
  mockIsTauri = true;
  mockInvokeResult = 'acme';
  mockInvokeThrows = false;
});

describe('getLockedTenant', () => {
  it('returns the trimmed tenant from the command in a Tauri app', async () => {
    mockInvokeResult = '  acme  ';
    const { getLockedTenant } = await load();
    expect(await getLockedTenant()).toBe('acme');
  });

  it('returns "" on web (not a Tauri app)', async () => {
    mockIsTauri = false;
    const { getLockedTenant } = await load();
    expect(await getLockedTenant()).toBe('');
  });

  it('returns "" when the command throws', async () => {
    mockInvokeThrows = true;
    const { getLockedTenant } = await load();
    expect(await getLockedTenant()).toBe('');
  });

  it('returns "" for a non-string result', async () => {
    mockInvokeResult = 123;
    const { getLockedTenant } = await load();
    expect(await getLockedTenant()).toBe('');
  });

  it('caches the promise across calls', async () => {
    const { getLockedTenant } = await load();
    const a = getLockedTenant();
    const b = getLockedTenant();
    expect(a).toBe(b); // same cached promise
    expect(await a).toBe('acme');
  });
});
