import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTenantKey } from '../use-tenants';

// Mock useLocalStorage
const mockUseLocalStorage = vi.fn();
vi.mock('@/hooks/use-local-storage', () => ({
  useLocalStorage: (...args: unknown[]) => mockUseLocalStorage(...args),
}));

// Mock constants
vi.mock('@/lib/constants', () => ({
  LOCAL_STORAGE_KEYS: {
    DEFAULT_TENANT: 'default_tenant',
  },
}));

describe('useTenantKey', () => {
  const mockSaveTenant = vi.fn();

  beforeEach(() => {
    mockUseLocalStorage.mockReset();
    mockSaveTenant.mockReset();
  });

  describe('tenant value', () => {
    it('should return tenant from localStorage', () => {
      mockUseLocalStorage.mockReturnValue(['test-tenant', mockSaveTenant, vi.fn()]);

      const { result } = renderHook(() => useTenantKey());

      expect(result.current.tenant).toBe('test-tenant');
    });

    it('should return null when no tenant stored', () => {
      mockUseLocalStorage.mockReturnValue([null, mockSaveTenant, vi.fn()]);

      const { result } = renderHook(() => useTenantKey());

      expect(result.current.tenant).toBeNull();
    });

    it('should call useLocalStorage with correct key and default value', () => {
      mockUseLocalStorage.mockReturnValue([null, mockSaveTenant, vi.fn()]);

      renderHook(() => useTenantKey());

      expect(mockUseLocalStorage).toHaveBeenCalledWith(
        'default_tenant',
        null,
        expect.objectContaining({
          serializer: expect.any(Function),
        }),
      );
    });
  });

  describe('saveTenant function', () => {
    it('should return saveTenant function', () => {
      mockUseLocalStorage.mockReturnValue(['tenant', mockSaveTenant, vi.fn()]);

      const { result } = renderHook(() => useTenantKey());

      expect(result.current.saveTenant).toBe(mockSaveTenant);
    });

    it('should allow saving a new tenant', () => {
      mockUseLocalStorage.mockReturnValue(['old-tenant', mockSaveTenant, vi.fn()]);

      const { result } = renderHook(() => useTenantKey());

      act(() => {
        result.current.saveTenant('new-tenant');
      });

      expect(mockSaveTenant).toHaveBeenCalledWith('new-tenant');
    });

    it('should allow saving null tenant', () => {
      mockUseLocalStorage.mockReturnValue(['tenant', mockSaveTenant, vi.fn()]);

      const { result } = renderHook(() => useTenantKey());

      act(() => {
        result.current.saveTenant(null);
      });

      expect(mockSaveTenant).toHaveBeenCalledWith(null);
    });
  });

  describe('serializer option', () => {
    it('should provide a serializer that returns the value as string', () => {
      mockUseLocalStorage.mockReturnValue([null, mockSaveTenant, vi.fn()]);

      renderHook(() => useTenantKey());

      // Get the serializer from the call
      const options = mockUseLocalStorage.mock.calls[0][2];
      const serializer = options.serializer;

      expect(serializer('test-value')).toBe('test-value');
      expect(serializer(null)).toBe(null);
    });
  });

  describe('return structure', () => {
    it('should return object with tenant and saveTenant', () => {
      mockUseLocalStorage.mockReturnValue(['tenant', mockSaveTenant, vi.fn()]);

      const { result } = renderHook(() => useTenantKey());

      expect(result.current).toHaveProperty('tenant');
      expect(result.current).toHaveProperty('saveTenant');
      expect(Object.keys(result.current)).toHaveLength(2);
    });
  });
});
