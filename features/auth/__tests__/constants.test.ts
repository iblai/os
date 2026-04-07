import { describe, it, expect } from 'vitest';
import { AUTH_ENDPOINTS, AUTH_REDUCER_PATH } from '../constants';
import { SERVICES } from '../../constants';

describe('auth/constants', () => {
  describe('AUTH_ENDPOINTS', () => {
    it('should have GET_INTEGRATED_SSO_PROVIDERS endpoint configuration', () => {
      expect(AUTH_ENDPOINTS.GET_INTEGRATED_SSO_PROVIDERS).toBeDefined();
      expect(AUTH_ENDPOINTS.GET_INTEGRATED_SSO_PROVIDERS.service).toBe(
        SERVICES.LMS,
      );
    });

    it('should generate correct path for GET_INTEGRATED_SSO_PROVIDERS', () => {
      const path = AUTH_ENDPOINTS.GET_INTEGRATED_SSO_PROVIDERS.path();

      expect(path).toBe('/ibl-auth/get-provider-slug/');
    });
  });

  describe('AUTH_REDUCER_PATH', () => {
    it('should have correct reducer path', () => {
      expect(AUTH_REDUCER_PATH).toBe('authApiSliceLocal');
    });
  });
});
