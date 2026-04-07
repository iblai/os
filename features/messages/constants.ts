import { SERVICES } from '../constants';

export const MESSAGES_ENDPOINTS = {
  GET_RECENT_MESSAGES: {
    service: SERVICES.AXD,
    path: (tenantKey: string, username: string) =>
      `/api/ai-mentor/orgs/${tenantKey}/users/${username}/recent-messages/`,
  },
};

export const MESSAGES_QUERY_KEYS = {
  GET_RECENT_MESSAGES: () => ['recent', 'messages'],
};

export const MESSAGES_REDUCER_KEY = 'messagesApiSliceLocal';
