import { describe, it, expect } from 'vitest';
import { SUBSCRIPTION_TRIGGERS, SUBSCRIPTION_USER_CAPABILITIES } from '../constants';

describe('subscription/constants', () => {
  describe('SUBSCRIPTION_TRIGGERS', () => {
    it('should have PRICING_MODAL trigger', () => {
      expect(SUBSCRIPTION_TRIGGERS.PRICING_MODAL).toBe('TRIGGER_PRICING_MODAL');
    });

    it('should have SUBSCRIBE_USER trigger', () => {
      expect(SUBSCRIPTION_TRIGGERS.SUBSCRIBE_USER).toBe('TRIGGER_SUBSCRIBE_USER');
    });

    it('should have exactly 2 triggers defined', () => {
      expect(Object.keys(SUBSCRIPTION_TRIGGERS)).toHaveLength(2);
    });
  });

  describe('SUBSCRIPTION_USER_CAPABILITIES', () => {
    it('should have FREE_TRIAL capability', () => {
      expect(SUBSCRIPTION_USER_CAPABILITIES.FREE_TRIAL).toBe('FREE_TRIAL');
    });

    it('should have FREE_PACKAGE capability', () => {
      expect(SUBSCRIPTION_USER_CAPABILITIES.FREE_PACKAGE).toBe('FREE_PACKAGE');
    });

    it('should have STUDENT_UNDER_PAID_PACKAGE capability', () => {
      expect(SUBSCRIPTION_USER_CAPABILITIES.STUDENT_UNDER_PAID_PACKAGE).toBe(
        'STUDENT_UNDER_PAID_PACKAGE',
      );
    });

    it('should have PAID_PACKAGE capability', () => {
      expect(SUBSCRIPTION_USER_CAPABILITIES.PAID_PACKAGE).toBe('PAID_PACKAGE');
    });

    it('should have PRO_PACKAGE capability', () => {
      expect(SUBSCRIPTION_USER_CAPABILITIES.PRO_PACKAGE).toBe('PRO_PACKAGE');
    });

    it('should have STARTER_PACKAGE capability', () => {
      expect(SUBSCRIPTION_USER_CAPABILITIES.STARTER_PACKAGE).toBe('STARTER_PACKAGE');
    });

    it('should have exactly 6 capabilities defined', () => {
      expect(Object.keys(SUBSCRIPTION_USER_CAPABILITIES)).toHaveLength(6);
    });
  });
});
