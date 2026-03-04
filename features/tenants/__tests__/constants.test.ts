import { describe, it, expect } from 'vitest';
import { TENANTS_ENDPOINTS, TENANTS_QUERY_KEYS, TENANTS_REDUCER_KEY } from '../constants';
import { SERVICES } from '../../constants';

describe('tenants/constants', () => {
  describe('TENANTS_ENDPOINTS', () => {
    it('should have GET_USER_TENANTS endpoint configuration', () => {
      expect(TENANTS_ENDPOINTS.GET_USER_TENANTS).toBeDefined();
      expect(TENANTS_ENDPOINTS.GET_USER_TENANTS.service).toBe(SERVICES.LMS);
    });

    it('should generate correct path for GET_USER_TENANTS', () => {
      const path = TENANTS_ENDPOINTS.GET_USER_TENANTS.path();

      expect(path).toBe('/api/ibl/users/manage/platform/');
    });

    it('should have GET_PLATFORM_METADATA endpoint configuration', () => {
      expect(TENANTS_ENDPOINTS.GET_PLATFORM_METADATA).toBeDefined();
      expect(TENANTS_ENDPOINTS.GET_PLATFORM_METADATA.service).toBe(SERVICES.AXD);
    });

    it('should generate correct path for GET_PLATFORM_METADATA', () => {
      const tenantKey = 'test-tenant';
      const path = TENANTS_ENDPOINTS.GET_PLATFORM_METADATA.path(tenantKey);

      expect(path).toBe(`/api/core/orgs/${tenantKey}/metadata/`);
    });
  });

  describe('TENANTS_QUERY_KEYS', () => {
    it('should return correct query key for GET_USER_TENANTS', () => {
      const queryKey = TENANTS_QUERY_KEYS.GET_USER_TENANTS();

      expect(queryKey).toBe('USER_TENANTS');
    });

    it('should return correct query key for GET_PLATFORM_METADATA', () => {
      const queryKey = TENANTS_QUERY_KEYS.GET_PLATFORM_METADATA();

      expect(queryKey).toBe('TENANT_METADATA');
    });
  });

  describe('TENANTS_REDUCER_KEY', () => {
    it('should have correct reducer key', () => {
      expect(TENANTS_REDUCER_KEY).toBe('tenantsApiSliceLocal');
    });
  });
});
