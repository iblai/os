import { createApi } from '@reduxjs/toolkit/query/react';

import { iblFetchBaseQuery } from '../utils';
import {
  MESSAGES_ENDPOINTS,
  MESSAGES_QUERY_KEYS,
  MESSAGES_REDUCER_KEY,
} from './constants';
import { GetRecentMessagesArgs, GetRecentMessagesResponse } from './types';

export const messagesApiSlice = createApi({
  reducerPath: MESSAGES_REDUCER_KEY,

  baseQuery: iblFetchBaseQuery,

  tagTypes: MESSAGES_QUERY_KEYS.GET_RECENT_MESSAGES(),

  endpoints: (builder) => ({
    getRecentMessages: builder.query<
      GetRecentMessagesResponse,
      GetRecentMessagesArgs
    >({
      query: (args) => ({
        url: MESSAGES_ENDPOINTS.GET_RECENT_MESSAGES.path(
          args.tenantKey,
          args.username,
        ),
        service: MESSAGES_ENDPOINTS.GET_RECENT_MESSAGES.service,
      }),
    }),
  }),
});

export const { useGetRecentMessagesQuery, useLazyGetRecentMessagesQuery } =
  messagesApiSlice;
