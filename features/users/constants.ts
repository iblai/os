import { SERVICES } from "@/features/constants";

export const USERS_ENDPOINTS = {
  GET_USER_METADATA: {
    service: SERVICES.LMS,
    path: () => `/api/ibl/users/manage/metadata/`,
  },
};

export const USERS_QUERY_KEYS = {
  GET_USER_METADATA: () => ["USER_METADATA"],
};

export const USERS_REDUCER_PATH = "userApiSliceLocal";
