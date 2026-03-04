import { SERVICES } from "@/features/constants";

export const TENANTS_ENDPOINTS = {
  GET_USER_TENANTS: {
    service: SERVICES.LMS,
    path: () => `/api/ibl/users/manage/platform/`,
  },
  GET_PLATFORM_METADATA: {
    service: SERVICES.AXD,
    path: (tenantKey: string) => `/api/core/orgs/${tenantKey}/metadata/`,
  },
};

export const TENANTS_QUERY_KEYS = {
  GET_USER_TENANTS: () => "USER_TENANTS",
  GET_PLATFORM_METADATA: () => "TENANT_METADATA",
};

export const TENANTS_REDUCER_KEY = "tenantsApiSliceLocal";
