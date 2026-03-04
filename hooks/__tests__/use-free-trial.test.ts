import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFreeTrial } from '../use-free-trial';

// Mock the config module
vi.mock('@/lib/config', () => ({
  config: {
    mainTenantKey: vi.fn(() => 'main-tenant'),
  },
}));

// Mock use-user hooks
const mockUseCurrentTenant = vi.fn();
const mockUseGetAllTenants = vi.fn();
vi.mock('../use-user', () => ({
  useCurrentTenant: () => mockUseCurrentTenant(),
  useGetAllTenants: () => mockUseGetAllTenants(),
}));

describe('useFreeTrial', () => {
  beforeEach(() => {
    mockUseCurrentTenant.mockReset();
    mockUseGetAllTenants.mockReset();
  });

  describe('userOnFreeTrial', () => {
    it('should return true when user is on main tenant, not admin, and only has one tenant', () => {
      mockUseCurrentTenant.mockReturnValue({
        currentTenant: {
          key: 'main-tenant',
          is_admin: false,
        },
      });
      mockUseGetAllTenants.mockReturnValue([{ key: 'main-tenant' }]);

      const { result } = renderHook(() => useFreeTrial());

      expect(result.current.userOnFreeTrial()).toBe(true);
    });

    it('should return false when user is not on main tenant', () => {
      mockUseCurrentTenant.mockReturnValue({
        currentTenant: {
          key: 'other-tenant',
          is_admin: false,
        },
      });
      mockUseGetAllTenants.mockReturnValue([{ key: 'other-tenant' }]);

      const { result } = renderHook(() => useFreeTrial());

      expect(result.current.userOnFreeTrial()).toBe(false);
    });

    it('should return false when user is admin', () => {
      mockUseCurrentTenant.mockReturnValue({
        currentTenant: {
          key: 'main-tenant',
          is_admin: true,
        },
      });
      mockUseGetAllTenants.mockReturnValue([{ key: 'main-tenant' }]);

      const { result } = renderHook(() => useFreeTrial());

      expect(result.current.userOnFreeTrial()).toBe(false);
    });

    it('should return false when user has multiple tenants', () => {
      mockUseCurrentTenant.mockReturnValue({
        currentTenant: {
          key: 'main-tenant',
          is_admin: false,
        },
      });
      mockUseGetAllTenants.mockReturnValue([{ key: 'main-tenant' }, { key: 'other-tenant' }]);

      const { result } = renderHook(() => useFreeTrial());

      expect(result.current.userOnFreeTrial()).toBe(false);
    });

    it('should return false when currentTenant is undefined', () => {
      mockUseCurrentTenant.mockReturnValue({
        currentTenant: undefined,
      });
      mockUseGetAllTenants.mockReturnValue([{ key: 'main-tenant' }]);

      const { result } = renderHook(() => useFreeTrial());

      expect(result.current.userOnFreeTrial()).toBe(false);
    });

    it('should return false when allTenants is empty', () => {
      mockUseCurrentTenant.mockReturnValue({
        currentTenant: {
          key: 'main-tenant',
          is_admin: false,
        },
      });
      mockUseGetAllTenants.mockReturnValue([]);

      const { result } = renderHook(() => useFreeTrial());

      expect(result.current.userOnFreeTrial()).toBe(false);
    });

    it('should return false when allTenants is undefined', () => {
      mockUseCurrentTenant.mockReturnValue({
        currentTenant: {
          key: 'main-tenant',
          is_admin: false,
        },
      });
      mockUseGetAllTenants.mockReturnValue(undefined);

      const { result } = renderHook(() => useFreeTrial());

      expect(result.current.userOnFreeTrial()).toBe(false);
    });
  });

  describe('hook stability', () => {
    it('should return object with userOnFreeTrial function', () => {
      mockUseCurrentTenant.mockReturnValue({
        currentTenant: { key: 'test', is_admin: false },
      });
      mockUseGetAllTenants.mockReturnValue([]);

      const { result } = renderHook(() => useFreeTrial());

      expect(result.current).toHaveProperty('userOnFreeTrial');
      expect(typeof result.current.userOnFreeTrial).toBe('function');
    });
  });
});
