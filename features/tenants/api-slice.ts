import { createApi } from '@reduxjs/toolkit/query/react';

import type { GetTenantMetadataArgs, Tenant, TenantMetadata } from '@/features/tenants/types';
import {
  TENANTS_ENDPOINTS,
  TENANTS_QUERY_KEYS,
  TENANTS_REDUCER_KEY,
} from '@/features/tenants/constants';
import { iblFetchBaseQuery } from '@/features/utils';

export const tenantsApiSlice = createApi({
  reducerPath: TENANTS_REDUCER_KEY,

  baseQuery: iblFetchBaseQuery,

  tagTypes: [TENANTS_QUERY_KEYS.GET_USER_TENANTS(), TENANTS_QUERY_KEYS.GET_PLATFORM_METADATA()],

  endpoints: (builder) => ({
    getUserTenants: builder.query<Tenant[], void>({
      query: () => ({
        url: TENANTS_ENDPOINTS.GET_USER_TENANTS.path(),
        service: TENANTS_ENDPOINTS.GET_USER_TENANTS.service,
      }),
      providesTags: () => [TENANTS_QUERY_KEYS.GET_USER_TENANTS()],
    }),
    getTenantMetadata: builder.query<TenantMetadata, GetTenantMetadataArgs>({
      query: (args) => ({
        url: TENANTS_ENDPOINTS.GET_PLATFORM_METADATA.path(args.tenantKey),
        service: TENANTS_ENDPOINTS.GET_PLATFORM_METADATA.service,
      }),
      providesTags: (arg) => [
        {
          type: TENANTS_QUERY_KEYS.GET_PLATFORM_METADATA(),
          // @ts-expect-error tenantKey is not part of the arg object
          id: arg?.tenantKey,
        },
      ],
    }),
  }),
});

export const {
  useGetUserTenantsQuery,
  useGetTenantMetadataQuery,
  useLazyGetUserTenantsQuery,
  useLazyGetTenantMetadataQuery,
} = tenantsApiSlice;
