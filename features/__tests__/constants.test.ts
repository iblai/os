import { describe, it, expect } from 'vitest';
import { SERVICES } from '../constants';

describe('features constants', () => {
  describe('SERVICES', () => {
    it('should have LMS service', () => {
      expect(SERVICES.LMS).toBe('LMS');
    });

    it('should have AXD service', () => {
      expect(SERVICES.AXD).toBe('AXD');
    });

    it('should have DM service', () => {
      expect(SERVICES.DM).toBe('DM');
    });
  });
});
