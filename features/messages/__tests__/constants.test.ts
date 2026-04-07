import { describe, it, expect } from 'vitest';
import {
  MESSAGES_ENDPOINTS,
  MESSAGES_QUERY_KEYS,
  MESSAGES_REDUCER_KEY,
} from '../constants';
import { SERVICES } from '../../constants';

describe('messages/constants', () => {
  describe('MESSAGES_ENDPOINTS', () => {
    it('should have GET_RECENT_MESSAGES endpoint configuration', () => {
      expect(MESSAGES_ENDPOINTS.GET_RECENT_MESSAGES).toBeDefined();
      expect(MESSAGES_ENDPOINTS.GET_RECENT_MESSAGES.service).toBe(SERVICES.AXD);
    });

    it('should generate correct path for GET_RECENT_MESSAGES', () => {
      const tenantKey = 'test-tenant';
      const username = 'testuser';
      const path = MESSAGES_ENDPOINTS.GET_RECENT_MESSAGES.path(
        tenantKey,
        username,
      );

      expect(path).toBe(
        `/api/ai-mentor/orgs/${tenantKey}/users/${username}/recent-messages/`,
      );
    });
  });

  describe('MESSAGES_QUERY_KEYS', () => {
    it('should return correct query key for GET_RECENT_MESSAGES', () => {
      const queryKey = MESSAGES_QUERY_KEYS.GET_RECENT_MESSAGES();

      expect(queryKey).toEqual(['recent', 'messages']);
    });
  });

  describe('MESSAGES_REDUCER_KEY', () => {
    it('should have correct reducer key', () => {
      expect(MESSAGES_REDUCER_KEY).toBe('messagesApiSliceLocal');
    });
  });
});
