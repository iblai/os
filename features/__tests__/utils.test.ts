import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock config
vi.mock('@/lib/config', () => ({
  config: {
    lmsUrl: vi.fn(() => 'https://lms.example.com'),
    dmUrl: vi.fn(() => 'https://dm.example.com'),
    axdUrl: vi.fn(() => 'https://axd.example.com'),
    iblTemplateMentor: vi.fn(() => 'default-mentor'),
  },
}));

// Mock constants
vi.mock('../constants', () => ({
  SERVICES: {
    LMS: 'lms',
    DM: 'dm',
    AXD: 'axd',
  },
}));

vi.mock('@/lib/constants', () => ({
  LOCAL_STORAGE_KEYS: {
    EDX_TOKEN_KEY: 'edx_token',
    DM_TOKEN_KEY: 'dm_token',
    AXD_TOKEN_KEY: 'axd_token',
  },
  MODEL_AGENTS: [],
}));

// Create localStorage mock
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    _setStore: (newStore: Record<string, string>) => {
      store = newStore;
    },
  };
})();
vi.stubGlobal('localStorage', localStorageMock);

import {
  getServiceUrl,
  getUserName,
  getUserId,
  getUserEmail,
  getAuthHeaders,
} from '../utils';
import { SERVICES } from '../constants';

describe('features/utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock._setStore({});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getServiceUrl', () => {
    it('should return LMS URL for LMS service', () => {
      const url = getServiceUrl(SERVICES.LMS);
      expect(url).toBe('https://lms.example.com');
    });

    it('should return DM URL for DM service', () => {
      const url = getServiceUrl(SERVICES.DM);
      expect(url).toBe('https://dm.example.com');
    });

    it('should return AXD URL for AXD service', () => {
      const url = getServiceUrl(SERVICES.AXD);
      expect(url).toBe('https://axd.example.com');
    });

    it('should return DM URL for unknown service (default)', () => {
      // @ts-expect-error - testing unknown service
      const url = getServiceUrl('unknown');
      expect(url).toBe('https://dm.example.com');
    });
  });

  describe('getUserName', () => {
    it('should return user_nicename from localStorage', () => {
      const userData = { user_nicename: 'testuser', user_id: 123 };
      localStorageMock._setStore({ userData: JSON.stringify(userData) });

      const username = getUserName();
      expect(username).toBe('testuser');
    });

    it('should return undefined when no user data', () => {
      const username = getUserName();
      expect(username).toBeUndefined();
    });

    it('should return null when userData is invalid JSON', () => {
      localStorageMock._setStore({ userData: 'invalid-json' });

      // The implementation catches JSON parse errors and returns null
      expect(getUserName()).toBeNull();
    });
  });

  describe('getUserId', () => {
    it('should return user_id from localStorage', () => {
      const userData = { user_nicename: 'testuser', user_id: 123 };
      localStorageMock._setStore({ userData: JSON.stringify(userData) });

      const userId = getUserId();
      expect(userId).toBe(123);
    });

    it('should return undefined when no user data', () => {
      const userId = getUserId();
      expect(userId).toBeUndefined();
    });
  });

  describe('getUserEmail', () => {
    it('should return user_email from localStorage', () => {
      const userData = {
        user_nicename: 'testuser',
        user_id: 123,
        user_email: 'test@example.com',
      };
      localStorageMock._setStore({ userData: JSON.stringify(userData) });

      const email = getUserEmail();
      expect(email).toBe('test@example.com');
    });

    it('should return undefined when no user data', () => {
      const email = getUserEmail();
      expect(email).toBeUndefined();
    });
  });

  /**
   * What an endpoint is allowed to send. `prepareHeaders` spreads exactly
   * this onto the outgoing request, so an empty object means no credentials
   * leave the browser.
   */
  describe('getAuthHeaders', () => {
    beforeEach(() => {
      localStorageMock._setStore({
        edx_token: 'edx-jwt-value',
        dm_token: 'dm-token-value',
        axd_token: 'axd-token-value',
      });
    });

    // The LMS answers a stale or absent JWT with a 401 rather than ignoring
    // it, and this endpoint is read to build a sign-in screen — so the caller
    // may legitimately have no session at all.
    it('sends nothing for getIntegratedSsoProviders', () => {
      expect(getAuthHeaders(SERVICES.LMS, 'getIntegratedSsoProviders')).toEqual(
        {},
      );
    });

    it('still sends the edX JWT for other LMS endpoints', () => {
      expect(getAuthHeaders(SERVICES.LMS, 'getUserTenants')).toEqual({
        Authorization: 'JWT edx-jwt-value',
      });
    });

    it('still sends the DM token for DM endpoints', () => {
      expect(getAuthHeaders(SERVICES.DM, 'getSomething')).toEqual({
        Authorization: 'Token dm-token-value',
      });
    });

    it('still sends the AXD token for AXD endpoints', () => {
      expect(getAuthHeaders(SERVICES.AXD, 'getTenantMetadata')).toEqual({
        Authorization: 'Token axd-token-value',
      });
    });

    // The exemption is by endpoint, not by service: another service must not
    // inherit it just because the names happen to collide.
    it('exempts only the named endpoint, whatever the service', () => {
      expect(getAuthHeaders(SERVICES.DM, 'getIntegratedSsoProviders')).toEqual(
        {},
      );
      expect(
        getAuthHeaders(SERVICES.LMS, 'getIntegratedSsoProvidersExtra'),
      ).toEqual({
        Authorization: 'JWT edx-jwt-value',
      });
    });

    it('authenticates when the endpoint name is unknown', () => {
      expect(getAuthHeaders(SERVICES.LMS)).toEqual({
        Authorization: 'JWT edx-jwt-value',
      });
    });
  });
});
