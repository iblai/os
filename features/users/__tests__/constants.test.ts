import { describe, it, expect } from 'vitest';
import { USERS_ENDPOINTS, USERS_QUERY_KEYS, USERS_REDUCER_PATH } from '../constants';
import { SERVICES } from '../../constants';

describe('users/constants', () => {
  describe('USERS_ENDPOINTS', () => {
    it('should have GET_USER_METADATA endpoint configuration', () => {
      expect(USERS_ENDPOINTS.GET_USER_METADATA).toBeDefined();
      expect(USERS_ENDPOINTS.GET_USER_METADATA.service).toBe(SERVICES.LMS);
    });

    it('should generate correct path for GET_USER_METADATA', () => {
      const path = USERS_ENDPOINTS.GET_USER_METADATA.path();

      expect(path).toBe('/api/ibl/users/manage/metadata/');
    });
  });

  describe('USERS_QUERY_KEYS', () => {
    it('should return correct query key for GET_USER_METADATA', () => {
      const queryKey = USERS_QUERY_KEYS.GET_USER_METADATA();

      expect(queryKey).toEqual(['USER_METADATA']);
    });
  });

  describe('USERS_REDUCER_PATH', () => {
    it('should have correct reducer path', () => {
      expect(USERS_REDUCER_PATH).toBe('userApiSliceLocal');
    });
  });
});
