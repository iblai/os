import { describe, it, expect } from 'vitest';
import {
  MENTORS_ENDPOINTS,
  MENTORS_QUERY_KEYS,
  MENTORS_REDUCER_PATH,
} from '../constants';
import { SERVICES } from '../../constants';

describe('mentors/constants', () => {
  describe('MENTORS_ENDPOINTS', () => {
    it('should have GET_MENTORS endpoint configuration', () => {
      expect(MENTORS_ENDPOINTS.GET_MENTORS).toBeDefined();
      expect(MENTORS_ENDPOINTS.GET_MENTORS.service).toBe(SERVICES.AXD);
    });

    it('should generate correct path for GET_MENTORS', () => {
      const tenantKey = 'test-tenant';
      const username = 'testuser';
      const path = MENTORS_ENDPOINTS.GET_MENTORS.path(tenantKey, username);

      expect(path).toBe(
        `/api/search/orgs/${tenantKey}/users/${username}/mentors/`,
      );
    });

    it('should have SEED_MENTORS endpoint configuration', () => {
      expect(MENTORS_ENDPOINTS.SEED_MENTORS).toBeDefined();
      expect(MENTORS_ENDPOINTS.SEED_MENTORS.service).toBe(SERVICES.AXD);
    });

    it('should generate correct path for SEED_MENTORS', () => {
      const tenantKey = 'test-tenant';
      const username = 'testuser';
      const path = MENTORS_ENDPOINTS.SEED_MENTORS.path(tenantKey, username);

      expect(path).toBe(
        `/api/ai-mentor/orgs/${tenantKey}/users/${username}/mentor/seed/`,
      );
    });

    it('should have GET_MENTOR endpoint configuration', () => {
      expect(MENTORS_ENDPOINTS.GET_MENTOR).toBeDefined();
      expect(MENTORS_ENDPOINTS.GET_MENTOR.service).toBe(SERVICES.AXD);
    });

    it('should generate correct path for GET_MENTOR', () => {
      const tenantKey = 'test-tenant';
      const username = 'testuser';
      const mentorId = 'mentor-123';
      const path = MENTORS_ENDPOINTS.GET_MENTOR.path(
        tenantKey,
        username,
        mentorId,
      );

      expect(path).toBe(
        `/api/ai-mentor/orgs/${tenantKey}/users/${username}/mentors/${mentorId}/`,
      );
    });

    it('should have CREATE_MENTOR_WITH_SETTINGS endpoint configuration', () => {
      expect(MENTORS_ENDPOINTS.CREATE_MENTOR_WITH_SETTINGS).toBeDefined();
      expect(MENTORS_ENDPOINTS.CREATE_MENTOR_WITH_SETTINGS.service).toBe(
        SERVICES.AXD,
      );
    });

    it('should generate correct path for CREATE_MENTOR_WITH_SETTINGS', () => {
      const tenantKey = 'test-tenant';
      const username = 'testuser';
      const path = MENTORS_ENDPOINTS.CREATE_MENTOR_WITH_SETTINGS.path(
        tenantKey,
        username,
      );

      expect(path).toBe(
        `/api/ai-mentor/orgs/${tenantKey}/users/${username}/mentor-with-settings/`,
      );
    });

    it('should have UPDATE_MENTOR endpoint configuration', () => {
      expect(MENTORS_ENDPOINTS.UPDATE_MENTOR).toBeDefined();
      expect(MENTORS_ENDPOINTS.UPDATE_MENTOR.service).toBe(SERVICES.AXD);
    });

    it('should generate correct path for UPDATE_MENTOR', () => {
      const tenantKey = 'test-tenant';
      const username = 'testuser';
      const mentorId = 'mentor-123';
      const path = MENTORS_ENDPOINTS.UPDATE_MENTOR.path(
        tenantKey,
        username,
        mentorId,
      );

      expect(path).toBe(
        `/api/ai-mentor/orgs/${tenantKey}/users/${username}/mentors/${mentorId}/`,
      );
    });
  });

  describe('MENTORS_QUERY_KEYS', () => {
    it('should return correct query key for GET_MENTORS', () => {
      const queryKey = MENTORS_QUERY_KEYS.GET_MENTORS();

      expect(queryKey).toEqual(['MENTORS']);
    });

    it('should return correct query key for GET_MENTOR', () => {
      const queryKey = MENTORS_QUERY_KEYS.GET_MENTOR();

      expect(queryKey).toEqual(['MENTOR']);
    });

    it('should return correct query key for CREATE_MENTOR_WITH_SETTINGS', () => {
      const queryKey = MENTORS_QUERY_KEYS.CREATE_MENTOR_WITH_SETTINGS();

      expect(queryKey).toEqual(['CREATE_MENTOR_WITH_SETTINGS']);
    });

    it('should return correct query key for UPDATE_MENTOR', () => {
      const queryKey = MENTORS_QUERY_KEYS.UPDATE_MENTOR();

      expect(queryKey).toEqual(['UPDATE_MENTOR']);
    });
  });

  describe('MENTORS_REDUCER_PATH', () => {
    it('should have correct reducer path', () => {
      expect(MENTORS_REDUCER_PATH).toBe('mentorsApiSliceLocal');
    });
  });
});
