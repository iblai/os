import { SERVICES } from '@/features/constants';

export const TENANTS_ENDPOINTS = {
  GET_USER_TENANTS: {
    service: SERVICES.LMS,
    path: () => `/api/ibl/users/manage/platform/`,
  },
  GET_PLATFORM_METADATA: {
    service: SERVICES.AXD,
    path: (tenantKey: string) => `/api/core/orgs/${tenantKey}/metadata/`,
  },
  // Per-user, per-platform metadata — read/replace the current admin's metadata
  // (used to gate first-run onboarding). `platform_key` is passed as a query param.
  GET_USER_PLATFORM_METADATA: {
    service: SERVICES.DM,
    path: () => `/api/core/users/platform-metadata/`,
  },
  UPDATE_USER_PLATFORM_METADATA: {
    service: SERVICES.DM,
    path: () => `/api/core/users/platform-metadata/`,
  },
  // Paginated list of platform users (with `is_admin`) — used to detect whether
  // the current user is the only admin of the platform.
  GET_PLATFORM_USERS: {
    service: SERVICES.DM,
    path: () => `/api/core/platform/users/`,
  },
};

export const TENANTS_QUERY_KEYS = {
  GET_USER_TENANTS: () => 'USER_TENANTS',
  GET_PLATFORM_METADATA: () => 'TENANT_METADATA',
  GET_USER_PLATFORM_METADATA: () => 'USER_PLATFORM_METADATA',
  GET_PLATFORM_USERS: () => 'PLATFORM_USERS',
};

export const TENANTS_REDUCER_KEY = 'tenantsApiSliceLocal';
