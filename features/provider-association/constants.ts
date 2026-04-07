import { SERVICES } from '@/features/constants';

export const PROVIDER_ASSOCIATION_ENDPOINTS = {
  GET_STRIPE_CALLBACK_ASSOCIATION: {
    service: SERVICES.DM,
    path: (launch_id: string) =>
      `/api/provider-association/stripe/callback/${launch_id}`,
  },
};

export const PROVIDER_ASSOCIATION_QUERY_KEYS = {
  GET_STRIPE_CALLBACK_ASSOCIATION: () => ['GET_STRIPE_CALLBACK_ASSOCIATION'],
};

export const PROVIDER_ASSOCIATION_REDUCER_PATH = 'providerAssociationApiSlice';
