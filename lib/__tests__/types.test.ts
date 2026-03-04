import { describe, it, expect } from 'vitest';
import { userDataSchema, tenantSchema, tenantKeySchema } from '../types';

describe('mentor types', () => {
  describe('userDataSchema', () => {
    it('should validate valid user data', () => {
      const validData = {
        user_display_name: 'john_doe',
        user_email: 'john@example.com',
        user_fullname: 'John Doe',
        user_id: 123,
        user_nicename: 'johndoe',
      };

      const result = userDataSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validData);
      }
    });

    it('should reject invalid email', () => {
      const invalidData = {
        user_display_name: 'john_doe',
        user_email: 'invalid-email',
        user_fullname: 'John Doe',
        user_id: 123,
        user_nicename: 'johndoe',
      };

      const result = userDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject missing fields', () => {
      const incompleteData = {
        user_display_name: 'john_doe',
        user_email: 'john@example.com',
      };

      const result = userDataSchema.safeParse(incompleteData);
      expect(result.success).toBe(false);
    });

    it('should reject non-number user_id', () => {
      const invalidData = {
        user_display_name: 'john_doe',
        user_email: 'john@example.com',
        user_fullname: 'John Doe',
        user_id: '123',
        user_nicename: 'johndoe',
      };

      const result = userDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('tenantSchema', () => {
    it('should validate valid tenant data', () => {
      const validData = {
        key: 'tenant-key-123',
        is_admin: true,
        org: 'My Organization',
      };

      const result = tenantSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validData);
      }
    });

    it('should accept non-admin tenant', () => {
      const validData = {
        key: 'tenant-key-123',
        is_admin: false,
        org: 'My Organization',
      };

      const result = tenantSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject missing fields', () => {
      const incompleteData = {
        key: 'tenant-key-123',
        is_admin: true,
      };

      const result = tenantSchema.safeParse(incompleteData);
      expect(result.success).toBe(false);
    });

    it('should reject non-boolean is_admin', () => {
      const invalidData = {
        key: 'tenant-key-123',
        is_admin: 'true',
        org: 'My Organization',
      };

      const result = tenantSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('tenantKeySchema', () => {
    it('should validate non-empty string', () => {
      const result = tenantKeySchema.safeParse('tenant-123');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('tenant-123');
      }
    });

    it('should reject empty string', () => {
      const result = tenantKeySchema.safeParse('');
      expect(result.success).toBe(false);
    });

    it('should reject non-string values', () => {
      expect(tenantKeySchema.safeParse(123).success).toBe(false);
      expect(tenantKeySchema.safeParse(null).success).toBe(false);
      expect(tenantKeySchema.safeParse(undefined).success).toBe(false);
      expect(tenantKeySchema.safeParse({}).success).toBe(false);
    });

    it('should accept long tenant keys', () => {
      const longKey = 'a'.repeat(100);
      const result = tenantKeySchema.safeParse(longKey);
      expect(result.success).toBe(true);
    });
  });
});
