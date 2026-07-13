import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

// --- controllable mock state -------------------------------------------------
let mockIsTauri = true;
let mockInvokeResult: unknown = 'acme';
let mockInvokeThrows = false;
let mockUsername: string | null = 'user-1';
let mockCurrentTenant: { key: string } | null = { key: 'other-tenant' };
let mockPathname = '/platform/other-tenant/mentor-1';
let mockSwitchInProgress = false;
const mockHandleTenantSwitch = vi.fn();

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

vi.mock('next/navigation', () => ({ usePathname: () => mockPathname }));

vi.mock('@iblai/iblai-js/web-utils', () => ({
  isTenantSwitchInProgress: () => mockSwitchInProgress,
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => mockUsername,
  useCurrentTenant: () => ({ currentTenant: mockCurrentTenant }),
}));

vi.mock('@/lib/utils', () => ({
  handleTenantSwitch: (...args: unknown[]) => mockHandleTenantSwitch(...args),
}));

// Fresh module each test → resets the module-level locked-tenant cache.
async function load() {
  vi.resetModules();
  return import('@/hooks/use-tenant-lock');
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

beforeEach(() => {
  mockIsTauri = true;
  mockInvokeResult = 'acme';
  mockInvokeThrows = false;
  mockUsername = 'user-1';
  mockCurrentTenant = { key: 'other-tenant' };
  mockPathname = '/platform/other-tenant/mentor-1';
  mockSwitchInProgress = false;
  mockHandleTenantSwitch.mockReset();
});

describe('useLockedTenant', () => {
  it('returns the trimmed locked tenant from the Tauri command', async () => {
    mockInvokeResult = '  acme  ';
    const { useLockedTenant } = await load();
    const { result } = renderHook(() => useLockedTenant());
    await waitFor(() => expect(result.current).toBe('acme'));
  });

  it('returns "" on web (not a Tauri app)', async () => {
    mockIsTauri = false;
    const { useLockedTenant } = await load();
    const { result } = renderHook(() => useLockedTenant());
    await flush();
    expect(result.current).toBe('');
  });

  it('returns "" when the command throws', async () => {
    mockInvokeThrows = true;
    const { useLockedTenant } = await load();
    const { result } = renderHook(() => useLockedTenant());
    await flush();
    expect(result.current).toBe('');
  });
});

describe('useTenantLock', () => {
  it('forces a switch when signed in on a different tenant', async () => {
    const { useTenantLock } = await load();
    renderHook(() => useTenantLock());
    await waitFor(() =>
      expect(mockHandleTenantSwitch).toHaveBeenCalledWith('acme'),
    );
  });

  it('does nothing when already on the locked tenant', async () => {
    mockCurrentTenant = { key: 'acme' };
    const { useTenantLock } = await load();
    renderHook(() => useTenantLock());
    await flush();
    expect(mockHandleTenantSwitch).not.toHaveBeenCalled();
  });

  it('does nothing for anonymous users', async () => {
    mockUsername = null;
    const { useTenantLock } = await load();
    renderHook(() => useTenantLock());
    await flush();
    expect(mockHandleTenantSwitch).not.toHaveBeenCalled();
  });

  it('does nothing on web builds (no locked tenant)', async () => {
    mockIsTauri = false;
    const { useTenantLock } = await load();
    renderHook(() => useTenantLock());
    await flush();
    expect(mockHandleTenantSwitch).not.toHaveBeenCalled();
  });

  it('does not interfere during the SSO handshake', async () => {
    mockPathname = '/sso-login-complete';
    const { useTenantLock } = await load();
    renderHook(() => useTenantLock());
    await flush();
    expect(mockHandleTenantSwitch).not.toHaveBeenCalled();
  });

  it('does not re-trigger while a switch is already in progress', async () => {
    mockSwitchInProgress = true;
    const { useTenantLock } = await load();
    renderHook(() => useTenantLock());
    await flush();
    expect(mockHandleTenantSwitch).not.toHaveBeenCalled();
  });
});
