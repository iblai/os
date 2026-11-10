import { describe, it, expect } from 'vitest';
import {
  TENANTS_ENDPOINTS,
  TENANTS_QUERY_KEYS,
  TENANTS_REDUCER_KEY,
} from '../constants';
import { SERVICES } from '../../constants';

describe('tenants/constants', () => {
  describe('TENANTS_ENDPOINTS', () => {
    // The tenants list comes from DM now (the SDK's TenantProvider reads
    // `/api/core/users/platforms/`). Nothing here may reach the edX LMS.
    it('declares no endpoint on the edX LMS', () => {
      const services = Object.values(TENANTS_ENDPOINTS).map((e) => e.service);
      expect(services).not.toContain(SERVICES.LMS);
    });

    it('should have GET_PLATFORM_METADATA endpoint configuration', () => {
      expect(TENANTS_ENDPOINTS.GET_PLATFORM_METADATA).toBeDefined();
      expect(TENANTS_ENDPOINTS.GET_PLATFORM_METADATA.service).toBe(
        SERVICES.AXD,
      );
    });

    it('should generate correct path for GET_PLATFORM_METADATA', () => {
      const tenantKey = 'test-tenant';
      const path = TENANTS_ENDPOINTS.GET_PLATFORM_METADATA.path(tenantKey);

      expect(path).toBe(`/api/core/orgs/${tenantKey}/metadata/`);
    });
  });

  describe('TENANTS_QUERY_KEYS', () => {
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
