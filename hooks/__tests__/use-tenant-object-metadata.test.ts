import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useTenantObjectMetadata } from '../use-tenant-object-metadata';

describe('useTenantObjectMetadata', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns the given tenant's metadata from the tenants list", () => {
    window.localStorage.setItem(
      'tenants',
      JSON.stringify([
        {
          key: 'acme',
          is_admin: true,
          org: 'acme',
          metadata: { support_email: 'a@acme.io' },
        },
        {
          key: 'other',
          is_admin: false,
          org: 'other',
          metadata: { show_help: false },
        },
      ]),
    );
    const { result } = renderHook(() => useTenantObjectMetadata('acme'));
    expect(result.current).toEqual({ support_email: 'a@acme.io' });
  });

  it('falls back to the current tenant key when none is given', () => {
    window.localStorage.setItem(
      'tenants',
      JSON.stringify([
        {
          key: 'acme',
          is_admin: true,
          org: 'acme',
          metadata: { chat_area_size: 850 },
        },
      ]),
    );
    window.localStorage.setItem(
      'current_tenant',
      JSON.stringify({ key: 'acme', is_admin: true, org: 'acme' }),
    );
    const { result } = renderHook(() => useTenantObjectMetadata());
    expect(result.current).toEqual({ chat_area_size: 850 });
  });

  it('returns empty metadata for a tenant not in the list (no fetch)', () => {
    window.localStorage.setItem(
      'tenants',
      JSON.stringify([
        { key: 'acme', is_admin: true, org: 'acme', metadata: { a: 1 } },
      ]),
    );
    const { result } = renderHook(() => useTenantObjectMetadata('stranger'));
    expect(result.current).toEqual({});
  });

  it('returns empty metadata when the tenant has none', () => {
    window.localStorage.setItem(
      'tenants',
      JSON.stringify([{ key: 'acme', is_admin: true, org: 'acme' }]),
    );
    const { result } = renderHook(() => useTenantObjectMetadata('acme'));
    expect(result.current).toEqual({});
  });
});
