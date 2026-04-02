import { createApi } from '@reduxjs/toolkit/query/react';

import { AUTH_ENDPOINTS, AUTH_REDUCER_PATH } from '@/features/auth/constants';
import { iblFetchBaseQuery } from '@/features/utils';
import { IntegratedProviderRequest, IntegratedProviderResponse } from './types';

export const authApiSlice = createApi({
  reducerPath: AUTH_REDUCER_PATH,

  baseQuery: iblFetchBaseQuery,

  endpoints: (builder) => ({
    getIntegratedSsoProviders: builder.query<
      IntegratedProviderResponse,
      IntegratedProviderRequest
    >({
      query: (args) => ({
        url: AUTH_ENDPOINTS.GET_INTEGRATED_SSO_PROVIDERS.path(),
        service: AUTH_ENDPOINTS.GET_INTEGRATED_SSO_PROVIDERS.service,
        params: { ...args },
      }),
    }),
  }),
});

export const { useGetIntegratedSsoProvidersQuery } = authApiSlice;
