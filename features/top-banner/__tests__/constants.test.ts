import { describe, it, expect } from 'vitest';
import { TRIGGERS } from '../constants';

describe('top-banner/constants', () => {
  describe('TRIGGERS', () => {
    it('should have PRICING_MODAL trigger', () => {
      expect(TRIGGERS.PRICING_MODAL).toBe('TRIGGER_PRICING_MODAL');
    });

    it('should have SUBSCRIBE_USER trigger', () => {
      expect(TRIGGERS.SUBSCRIBE_USER).toBe('TRIGGER_SUBSCRIBE_USER');
    });

    it('should have exactly 2 triggers defined', () => {
      expect(Object.keys(TRIGGERS)).toHaveLength(2);
    });
  });
});
