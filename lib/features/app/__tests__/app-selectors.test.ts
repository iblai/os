import { describe, it, expect } from 'vitest';
import { selectSessionId } from '../app-selectors';
import type { RootState } from '@/store';

describe('app selectors', () => {
  describe('selectSessionId', () => {
    it('should return the sessionId from state', () => {
      const mockState = {
        app: {
          sessionId: 'test-session-123',
        },
      } as RootState;

      const result = selectSessionId(mockState);

      expect(result).toBe('test-session-123');
    });

    it('should return empty string when sessionId is empty', () => {
      const mockState = {
        app: {
          sessionId: '',
        },
      } as RootState;

      const result = selectSessionId(mockState);

      expect(result).toBe('');
    });

    it('should return UUID session ID', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const mockState = {
        app: {
          sessionId: uuid,
        },
      } as RootState;

      const result = selectSessionId(mockState);

      expect(result).toBe(uuid);
    });

    it('should handle long session IDs', () => {
      const longSessionId =
        'very-long-session-id-that-might-be-generated-by-some-systems-123456789';
      const mockState = {
        app: {
          sessionId: longSessionId,
        },
      } as RootState;

      const result = selectSessionId(mockState);

      expect(result).toBe(longSessionId);
    });

    it('should return the correct type', () => {
      const mockState = {
        app: {
          sessionId: 'typed-session',
        },
      } as RootState;

      const result = selectSessionId(mockState);

      expect(typeof result).toBe('string');
    });
  });
});
