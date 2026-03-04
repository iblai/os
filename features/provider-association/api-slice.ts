import { createApi } from "@reduxjs/toolkit/query/react";


import {
  PROVIDER_ASSOCIATION_ENDPOINTS,
  PROVIDER_ASSOCIATION_QUERY_KEYS,
  PROVIDER_ASSOCIATION_REDUCER_PATH,
} from "@/features/provider-association/constants";
import { iblFetchBaseQuery } from "@/features/utils";
import { GetStripeCallbackAssociationArgs, StripeCallbackAssociationResponse } from "./types";

export const providerAssociationApiSlice = createApi({
  reducerPath: PROVIDER_ASSOCIATION_REDUCER_PATH,

  baseQuery: iblFetchBaseQuery,

  tagTypes: PROVIDER_ASSOCIATION_QUERY_KEYS.GET_STRIPE_CALLBACK_ASSOCIATION(),

  endpoints: (builder) => ({
    getStripeCallbackAssociation: builder.query<StripeCallbackAssociationResponse, GetStripeCallbackAssociationArgs>({
      query: (args) => ({
        url: PROVIDER_ASSOCIATION_ENDPOINTS.GET_STRIPE_CALLBACK_ASSOCIATION.path(
          args.launch_id,
        ),
        params: args.params,
        service: PROVIDER_ASSOCIATION_ENDPOINTS.GET_STRIPE_CALLBACK_ASSOCIATION.service,
      }),
    }),
  }),
});

export const {
  useGetStripeCallbackAssociationQuery,
  useLazyGetStripeCallbackAssociationQuery,
} = providerAssociationApiSlice;
