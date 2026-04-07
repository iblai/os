import { createApi } from '@reduxjs/toolkit/query/react';

import {
  USERS_ENDPOINTS,
  USERS_QUERY_KEYS,
  USERS_REDUCER_PATH,
} from '@/features/users/constants';
import { iblFetchBaseQuery } from '@/features/utils';
import { UserProfile, GetUserMetadataArgs } from '@/features/users/types';

export const userApiSlice = createApi({
  reducerPath: USERS_REDUCER_PATH,

  baseQuery: iblFetchBaseQuery,

  tagTypes: USERS_QUERY_KEYS.GET_USER_METADATA(),

  endpoints: (builder) => ({
    getUserMetadata: builder.query<UserProfile, GetUserMetadataArgs>({
      query: (args) => ({
        url: USERS_ENDPOINTS.GET_USER_METADATA.path(),
        service: USERS_ENDPOINTS.GET_USER_METADATA.service,
        params: args.params,
      }),
      providesTags: USERS_QUERY_KEYS.GET_USER_METADATA(),
    }),
  }),
});

export const { useGetUserMetadataQuery, useLazyGetUserMetadataQuery } =
  userApiSlice;
