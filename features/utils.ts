import { fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
  FetchBaseQueryMeta,
} from '@reduxjs/toolkit/query';

import { config } from '@/lib/config';
import { SERVICES } from './constants';
import { LOCAL_STORAGE_KEYS } from '../lib/constants';
import { getAuthItem } from '@/lib/auth-storage';

export interface CustomQueryArgs extends Omit<FetchArgs, 'url'> {
  url: string;
  service: SERVICES;
}

export type ExtendedFetchBaseQueryError = FetchBaseQueryError & {
  data?: { detail?: string; message?: string } | string;
};

const isErrorObject = (
  data: unknown,
): data is { detail?: string; message?: string } => {
  return (
    typeof data === 'object' &&
    data !== null &&
    ('detail' in data || 'message' in data)
  );
};

export const getServiceUrl = (service: SERVICES) => {
  switch (service) {
    case SERVICES.LMS:
      return config.lmsUrl();
    case SERVICES.DM:
      return config.dmUrl();
    case SERVICES.AXD:
      return config.axdUrl();
    default:
      return config.dmUrl(); // Default to DM URL if no match
  }
};

/**
 * Endpoints that must go out WITHOUT credentials.
 *
 * `getIntegratedSsoProviders` asks the LMS which sign-in providers a tenant
 * has, which is public by nature — it is read to build a sign-in screen, so
 * the caller may well have no session yet. Sending `Authorization: JWT` means
 * sending whatever happens to be in storage: absent, expired or belonging to
 * someone else, any of which the LMS answers with a 401 rather than ignoring.
 *
 * Keyed by RTK Query's endpoint name, which `prepareHeaders` hands us.
 */
const UNAUTHENTICATED_ENDPOINTS = new Set(['getIntegratedSsoProviders']);

/**
 * The credentials an endpoint should go out with, if any.
 *
 * Split from `prepareHeaders` so the decision can be read and tested on its
 * own — driving it through the real base query means constructing a Request,
 * which is what the environment, not the rule, decides.
 */
export function getAuthHeaders(
  service: SERVICES,
  endpoint?: string,
): Record<string, string> {
  if (endpoint && UNAUTHENTICATED_ENDPOINTS.has(endpoint)) return {};
  return getHeaders(service);
}

function getHeaders(service: SERVICES) {
  switch (service) {
    case SERVICES.LMS:
      return {
        Authorization: `JWT ${getAuthItem(LOCAL_STORAGE_KEYS.EDX_TOKEN_KEY)}`,
      };
    case SERVICES.DM:
      return {
        Authorization: `Token ${getAuthItem(LOCAL_STORAGE_KEYS.DM_TOKEN_KEY)}`,
      };
    case SERVICES.AXD:
      return {
        Authorization: `Token ${getAuthItem(LOCAL_STORAGE_KEYS.AXD_TOKEN_KEY)}`,
      };
    default:
      return {
        Authorization: `Token ${getAuthItem(LOCAL_STORAGE_KEYS.DM_TOKEN_KEY)}`,
      };
  }
}

const baseQuery = (service: SERVICES) =>
  fetchBaseQuery({
    baseUrl: getServiceUrl(service),

    prepareHeaders: (headers, { endpoint }) => {
      // Remove this in favor of the isForm flag in the future
      headers.set('Content-Type', 'application/json');

      Object.entries(getAuthHeaders(service, endpoint)).forEach(
        ([key, value]) => {
          headers.set(key, value);
        },
      );

      return headers;
    },
  });

export const iblFetchBaseQuery: BaseQueryFn<
  CustomQueryArgs,
  unknown,
  ExtendedFetchBaseQueryError,
  Record<string, unknown>,
  FetchBaseQueryMeta
> = async (args, api, extraOptions) => {
  try {
    console.log('[iblFetchBaseQuery] Outgoing request:', args);
    const result = await baseQuery(args.service)(args, api, extraOptions);
    if (result.error) {
      const errorData = result.error.data;
      const errorMessage =
        typeof errorData === 'string'
          ? errorData
          : isErrorObject(errorData)
            ? errorData.detail || errorData.message || 'Unknown server error'
            : 'Unknown server error';

      console.error(
        JSON.stringify({
          context: 'iblFetchBaseQuery',
          url: args?.url,
          body: args?.body,
          params: args?.params,
          error: errorMessage,
        }),
      );
      throw new Error(errorMessage); // Let this error bubble up directly
    }
    console.log('[iblFetchBaseQuery] Response:', result.data);
    return { data: result?.data };
  } catch (e) {
    // Only catch unexpected errors that aren't from our explicit error handling above
    console.error(
      JSON.stringify({
        context: 'iblFetchBaseQuery',
        url: args?.url,
        body: args?.body,
        params: args?.params,
        error: e,
      }),
    );
    if (
      e instanceof Error &&
      e.message !== 'Unknown server error' &&
      !isErrorObject(e) &&
      typeof e !== 'string'
    ) {
      console.error('[iblFetchBaseQuery] Unexpected error:', e);
      throw new Error('something went wrong fetching data');
    }
    throw e; // Re-throw the original error
  }
};

export const getUserName = () => {
  if (
    typeof window === 'undefined' ||
    typeof localStorage?.getItem !== 'function'
  )
    return null;
  try {
    return JSON.parse(getAuthItem('userData')!)?.user_nicename;
  } catch {
    return null;
  }
};

export const getUserId = () => {
  if (
    typeof window === 'undefined' ||
    typeof localStorage?.getItem !== 'function'
  )
    return null;
  try {
    return JSON.parse(getAuthItem('userData')!)?.user_id;
  } catch {
    return null;
  }
};

export const getUserEmail = () => {
  if (
    typeof window === 'undefined' ||
    typeof localStorage?.getItem !== 'function'
  )
    return null;
  try {
    return JSON.parse(getAuthItem('userData')!)?.user_email;
  } catch {
    return null;
  }
};
