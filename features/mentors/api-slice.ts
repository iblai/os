import { createApi } from "@reduxjs/toolkit/query/react";

import type {
  MentorsFetchResponse,
  GetMentorsArgs,
  SeedMentorsResponse,
  SeedMentorsArgs,
  Mentor,
  GetMentorArgs,
  CreateMentorWithSettingsArgs,
} from "@/features/mentors/types";
import {
  MENTORS_ENDPOINTS,
  MENTORS_QUERY_KEYS,
  MENTORS_REDUCER_PATH,
} from "@/features/mentors/constants";
import { iblFetchBaseQuery } from "@/features/utils";

export const mentorsApiSlice = createApi({
  reducerPath: MENTORS_REDUCER_PATH,

  baseQuery: iblFetchBaseQuery,

  tagTypes: MENTORS_QUERY_KEYS.GET_MENTORS(),

  endpoints: (builder) => ({
    getMentor: builder.query<Mentor, GetMentorArgs>({
      query: (args) => ({
        url: MENTORS_ENDPOINTS.GET_MENTOR.path(
          args.tenantKey,
          args.username,
          args.mentorId,
        ),
        service: MENTORS_ENDPOINTS.GET_MENTOR.service,
      }),
    }),

    getMentors: builder.query<MentorsFetchResponse, GetMentorsArgs>({
      query: (args) => {
        console.log('[mentorsApiSlice.getMentors] Query args:', args);
        return {
          url: MENTORS_ENDPOINTS.GET_MENTORS.path(args.tenantKey, args.username),
          params: args.params,
          service: MENTORS_ENDPOINTS.GET_MENTORS.service,
        };
      },
      providesTags: MENTORS_QUERY_KEYS.GET_MENTORS(),
    }),

    getInfiniteMentors: builder.query<MentorsFetchResponse, GetMentorsArgs>({
      query: (queryArg) => ({
        url: MENTORS_ENDPOINTS.GET_MENTORS.path(
          queryArg.tenantKey,
          queryArg.username,
        ),
        params: queryArg.params,
        service: MENTORS_ENDPOINTS.GET_MENTORS.service,
      }),
      // Create separate cache entries based on everything except pagination
      serializeQueryArgs: ({ queryArgs }) => {
        const { params, ...baseArgs } = queryArgs;

        // Clone params and remove pagination-related fields
        const { offset, limit, ...filterParams } = params || {};

        // Create a stable cache key using the non-pagination parameters
        return `InfiniteMentors-${JSON.stringify(baseArgs)}-${JSON.stringify(filterParams)}`;
      },
      // Merge function to combine results
      merge: (currentCache, newItems) => {
        currentCache.results.push(...newItems.results);
      },
      // Only refetch if the offset has changed
      forceRefetch({ currentArg, previousArg }) {
        if (!previousArg || !currentArg) return false;

        const currentOffset = currentArg.params?.offset;
        const previousOffset = previousArg.params?.offset;

        // Trigger refetch if offset has changed
        return currentOffset !== previousOffset;
      },
    }),

    createMentorWithSettings: builder.mutation<
      Mentor,
      CreateMentorWithSettingsArgs
    >({
      query: (args) => ({
        url: MENTORS_ENDPOINTS.CREATE_MENTOR_WITH_SETTINGS.path(
          args.tenantKey,
          args.username,
        ),
        service: MENTORS_ENDPOINTS.CREATE_MENTOR_WITH_SETTINGS.service,
      }),
    }),

    seedMentors: builder.query<SeedMentorsResponse, SeedMentorsArgs>({
      query: (args) => ({
        url: MENTORS_ENDPOINTS.SEED_MENTORS.path(args.tenantKey, args.username),
        service: MENTORS_ENDPOINTS.SEED_MENTORS.service,
      }),
    }),
  }),
});

export const {
  useGetMentorsQuery,
  useLazyGetMentorsQuery,
  useGetInfiniteMentorsQuery,
  useSeedMentorsQuery,
  useLazySeedMentorsQuery,
  useGetMentorQuery,
  useLazyGetMentorQuery,
  useCreateMentorWithSettingsMutation,
} = mentorsApiSlice;
