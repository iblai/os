import { describe, it, expect } from 'vitest';
import {
  PROVIDER_ASSOCIATION_ENDPOINTS,
  PROVIDER_ASSOCIATION_QUERY_KEYS,
  PROVIDER_ASSOCIATION_REDUCER_PATH,
} from '../constants';
import { SERVICES } from '../../constants';

describe('provider-association/constants', () => {
  describe('PROVIDER_ASSOCIATION_ENDPOINTS', () => {
    it('should have GET_STRIPE_CALLBACK_ASSOCIATION endpoint configuration', () => {
      expect(PROVIDER_ASSOCIATION_ENDPOINTS.GET_STRIPE_CALLBACK_ASSOCIATION).toBeDefined();
      expect(PROVIDER_ASSOCIATION_ENDPOINTS.GET_STRIPE_CALLBACK_ASSOCIATION.service).toBe(
        SERVICES.DM,
      );
    });

    it('should generate correct path for GET_STRIPE_CALLBACK_ASSOCIATION', () => {
      const launchId = 'launch-123';
      const path = PROVIDER_ASSOCIATION_ENDPOINTS.GET_STRIPE_CALLBACK_ASSOCIATION.path(launchId);

      expect(path).toBe(`/api/provider-association/stripe/callback/${launchId}`);
    });
  });

  describe('PROVIDER_ASSOCIATION_QUERY_KEYS', () => {
    it('should return correct query key for GET_STRIPE_CALLBACK_ASSOCIATION', () => {
      const queryKey = PROVIDER_ASSOCIATION_QUERY_KEYS.GET_STRIPE_CALLBACK_ASSOCIATION();

      expect(queryKey).toEqual(['GET_STRIPE_CALLBACK_ASSOCIATION']);
    });
  });

  describe('PROVIDER_ASSOCIATION_REDUCER_PATH', () => {
    it('should have correct reducer path', () => {
      expect(PROVIDER_ASSOCIATION_REDUCER_PATH).toBe('providerAssociationApiSlice');
    });
  });
});
