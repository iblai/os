import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleError } from '../error';

describe('actions/error', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('handleError', () => {
    it('should log error with tenant key', async () => {
      const error = new Error('Test error');
      await handleError(error, 'test-tenant');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('test-tenant'));
    });

    it('should log error without tenant key', async () => {
      const error = new Error('Test error');
      await handleError(error);

      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle string errors', async () => {
      await handleError('String error', 'tenant');

      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle object errors', async () => {
      const error = { message: 'Object error', code: 500 };
      await handleError(error, 'tenant');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Object error'));
    });

    it('should handle null error', async () => {
      await handleError(null, 'tenant');

      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle undefined error', async () => {
      await handleError(undefined, 'tenant');

      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should return a resolved promise', async () => {
      const result = handleError(new Error('Test'), 'tenant');

      await expect(result).resolves.toBeUndefined();
    });
  });
});
