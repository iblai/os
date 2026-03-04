import { describe, it, expect } from 'vitest';
import { appVersion } from '../version';

describe('lib/version', () => {
  describe('appVersion', () => {
    it('should be defined', () => {
      expect(appVersion).toBeDefined();
    });

    it('should be a string', () => {
      expect(typeof appVersion).toBe('string');
    });

    it('should match semantic versioning pattern', () => {
      // Semantic versioning pattern: X.Y.Z or X.Y.Z-prerelease
      // Prerelease identifiers can contain alphanumerics, hyphens, and dots
      const semverPattern = /^\d+\.\d+\.\d+(-[\w.-]+)?$/;
      expect(appVersion).toMatch(semverPattern);
    });

    it('should not be empty', () => {
      expect(appVersion.length).toBeGreaterThan(0);
    });
  });
});
