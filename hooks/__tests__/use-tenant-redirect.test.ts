import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// Mock tenants api-slice
const mockFetchUserTenants = vi.fn();
const mockFetchTenantMetadata = vi.fn();
vi.mock('@/features/tenants/api-slice', () => ({
  useLazyGetUserTenantsQuery: () => [mockFetchUserTenants],
  useLazyGetTenantMetadataQuery: () => [mockFetchTenantMetadata],
}));

import { useTenantProvider } from '../use-tenant-redirect';

describe('useTenantProvider', () => {
  const mockOnAuthSuccess = vi.fn();
  const mockOnAuthFailure = vi.fn();
  const mockRedirectToAuthSpa = vi.fn();
  const mockSaveCurrentTenant = vi.fn();
  const mockSaveUserTenants = vi.fn();

  const defaultProps = {
    onAuthSuccess: mockOnAuthSuccess,
    onAuthFailure: mockOnAuthFailure,
    redirectToAuthSpa: mockRedirectToAuthSpa,
    tenantKey: 'tenant-1',
    saveCurrentTenant: mockSaveCurrentTenant,
    saveUserTenants: mockSaveUserTenants,
  };

  const mockTenants = [
    { key: 'tenant-1', is_admin: true, org: 'org-1' },
    { key: 'tenant-2', is_admin: false, org: 'org-2' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset window.location mock
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    });
    mockFetchUserTenants.mockResolvedValue({ data: mockTenants });
    mockFetchTenantMetadata.mockResolvedValue({
      data: { metadata: null },
    });
  });

  describe('initial state', () => {
    it('should return isLoading as true initially', () => {
      const { result } = renderHook(() => useTenantProvider(defaultProps));

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('successful tenant resolution', () => {
    it('should call fetchUserTenants on mount', async () => {
      renderHook(() => useTenantProvider(defaultProps));

      await waitFor(() => {
        expect(mockFetchUserTenants).toHaveBeenCalled();
      });
    });

    it('should call fetchTenantMetadata after getting user tenants', async () => {
      renderHook(() => useTenantProvider(defaultProps));

      await waitFor(() => {
        expect(mockFetchTenantMetadata).toHaveBeenCalledWith({
          tenantKey: 'tenant-1',
        });
      });
    });

    it('should save user tenants', async () => {
      renderHook(() => useTenantProvider(defaultProps));

      await waitFor(() => {
        expect(mockSaveUserTenants).toHaveBeenCalledWith(mockTenants);
      });
    });

    it('should save current tenant when no spa_domains redirect', async () => {
      renderHook(() => useTenantProvider(defaultProps));

      await waitFor(() => {
        expect(mockSaveCurrentTenant).toHaveBeenCalledWith({
          key: 'tenant-1',
          is_admin: true,
          org: 'org-1',
        });
      });
    });

    it('should set isLoading to false after resolution', async () => {
      const { result } = renderHook(() => useTenantProvider(defaultProps));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('spa_domains redirect', () => {
    it('should redirect to spa_domains when active', async () => {
      mockFetchTenantMetadata.mockResolvedValue({
        data: {
          metadata: {
            spa_domains: {
              mentor: {
                active: true,
                domain: 'https://mentor.example.com',
              },
            },
          },
        },
      });

      renderHook(() => useTenantProvider(defaultProps));

      await waitFor(() => {
        expect(window.location.href).toBe('https://mentor.example.com');
      });
    });

    it('should call onAuthSuccess after spa_domains redirect', async () => {
      mockFetchTenantMetadata.mockResolvedValue({
        data: {
          metadata: {
            spa_domains: {
              mentor: {
                active: true,
                domain: 'https://mentor.example.com',
              },
            },
          },
        },
      });

      renderHook(() => useTenantProvider(defaultProps));

      await waitFor(() => {
        expect(mockOnAuthSuccess).toHaveBeenCalled();
      });
    });

    it('should not save current tenant when redirecting via spa_domains', async () => {
      mockFetchTenantMetadata.mockResolvedValue({
        data: {
          metadata: {
            spa_domains: {
              mentor: {
                active: true,
                domain: 'https://mentor.example.com',
              },
            },
          },
        },
      });

      renderHook(() => useTenantProvider(defaultProps));

      await waitFor(() => {
        expect(mockOnAuthSuccess).toHaveBeenCalled();
      });

      expect(mockSaveCurrentTenant).not.toHaveBeenCalled();
    });
  });

  describe('no tenants found', () => {
    it('should redirect to auth spa when no tenants', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockFetchUserTenants.mockResolvedValue({ data: [] });

      renderHook(() => useTenantProvider(defaultProps));

      await waitFor(() => {
        expect(mockRedirectToAuthSpa).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });

    it('should redirect to auth spa when tenants is null', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockFetchUserTenants.mockResolvedValue({ data: null });

      renderHook(() => useTenantProvider(defaultProps));

      await waitFor(() => {
        expect(mockRedirectToAuthSpa).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });

    it('should not call saveUserTenants when no tenants', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockFetchUserTenants.mockResolvedValue({ data: [] });

      renderHook(() => useTenantProvider(defaultProps));

      await waitFor(() => {
        expect(mockRedirectToAuthSpa).toHaveBeenCalled();
      });

      expect(mockSaveUserTenants).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('tenant not found in user tenants', () => {
    it('should redirect to auth spa when tenant key not in user tenants', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      renderHook(() =>
        useTenantProvider({
          ...defaultProps,
          tenantKey: 'non-existent-tenant',
        }),
      );

      await waitFor(() => {
        expect(mockRedirectToAuthSpa).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });

    it('should not call fetchTenantMetadata when tenant not found', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      renderHook(() =>
        useTenantProvider({
          ...defaultProps,
          tenantKey: 'non-existent-tenant',
        }),
      );

      await waitFor(() => {
        expect(mockRedirectToAuthSpa).toHaveBeenCalled();
      });

      expect(mockFetchTenantMetadata).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('error handling', () => {
    it('should call onAuthFailure when fetchUserTenants throws', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockFetchUserTenants.mockRejectedValue(new Error('Network error'));

      renderHook(() => useTenantProvider(defaultProps));

      await waitFor(() => {
        expect(mockOnAuthFailure).toHaveBeenCalledWith(
          'Unexpected error: Network error',
        );
      });

      consoleSpy.mockRestore();
      logSpy.mockRestore();
    });

    it('should redirect to auth spa on error', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockFetchUserTenants.mockRejectedValue(new Error('Network error'));

      renderHook(() => useTenantProvider(defaultProps));

      await waitFor(() => {
        expect(mockRedirectToAuthSpa).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
      logSpy.mockRestore();
    });

    it('should set isLoading to false after error', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockFetchUserTenants.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useTenantProvider(defaultProps));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      consoleSpy.mockRestore();
      logSpy.mockRestore();
    });

    it('should handle non-Error thrown objects', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockFetchUserTenants.mockRejectedValue('String error');

      renderHook(() => useTenantProvider(defaultProps));

      await waitFor(() => {
        expect(mockOnAuthFailure).toHaveBeenCalledWith(
          'Unexpected error: String error',
        );
      });

      consoleSpy.mockRestore();
      logSpy.mockRestore();
    });
  });

  describe('optional callbacks', () => {
    it('should work without onAuthSuccess', async () => {
      mockFetchTenantMetadata.mockResolvedValue({
        data: {
          metadata: {
            spa_domains: {
              mentor: {
                active: true,
                domain: 'https://mentor.example.com',
              },
            },
          },
        },
      });

      const { result } = renderHook(() =>
        useTenantProvider({
          ...defaultProps,
          onAuthSuccess: undefined,
        }),
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should work without onAuthFailure', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockFetchUserTenants.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useTenantProvider({
          ...defaultProps,
          onAuthFailure: undefined,
        }),
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      consoleSpy.mockRestore();
      logSpy.mockRestore();
    });
  });

  describe('metadata edge cases', () => {
    it('should save current tenant when spa_domains is not active', async () => {
      mockFetchTenantMetadata.mockResolvedValue({
        data: {
          metadata: {
            spa_domains: {
              mentor: {
                active: false,
                domain: 'https://mentor.example.com',
              },
            },
          },
        },
      });

      renderHook(() => useTenantProvider(defaultProps));

      await waitFor(() => {
        expect(mockSaveCurrentTenant).toHaveBeenCalledWith({
          key: 'tenant-1',
          is_admin: true,
          org: 'org-1',
        });
      });
    });

    it('should save current tenant when mentor domain config is missing', async () => {
      mockFetchTenantMetadata.mockResolvedValue({
        data: {
          metadata: {
            spa_domains: {},
          },
        },
      });

      renderHook(() => useTenantProvider(defaultProps));

      await waitFor(() => {
        expect(mockSaveCurrentTenant).toHaveBeenCalledWith({
          key: 'tenant-1',
          is_admin: true,
          org: 'org-1',
        });
      });
    });

    it('should save current tenant when metadata is undefined', async () => {
      mockFetchTenantMetadata.mockResolvedValue({
        data: undefined,
      });

      renderHook(() => useTenantProvider(defaultProps));

      await waitFor(() => {
        expect(mockSaveCurrentTenant).toHaveBeenCalledWith({
          key: 'tenant-1',
          is_admin: true,
          org: 'org-1',
        });
      });
    });
  });
});
