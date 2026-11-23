import { SERVICES } from '@/features/constants';

export const TENANTS_ENDPOINTS = {
  GET_PLATFORM_METADATA: {
    service: SERVICES.AXD,
    path: (tenantKey: string) => `/api/core/orgs/${tenantKey}/metadata/`,
  },
};

export const TENANTS_QUERY_KEYS = {
  GET_PLATFORM_METADATA: () => 'TENANT_METADATA',
};

export const TENANTS_REDUCER_KEY = 'tenantsApiSliceLocal';
