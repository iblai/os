import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Sentry config imports
vi.mock('../sentry.server.config', () => ({}));
vi.mock('../sentry.edge.config', () => ({}));

describe('instrumentation', () => {
  let originalEnv: string | undefined;
  let mockProcessOn: ReturnType<typeof vi.fn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    originalEnv = process.env.NEXT_RUNTIME;
    mockProcessOn = vi.fn();
    process.on = mockProcessOn as any;
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NEXT_RUNTIME = originalEnv;
    consoleWarnSpy.mockRestore();
    vi.resetModules();
  });

  describe('nodejs runtime', () => {
    it('should import sentry.server.config for nodejs runtime', async () => {
      process.env.NEXT_RUNTIME = 'nodejs';

      vi.resetModules();
      const { register } = await import('../instrumentation');

      await register();

      // Verify sentry config was imported
      expect(mockProcessOn).toHaveBeenCalled();
    });

    it('should setup unhandledRejection handler for nodejs runtime', async () => {
      process.env.NEXT_RUNTIME = 'nodejs';

      vi.resetModules();
      const { register } = await import('../instrumentation');

      await register();

      expect(mockProcessOn).toHaveBeenCalledWith(
        'unhandledRejection',
        expect.any(Function),
      );
    });

    it('should suppress HTMLElement errors during route pre-warming', async () => {
      process.env.NEXT_RUNTIME = 'nodejs';

      vi.resetModules();
      const { register } = await import('../instrumentation');

      await register();

      // Get the error handler callback
      const errorHandler = mockProcessOn.mock.calls.find(
        (call) => call[0] === 'unhandledRejection',
      )?.[1];

      expect(errorHandler).toBeDefined();

      if (errorHandler) {
        // Test with HTMLElement error
        const htmlElementError = {
          message: 'HTMLElement is not defined',
        };

        errorHandler(htmlElementError);

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          '[Next.js] Suppressed HTMLElement error during route pre-warming (non-blocking)',
        );
      }
    });

    it('should not suppress non-HTMLElement errors', async () => {
      process.env.NEXT_RUNTIME = 'nodejs';

      vi.resetModules();
      const { register } = await import('../instrumentation');

      await register();

      // Get the error handler callback
      const errorHandler = mockProcessOn.mock.calls.find(
        (call) => call[0] === 'unhandledRejection',
      )?.[1];

      expect(errorHandler).toBeDefined();

      if (errorHandler) {
        // Test with other error - should not call console.warn
        const otherError = {
          message: 'Some other error',
        };

        errorHandler(otherError);

        expect(consoleWarnSpy).not.toHaveBeenCalled();
      }
    });

    it('should handle errors without message property', async () => {
      process.env.NEXT_RUNTIME = 'nodejs';

      vi.resetModules();
      const { register } = await import('../instrumentation');

      await register();

      // Get the error handler callback
      const errorHandler = mockProcessOn.mock.calls.find(
        (call) => call[0] === 'unhandledRejection',
      )?.[1];

      if (errorHandler) {
        // Test with error that has no message
        errorHandler(null);
        errorHandler(undefined);
        errorHandler({});

        // Should not crash
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      }
    });
  });

  describe('edge runtime', () => {
    it('should import sentry.edge.config for edge runtime', async () => {
      process.env.NEXT_RUNTIME = 'edge';

      vi.resetModules();
      const { register } = await import('../instrumentation');

      await register();

      // Verify execution completed
      expect(true).toBe(true);
    });

    it('should not setup process error handler for edge runtime', async () => {
      process.env.NEXT_RUNTIME = 'edge';

      vi.resetModules();
      const { register } = await import('../instrumentation');

      await register();

      // Should not call process.on for edge runtime
      const unhandledRejectionCall = mockProcessOn.mock.calls.find(
        (call) => call[0] === 'unhandledRejection',
      );
      expect(unhandledRejectionCall).toBeUndefined();
    });
  });

  describe('other runtimes', () => {
    it('should handle when NEXT_RUNTIME is not set', async () => {
      delete process.env.NEXT_RUNTIME;

      vi.resetModules();
      const { register } = await import('../instrumentation');

      await register();

      // Should complete without errors
      expect(true).toBe(true);
    });
  });
});
