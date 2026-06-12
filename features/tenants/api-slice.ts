import { createApi } from '@reduxjs/toolkit/query/react';

import type {
  GetPlatformUsersArgs,
  GetTenantMetadataArgs,
  GetUserPlatformMetadataArgs,
  PlatformUsersResponse,
  Tenant,
  TenantMetadata,
  UpdateUserPlatformMetadataArgs,
  UserPlatformMetadata,
} from '@/features/tenants/types';
import {
  TENANTS_ENDPOINTS,
  TENANTS_QUERY_KEYS,
  TENANTS_REDUCER_KEY,
} from '@/features/tenants/constants';
import { iblFetchBaseQuery } from '@/features/utils';

export const tenantsApiSlice = createApi({
  reducerPath: TENANTS_REDUCER_KEY,

  baseQuery: iblFetchBaseQuery,

  tagTypes: [
    TENANTS_QUERY_KEYS.GET_USER_TENANTS(),
    TENANTS_QUERY_KEYS.GET_PLATFORM_METADATA(),
    TENANTS_QUERY_KEYS.GET_USER_PLATFORM_METADATA(),
    TENANTS_QUERY_KEYS.GET_PLATFORM_USERS(),
  ],

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
    // Current admin's per-platform metadata. Empty metadata gates first-run onboarding.
    getUserPlatformMetadata: builder.query<
      UserPlatformMetadata,
      GetUserPlatformMetadataArgs
    >({
      query: (args) => ({
        url: TENANTS_ENDPOINTS.GET_USER_PLATFORM_METADATA.path(),
        service: TENANTS_ENDPOINTS.GET_USER_PLATFORM_METADATA.service,
        params: { platform_key: args.tenantKey },
      }),
      providesTags: (_result, _error, arg) => [
        {
          type: TENANTS_QUERY_KEYS.GET_USER_PLATFORM_METADATA(),
          id: arg.tenantKey,
        },
      ],
    }),
    // Merge keys into the current admin's per-platform metadata (PATCH). Used to
    // persist onboarding answers + mark complete WITHOUT clobbering any other
    // metadata keys (important now that existing admins can re-run onboarding).
    updateUserPlatformMetadata: builder.mutation<
      UserPlatformMetadata,
      UpdateUserPlatformMetadataArgs
    >({
      query: (args) => ({
        url: TENANTS_ENDPOINTS.UPDATE_USER_PLATFORM_METADATA.path(),
        service: TENANTS_ENDPOINTS.UPDATE_USER_PLATFORM_METADATA.service,
        method: 'PATCH',
        params: { platform_key: args.tenantKey },
        body: { metadata: args.metadata },
      }),
      invalidatesTags: (_result, _error, arg) => [
        {
          type: TENANTS_QUERY_KEYS.GET_USER_PLATFORM_METADATA(),
          id: arg.tenantKey,
        },
      ],
    }),
    // Platform users (paginated) — used to count admins.
    getPlatformUsers: builder.query<
      PlatformUsersResponse,
      GetPlatformUsersArgs
    >({
      query: (args) => ({
        url: TENANTS_ENDPOINTS.GET_PLATFORM_USERS.path(),
        service: TENANTS_ENDPOINTS.GET_PLATFORM_USERS.service,
        params: {
          platform_key: args.tenantKey,
          page_size: args.pageSize ?? 100,
        },
      }),
      providesTags: () => [TENANTS_QUERY_KEYS.GET_PLATFORM_USERS()],
    }),
  }),
});

export const {
  useGetUserTenantsQuery,
  useGetTenantMetadataQuery,
  useLazyGetUserTenantsQuery,
  useLazyGetTenantMetadataQuery,
  useGetUserPlatformMetadataQuery,
  useUpdateUserPlatformMetadataMutation,
  useGetPlatformUsersQuery,
} = tenantsApiSlice;
