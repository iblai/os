import { SERVICES } from "@/features/constants";

export const MENTORS_ENDPOINTS = {
  GET_MENTORS: {
    service: SERVICES.AXD,
    path: (tenantKey: string, username: string) =>
      `/api/search/orgs/${tenantKey}/users/${username}/mentors/`,
  },
  SEED_MENTORS: {
    service: SERVICES.AXD,
    path: (tenantKey: string, username: string) =>
      `/api/ai-mentor/orgs/${tenantKey}/users/${username}/mentor/seed/`,
  },
  GET_MENTOR: {
    service: SERVICES.AXD,
    path: (tenantKey: string, username: string, mentorId: string) =>
      `/api/ai-mentor/orgs/${tenantKey}/users/${username}/mentors/${mentorId}/`,
  },
  CREATE_MENTOR_WITH_SETTINGS: {
    service: SERVICES.AXD,
    path: (tenantKey: string, username: string) =>
      `/api/ai-mentor/orgs/${tenantKey}/users/${username}/mentor-with-settings/`,
  },
  UPDATE_MENTOR: {
    service: SERVICES.AXD,
    path: (tenantKey: string, username: string, mentorId: string) =>
      `/api/ai-mentor/orgs/${tenantKey}/users/${username}/mentors/${mentorId}/`,
  },
};

export const MENTORS_QUERY_KEYS = {
  GET_MENTORS: () => ["MENTORS"],
  GET_MENTOR: () => ["MENTOR"],
  CREATE_MENTOR_WITH_SETTINGS: () => ["CREATE_MENTOR_WITH_SETTINGS"],
  UPDATE_MENTOR: () => ["UPDATE_MENTOR"],
};

export const MENTORS_REDUCER_PATH = "mentorsApiSliceLocal";
