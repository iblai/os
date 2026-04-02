import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock next/navigation
const mockPathname = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

// Mock react-redux
const mockDispatch = vi.fn();
const mockUseSelector = vi.fn();
vi.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
  useSelector: (selector: (state: unknown) => unknown) =>
    mockUseSelector(selector),
}));

// Mock useLocalStorage
const mockLocalStorageValue = vi.fn();
const mockSetLocalStorageValue = vi.fn();
vi.mock('@/hooks/use-local-storage', () => ({
  useLocalStorage: () => [mockLocalStorageValue(), mockSetLocalStorageValue],
}));

// Mock useAppSelector
vi.mock('@/lib/hooks', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) =>
    mockUseSelector(selector),
}));

// Mock config
vi.mock('@/lib/config', () => ({
  config: {
    mentorIframeUrl: vi.fn(() => vi.fn(() => 'false')),
    iblTemplateMentor: vi.fn(() => 'default-mentor'),
  },
}));

// Mock constants that use config
vi.mock('@/lib/constants', () => ({
  LOCAL_STORAGE_KEYS: {
    USER_DATA: 'userData',
    CURRENT_TENANT: 'currentTenant',
    USER_TENANTS: 'tenants',
  },
  ADMIN_PAGES_SUBPATHS: {
    SETTINGS: '/admin/settings',
    USERS: '/admin/users',
    ANALYTICS: '/admin/analytics',
  },
  MODEL_AGENTS: [],
}));

// Mock slice actions
vi.mock('@/features/users/slice', () => ({
  userSliceActions: {
    setIsInstructorMode: vi.fn((value) => ({
      type: 'SET_INSTRUCTOR_MODE',
      payload: value,
    })),
  },
}));

vi.mock('@/features/navigation/slice', () => ({
  initCustomAlertDialog: vi.fn((payload) => ({
    type: 'INIT_CUSTOM_ALERT_DIALOG',
    payload,
  })),
}));

import {
  useUserData,
  useUsername,
  useCurrentTenant,
  useUserTenants,
  useIsAdmin,
  useUserIsOnTrial,
  useUserIsStudent,
  useLearnerMode,
} from '../use-user';

describe('providers/use-user', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname.mockReturnValue('/tenant/mentor');
    mockUseSelector.mockReturnValue(false);
    mockLocalStorageValue.mockReturnValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('useUserData', () => {
    it('should return null when no data in localStorage', () => {
      mockLocalStorageValue.mockReturnValue(null);
      const { result } = renderHook(() => useUserData());
      expect(result.current).toBeNull();
    });

    it('should return null when data is invalid', () => {
      mockLocalStorageValue.mockReturnValue({ invalid: 'data' });
      const { result } = renderHook(() => useUserData());
      expect(result.current).toBeNull();
    });

    it('should return parsed user data when valid', () => {
      const validUserData = {
        user_display_name: 'Test User',
        user_email: 'test@example.com',
        user_fullname: 'Test User Full',
        user_id: 123,
        user_nicename: 'testuser',
      };
      mockLocalStorageValue.mockReturnValue(validUserData);
      const { result } = renderHook(() => useUserData());
      expect(result.current).toEqual(validUserData);
    });
  });

  describe('useUsername', () => {
    it('should return null when no user data', () => {
      mockLocalStorageValue.mockReturnValue(null);
      const { result } = renderHook(() => useUsername());
      expect(result.current).toBeNull();
    });

    it('should return username when user data exists', () => {
      const validUserData = {
        user_display_name: 'Test User',
        user_email: 'test@example.com',
        user_fullname: 'Test User Full',
        user_id: 123,
        user_nicename: 'testuser',
      };
      mockLocalStorageValue.mockReturnValue(validUserData);
      const { result } = renderHook(() => useUsername());
      expect(result.current).toBe('testuser');
    });
  });

  describe('useCurrentTenant', () => {
    it('should return current tenant and setter', () => {
      const tenant = { key: 'test-tenant', is_admin: true };
      mockLocalStorageValue.mockReturnValue(tenant);

      const { result } = renderHook(() => useCurrentTenant());

      expect(result.current.currentTenant).toEqual(tenant);
      expect(result.current.saveCurrentTenant).toBe(mockSetLocalStorageValue);
    });

    it('should return null when no tenant', () => {
      mockLocalStorageValue.mockReturnValue(null);
      const { result } = renderHook(() => useCurrentTenant());
      expect(result.current.currentTenant).toBeNull();
    });
  });

  describe('useUserTenants', () => {
    it('should return user tenants and setter', () => {
      const tenants = [{ key: 'tenant1' }, { key: 'tenant2' }];
      mockLocalStorageValue.mockReturnValue(tenants);

      const { result } = renderHook(() => useUserTenants());

      expect(result.current.userTenants).toEqual(tenants);
      expect(result.current.saveUserTenants).toBe(mockSetLocalStorageValue);
    });

    it('should return empty array when no tenants', () => {
      mockLocalStorageValue.mockReturnValue([]);
      const { result } = renderHook(() => useUserTenants());
      expect(result.current.userTenants).toEqual([]);
    });
  });

  describe('useIsAdmin', () => {
    it('should return false when no current tenant', () => {
      mockLocalStorageValue.mockReturnValue(null);
      const { result } = renderHook(() => useIsAdmin());
      expect(result.current).toBe(false);
    });

    it('should return true when user is admin', () => {
      mockLocalStorageValue.mockReturnValue({ key: 'tenant', is_admin: true });
      const { result } = renderHook(() => useIsAdmin());
      expect(result.current).toBe(true);
    });

    it('should return false when user is not admin', () => {
      mockLocalStorageValue.mockReturnValue({ key: 'tenant', is_admin: false });
      const { result } = renderHook(() => useIsAdmin());
      expect(result.current).toBe(false);
    });
  });

  describe('useUserIsOnTrial', () => {
    it('should return false when no current tenant', () => {
      mockLocalStorageValue.mockReturnValue(null);
      const { result } = renderHook(() => useUserIsOnTrial());
      expect(result.current).toBe(false);
    });

    // Note: Other conditions require config.mentorIframeUrl to return 'true'
    // which is mocked to return 'false' by default
    it('should return false by default', () => {
      mockLocalStorageValue.mockReturnValue({ key: 'main', is_admin: false });
      const { result } = renderHook(() => useUserIsOnTrial());
      expect(result.current).toBe(false);
    });
  });

  describe('useUserIsOnTrial with iframe mode', () => {
    // This test requires a fresh module import with different config mock
    it('should return true when on main tenant, not admin, with iframe mode and single tenant', async () => {
      vi.resetModules();

      // Re-mock with config.mentorIframeUrl returning 'true'
      vi.doMock('@/lib/config', () => ({
        config: {
          mentorIframeUrl: vi.fn(() => vi.fn(() => 'true')),
          iblTemplateMentor: vi.fn(() => 'default-mentor'),
        },
      }));

      // Re-mock other dependencies
      vi.doMock('next/navigation', () => ({
        usePathname: () => '/tenant/mentor',
      }));

      vi.doMock('react-redux', () => ({
        useDispatch: () => vi.fn(),
        useSelector: () => false,
      }));

      vi.doMock('@/lib/hooks', () => ({
        useAppSelector: () => false,
      }));

      vi.doMock('@/lib/constants', () => ({
        LOCAL_STORAGE_KEYS: {
          USER_DATA: 'userData',
          CURRENT_TENANT: 'currentTenant',
          USER_TENANTS: 'tenants',
        },
        ADMIN_PAGES_SUBPATHS: {
          SETTINGS: '/admin/settings',
          USERS: '/admin/users',
          ANALYTICS: '/admin/analytics',
        },
        MODEL_AGENTS: [],
      }));

      vi.doMock('@/features/users/slice', () => ({
        userSliceActions: {
          setIsInstructorMode: vi.fn(),
        },
      }));

      vi.doMock('@/features/navigation/slice', () => ({
        initCustomAlertDialog: vi.fn(),
      }));

      // Track which call we're on to return different values
      let callCount = 0;
      vi.doMock('@/hooks/use-local-storage', () => ({
        useLocalStorage: () => {
          callCount++;
          // First call is for currentTenant, second is for userTenants
          if (callCount === 1) {
            return [{ key: 'main', is_admin: false }, vi.fn()];
          }
          // Return single tenant array
          return [[{ key: 'main' }], vi.fn()];
        },
      }));

      const { useUserIsOnTrial: useUserIsOnTrialFresh } = await import(
        '../use-user'
      );
      const { renderHook: renderHookFresh } = await import(
        '@testing-library/react'
      );

      const { result } = renderHookFresh(() => useUserIsOnTrialFresh());
      expect(result.current).toBe(true);

      vi.resetModules();
    });

    it('should return false when on main tenant but is admin', async () => {
      vi.resetModules();

      vi.doMock('@/lib/config', () => ({
        config: {
          mentorIframeUrl: vi.fn(() => vi.fn(() => 'true')),
          iblTemplateMentor: vi.fn(() => 'default-mentor'),
        },
      }));

      vi.doMock('next/navigation', () => ({
        usePathname: () => '/tenant/mentor',
      }));

      vi.doMock('react-redux', () => ({
        useDispatch: () => vi.fn(),
        useSelector: () => false,
      }));

      vi.doMock('@/lib/hooks', () => ({
        useAppSelector: () => false,
      }));

      vi.doMock('@/lib/constants', () => ({
        LOCAL_STORAGE_KEYS: {
          USER_DATA: 'userData',
          CURRENT_TENANT: 'currentTenant',
          USER_TENANTS: 'tenants',
        },
        ADMIN_PAGES_SUBPATHS: {},
        MODEL_AGENTS: [],
      }));

      vi.doMock('@/features/users/slice', () => ({
        userSliceActions: { setIsInstructorMode: vi.fn() },
      }));

      vi.doMock('@/features/navigation/slice', () => ({
        initCustomAlertDialog: vi.fn(),
      }));

      let callCount = 0;
      vi.doMock('@/hooks/use-local-storage', () => ({
        useLocalStorage: () => {
          callCount++;
          if (callCount === 1) {
            return [{ key: 'main', is_admin: true }, vi.fn()]; // Admin user
          }
          return [[{ key: 'main' }], vi.fn()];
        },
      }));

      const { useUserIsOnTrial: useUserIsOnTrialFresh } = await import(
        '../use-user'
      );
      const { renderHook: renderHookFresh } = await import(
        '@testing-library/react'
      );

      const { result } = renderHookFresh(() => useUserIsOnTrialFresh());
      expect(result.current).toBe(false);

      vi.resetModules();
    });

    it('should return false when not on main tenant', async () => {
      vi.resetModules();

      vi.doMock('@/lib/config', () => ({
        config: {
          mentorIframeUrl: vi.fn(() => vi.fn(() => 'true')),
          iblTemplateMentor: vi.fn(() => 'default-mentor'),
        },
      }));

      vi.doMock('next/navigation', () => ({
        usePathname: () => '/tenant/mentor',
      }));

      vi.doMock('react-redux', () => ({
        useDispatch: () => vi.fn(),
        useSelector: () => false,
      }));

      vi.doMock('@/lib/hooks', () => ({
        useAppSelector: () => false,
      }));

      vi.doMock('@/lib/constants', () => ({
        LOCAL_STORAGE_KEYS: {
          USER_DATA: 'userData',
          CURRENT_TENANT: 'currentTenant',
          USER_TENANTS: 'tenants',
        },
        ADMIN_PAGES_SUBPATHS: {},
        MODEL_AGENTS: [],
      }));

      vi.doMock('@/features/users/slice', () => ({
        userSliceActions: { setIsInstructorMode: vi.fn() },
      }));

      vi.doMock('@/features/navigation/slice', () => ({
        initCustomAlertDialog: vi.fn(),
      }));

      let callCount = 0;
      vi.doMock('@/hooks/use-local-storage', () => ({
        useLocalStorage: () => {
          callCount++;
          if (callCount === 1) {
            return [{ key: 'other-tenant', is_admin: false }, vi.fn()]; // Not main tenant
          }
          return [[{ key: 'other-tenant' }], vi.fn()];
        },
      }));

      const { useUserIsOnTrial: useUserIsOnTrialFresh } = await import(
        '../use-user'
      );
      const { renderHook: renderHookFresh } = await import(
        '@testing-library/react'
      );

      const { result } = renderHookFresh(() => useUserIsOnTrialFresh());
      expect(result.current).toBe(false);

      vi.resetModules();
    });
  });

  describe('useUserIsStudent', () => {
    it('should return true when admin but not in instructor mode', () => {
      mockLocalStorageValue.mockReturnValue({ key: 'tenant', is_admin: true });
      mockUseSelector.mockReturnValue(false); // isInstructorMode = false

      const { result } = renderHook(() => useUserIsStudent());
      expect(result.current).toBe(true);
    });

    it('should return false when admin in instructor mode', () => {
      mockLocalStorageValue.mockReturnValue({ key: 'tenant', is_admin: true });
      mockUseSelector.mockReturnValue(true); // isInstructorMode = true

      const { result } = renderHook(() => useUserIsStudent());
      expect(result.current).toBe(false);
    });

    it('should return true when not admin', () => {
      mockLocalStorageValue.mockReturnValue({ key: 'tenant', is_admin: false });
      mockUseSelector.mockReturnValue(false);

      const { result } = renderHook(() => useUserIsStudent());
      expect(result.current).toBe(true);
    });
  });

  describe('useLearnerMode', () => {
    it('should return isInstructorMode state', () => {
      mockLocalStorageValue.mockReturnValue({ key: 'tenant', is_admin: true });
      mockUseSelector.mockReturnValue(true);

      const { result } = renderHook(() => useLearnerMode());
      expect(result.current.isInstructorMode).toBe(true);
    });

    it('should have toggleLearnerMode function', () => {
      mockLocalStorageValue.mockReturnValue({ key: 'tenant', is_admin: true });
      mockUseSelector.mockReturnValue(false);

      const { result } = renderHook(() => useLearnerMode());
      expect(typeof result.current.toggleLearnerMode).toBe('function');
    });

    it('should dispatch action when toggling and not on admin page', () => {
      mockLocalStorageValue.mockReturnValue({ key: 'tenant', is_admin: true });
      mockUseSelector.mockReturnValue(false);
      mockPathname.mockReturnValue('/tenant/mentor');

      const { result } = renderHook(() => useLearnerMode());

      act(() => {
        result.current.toggleLearnerMode();
      });

      expect(mockDispatch).toHaveBeenCalled();
    });

    it('should not dispatch if user is not admin', () => {
      mockLocalStorageValue.mockReturnValue({ key: 'tenant', is_admin: false });
      mockUseSelector.mockReturnValue(false);

      const { result } = renderHook(() => useLearnerMode());

      act(() => {
        result.current.toggleLearnerMode();
      });

      expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('should show alert dialog when switching to learner on admin page', () => {
      mockLocalStorageValue.mockReturnValue({ key: 'tenant', is_admin: true });
      mockUseSelector.mockReturnValue(true); // isInstructorMode = true
      mockPathname.mockReturnValue('/tenant/admin/settings'); // Admin page

      const { result } = renderHook(() => useLearnerMode());

      act(() => {
        result.current.toggleLearnerMode();
      });

      // Should dispatch initCustomAlertDialog
      expect(mockDispatch).toHaveBeenCalled();
    });
  });
});
