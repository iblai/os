import { describe, it, expect } from 'vitest';
import { urlRoutes } from '../index';

describe('UrlRoutes', () => {
  describe('singleton pattern', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = urlRoutes;
      const instance2 = urlRoutes;

      expect(instance1).toBe(instance2);
    });

    it('should have platform property', () => {
      expect(urlRoutes.platform).toBeDefined();
    });
  });

  describe('platform routes', () => {
    describe('explore', () => {
      it('should return correct explore URL for a platform', () => {
        const result = urlRoutes.platform.explore('my-platform');
        expect(result).toBe('/platform/my-platform/explore');
      });

      it('should handle different platform names', () => {
        const platforms = ['main', 'test-tenant', 'production', 'demo'];

        platforms.forEach((platform) => {
          const result = urlRoutes.platform.explore(platform);
          expect(result).toBe(`/platform/${platform}/explore`);
        });
      });

      it('should handle platform with special characters', () => {
        const result = urlRoutes.platform.explore('my_platform-test');
        expect(result).toBe('/platform/my_platform-test/explore');
      });

      it('should handle empty string platform', () => {
        const result = urlRoutes.platform.explore('');
        expect(result).toBe('/platform//explore');
      });
    });

    describe('mentorListSettings', () => {
      it('should return correct URL with encoded modal parameters', () => {
        const result = urlRoutes.platform.mentorListSettings(
          'tenant-key',
          'mentor-id',
          'modal-mentor-id',
        );

        expect(result).toContain('/platform/tenant-key/mentor-id');
        expect(result).toContain('modal=');
      });

      it('should include settings modal in the URL', () => {
        const result = urlRoutes.platform.mentorListSettings(
          'test-tenant',
          'test-mentor',
          'settings-mentor',
        );

        expect(result).toContain('settings');
        expect(result).toContain('edit_mentor');
      });

      it('should include the mentorModal ID in the URL', () => {
        const mentorModal = 'specific-mentor-123';
        const result = urlRoutes.platform.mentorListSettings('tenant', 'mentor', mentorModal);

        expect(result).toContain(mentorModal);
      });

      it('should have properly encoded JSON in the modal parameter', () => {
        const result = urlRoutes.platform.mentorListSettings('tenant', 'mentor', 'modal-id');

        // The URL should contain URL-encoded characters
        expect(result).toContain('%5B'); // [
        expect(result).toContain('%5D'); // ]
        expect(result).toContain('%7B'); // {
        expect(result).toContain('%7D'); // }
        expect(result).toContain('%22'); // "
        expect(result).toContain('%3A'); // :
        expect(result).toContain('%2C'); // ,
      });

      it('should handle different tenant and mentor IDs', () => {
        const testCases = [
          { tenantKey: 'alpha', mentorId: 'mentor-1', mentorModal: 'modal-1' },
          { tenantKey: 'beta', mentorId: 'mentor-2', mentorModal: 'modal-2' },
          { tenantKey: 'gamma', mentorId: 'mentor-3', mentorModal: 'modal-3' },
        ];

        testCases.forEach(({ tenantKey, mentorId, mentorModal }) => {
          const result = urlRoutes.platform.mentorListSettings(tenantKey, mentorId, mentorModal);

          expect(result).toContain(`/platform/${tenantKey}/${mentorId}`);
          expect(result).toContain(mentorModal);
        });
      });

      it('should generate valid URL format', () => {
        const result = urlRoutes.platform.mentorListSettings('test', 'mentor', 'modal');

        // Should start with /platform/
        expect(result.startsWith('/platform/')).toBe(true);

        // Should contain query parameter
        expect(result).toContain('?modal=');
      });

      it('should handle UUID-like IDs', () => {
        const uuid = '550e8400-e29b-41d4-a716-446655440000';
        const result = urlRoutes.platform.mentorListSettings(uuid, uuid, uuid);

        expect(result).toContain(uuid);
      });
    });
  });

  describe('platform object structure', () => {
    it('should have explore function', () => {
      expect(typeof urlRoutes.platform.explore).toBe('function');
    });

    it('should have mentorListSettings function', () => {
      expect(typeof urlRoutes.platform.mentorListSettings).toBe('function');
    });
  });
});
