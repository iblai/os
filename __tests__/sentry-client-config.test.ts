import { describe, it, expect, vi, beforeEach } from 'vitest';

// Capture what sentry.client.config passes to Sentry without running the real SDK.
const init = vi.fn();
const replayIntegration = vi.fn(() => ({ name: 'Replay' }));
const captureConsoleIntegration = vi.fn(() => ({ name: 'CaptureConsole' }));

vi.mock('@sentry/nextjs', () => ({
  init,
  replayIntegration,
  captureConsoleIntegration,
}));

vi.mock('@/lib/config', () => ({
  getEnv: (_key: string, fallback: string) => fallback,
}));

describe('sentry.client.config', () => {
  beforeEach(() => {
    vi.resetModules();
    init.mockClear();
    replayIntegration.mockClear();
    captureConsoleIntegration.mockClear();
  });

  it('initializes Sentry once with performance-tuned sampling', async () => {
    await import('../sentry.client.config');

    expect(init).toHaveBeenCalledTimes(1);
    const cfg = init.mock.calls[0][0];

    // Performance tracing dialed down from 1.0 — 100% tracing on every session
    // is unnecessary overhead in production.
    expect(cfg.tracesSampleRate).toBe(0.1);
    // Replay sampling intentionally unchanged.
    expect(cfg.replaysSessionSampleRate).toBe(0.1);
    expect(cfg.replaysOnErrorSampleRate).toBe(1.0);
  });

  it('configures Session Replay to mask text, block media, and cap mutations', async () => {
    await import('../sentry.client.config');

    expect(replayIntegration).toHaveBeenCalledTimes(1);
    const replayOpts = replayIntegration.mock.calls[0][0];
    expect(replayOpts).toMatchObject({
      maskAllText: true,
      blockAllMedia: true,
      mutationLimit: 1500,
      mutationBreadcrumbLimit: 500,
    });
  });
});
