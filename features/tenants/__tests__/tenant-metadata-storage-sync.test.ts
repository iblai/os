import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';

// In-memory auth storage so the sync's getAuthItem/setAuthItem round-trips.
const store = new Map<string, string>();
vi.mock('@/lib/auth-storage', () => ({
  getAuthItem: (key: string) => (store.has(key) ? store.get(key)! : null),
  setAuthItem: (key: string, value: string) => {
    store.set(key, value);
  },
}));

import {
  syncTenantMetadataToStorage,
  extractOrgAndMetadata,
  tenantMetadataStorageSync,
} from '../tenant-metadata-storage-sync';
import { LOCAL_STORAGE_KEYS } from '@/lib/constants';

const TENANTS = LOCAL_STORAGE_KEYS.USER_TENANTS;
const CURRENT = LOCAL_STORAGE_KEYS.CURRENT_TENANT;

const read = (key: string) => JSON.parse(store.get(key) ?? 'null');

beforeEach(() => {
  store.clear();
  vi.restoreAllMocks();
});

describe('extractOrgAndMetadata', () => {
  it('parses the SDK mutation arg shape `[{ org, requestBody: { metadata } }]`', () => {
    const arg = [
      {
        org: 'gillis',
        requestBody: { metadata: { accessibility_menu: true } },
      },
    ];
    expect(extractOrgAndMetadata(arg)).toEqual({
      org: 'gillis',
      metadata: { accessibility_menu: true },
    });
  });

  it('also accepts a non-array single-object arg', () => {
    const arg = {
      org: 'gillis',
      requestBody: { metadata: { show_help: false } },
    };
    expect(extractOrgAndMetadata(arg)).toEqual({
      org: 'gillis',
      metadata: { show_help: false },
    });
  });

  it('returns null for malformed args (missing org / metadata)', () => {
    expect(extractOrgAndMetadata(undefined)).toBeNull();
    expect(extractOrgAndMetadata([{ org: 'gillis' }])).toBeNull();
    expect(
      extractOrgAndMetadata([{ requestBody: { metadata: {} } }]),
    ).toBeNull();
    expect(
      extractOrgAndMetadata([{ org: 'gillis', requestBody: {} }]),
    ).toBeNull();
  });
});

describe('syncTenantMetadataToStorage', () => {
  it('overwrites the matching tenant metadata in the tenants list and leaves others untouched', () => {
    store.set(
      TENANTS,
      JSON.stringify([
        { key: 'gillis', org: 'gillis', metadata: { chat_area_size: 850 } },
        { key: 'other', org: 'other', metadata: { chat_area_size: 700 } },
      ]),
    );

    syncTenantMetadataToStorage('gillis', {
      chat_area_size: 848,
      accessibility_menu: true,
    });

    const tenants = read(TENANTS);
    expect(tenants[0].metadata).toEqual({
      chat_area_size: 848,
      accessibility_menu: true,
    });
    // The non-matching tenant is untouched.
    expect(tenants[1].metadata).toEqual({ chat_area_size: 700 });
  });

  it('overwrites current_tenant metadata when its key matches', () => {
    store.set(
      CURRENT,
      JSON.stringify({ key: 'gillis', is_admin: true, org: 'gillis' }),
    );

    syncTenantMetadataToStorage('gillis', { show_help: false });

    expect(read(CURRENT)).toEqual({
      key: 'gillis',
      is_admin: true,
      org: 'gillis',
      metadata: { show_help: false },
    });
  });

  it('does not touch current_tenant when its key does not match', () => {
    const original = { key: 'other', is_admin: false, org: 'other' };
    store.set(CURRENT, JSON.stringify(original));

    syncTenantMetadataToStorage('gillis', { show_help: false });

    expect(read(CURRENT)).toEqual(original);
  });

  it('fires a local-storage event per updated key so the hooks re-read', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    store.set(
      TENANTS,
      JSON.stringify([{ key: 'gillis', org: 'gillis', metadata: {} }]),
    );
    store.set(CURRENT, JSON.stringify({ key: 'gillis', org: 'gillis' }));

    syncTenantMetadataToStorage('gillis', { accessibility_menu: true });

    const keys = dispatchSpy.mock.calls
      .map(([e]) => (e as StorageEvent).key)
      .filter(Boolean);
    expect(keys).toContain(TENANTS);
    expect(keys).toContain(CURRENT);
  });

  it('is a no-op (no throw) when storage is empty or malformed', () => {
    expect(() =>
      syncTenantMetadataToStorage('gillis', { show_help: true }),
    ).not.toThrow();

    store.set(TENANTS, 'not json');
    store.set(CURRENT, 'not json');
    expect(() =>
      syncTenantMetadataToStorage('gillis', { show_help: true }),
    ).not.toThrow();
  });
});

describe('tenantMetadataStorageSync listener middleware', () => {
  const makeStore = () =>
    configureStore({
      reducer: { dummy: (s = {}) => s },
      middleware: (getDefault) =>
        getDefault().concat(tenantMetadataStorageSync.middleware),
    });

  const fulfilled = (
    originalArgs: unknown,
    endpointName = 'updateTenantMetadata',
  ) => ({
    type: 'tenantApiSlice/executeMutation/fulfilled',
    payload: {},
    meta: {
      requestStatus: 'fulfilled' as const,
      requestId: 'req-1',
      arg: { type: 'mutation', endpointName, originalArgs },
    },
  });

  it('patches storage when the updateTenantMetadata mutation fulfils', async () => {
    store.set(
      TENANTS,
      JSON.stringify([{ key: 'gillis', org: 'gillis', metadata: {} }]),
    );
    store.set(CURRENT, JSON.stringify({ key: 'gillis', org: 'gillis' }));

    makeStore().dispatch(
      fulfilled([
        {
          org: 'gillis',
          requestBody: { metadata: { accessibility_menu: true } },
        },
      ]),
    );
    // Listener effects run after the dispatch returns.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(read(TENANTS)[0].metadata).toEqual({ accessibility_menu: true });
    expect(read(CURRENT).metadata).toEqual({ accessibility_menu: true });
  });

  it('ignores a fulfilled mutation from a different endpoint', async () => {
    store.set(
      TENANTS,
      JSON.stringify([{ key: 'gillis', org: 'gillis', metadata: { a: 1 } }]),
    );

    makeStore().dispatch(
      fulfilled(
        [{ org: 'gillis', requestBody: { metadata: { a: 2 } } }],
        'someOtherMutation',
      ),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Untouched — the predicate only matches updateTenantMetadata.
    expect(read(TENANTS)[0].metadata).toEqual({ a: 1 });
  });

  it('ignores a matching endpoint whose args are malformed', async () => {
    store.set(
      TENANTS,
      JSON.stringify([{ key: 'gillis', org: 'gillis', metadata: { a: 1 } }]),
    );

    makeStore().dispatch(fulfilled([{ org: 'gillis' }]));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(read(TENANTS)[0].metadata).toEqual({ a: 1 });
  });
});
