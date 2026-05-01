import { describe, it, expect } from 'vitest';
import { customErrorMessages, extractErrorMessage, ApiError } from '../error';

describe('lib/error', () => {
  describe('customErrorMessages', () => {
    it('should have mentorNotFound error message', () => {
      expect(customErrorMessages.mentorNotFound).toEqual({
        key: 'mentorNotFound',
        header: 'Agent Not Found',
        message:
          'The agent you are looking for does not exist. Please contact our support team if you believe this is an error.',
      });
    });

    it('should have sessionNotFound error message', () => {
      expect(customErrorMessages.sessionNotFound).toEqual({
        key: 'sessionNotFound',
        header: 'Session not found',
        message:
          'The session you are looking for does not exist. Please contact our support team if you believe this is an error.',
      });
    });

    it('should have exactly 2 custom error messages', () => {
      expect(Object.keys(customErrorMessages)).toHaveLength(2);
    });
  });

  describe('extractErrorMessage', () => {
    it('should extract error from data.error', () => {
      const error: ApiError = {
        status: 400,
        data: {
          error: 'Data error message',
        },
      };

      const result = extractErrorMessage(error, 'fallback');

      expect(result).toBe('Data error message');
    });

    it('should extract error from error.error', () => {
      const error: ApiError = {
        status: 500,
        error: {
          error: 'Error object message',
        },
      };

      const result = extractErrorMessage(error, 'fallback');

      expect(result).toBe('Error object message');
    });

    it('should return fallback when no error found', () => {
      const error: ApiError = {
        status: 404,
      };

      const result = extractErrorMessage(error, 'fallback message');

      expect(result).toBe('fallback message');
    });

    it('should prioritize data.error over error.error', () => {
      const error: ApiError = {
        status: 400,
        data: {
          error: 'Data error',
        },
        error: {
          error: 'Error object error',
        },
      };

      const result = extractErrorMessage(error, 'fallback');

      expect(result).toBe('Data error');
    });

    it('should handle unknown error types', () => {
      const error = 'string error';

      const result = extractErrorMessage(error, 'fallback');

      expect(result).toBe('fallback');
    });

    it('should handle null error', () => {
      const error = null;

      const result = extractErrorMessage(error, 'fallback');

      expect(result).toBe('fallback');
    });

    it('should handle undefined error', () => {
      const error = undefined;

      const result = extractErrorMessage(error, 'fallback');

      expect(result).toBe('fallback');
    });
  });
});
