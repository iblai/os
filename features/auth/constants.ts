import { SERVICES } from "@/features/constants";

export const AUTH_ENDPOINTS = {
  GET_INTEGRATED_SSO_PROVIDERS: {
    service: SERVICES.LMS,
    path: () => `/ibl-auth/get-provider-slug/`,
  },
};

export const AUTH_REDUCER_PATH = "authApiSliceLocal";
