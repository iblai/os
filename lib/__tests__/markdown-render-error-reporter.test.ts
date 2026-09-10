import * as Sentry from '@sentry/nextjs';

import {
  MarkdownRenderError,
  reportMarkdownRenderFailure,
  resetMarkdownRenderReports,
} from '../markdown-render-error-reporter';

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  getClient: vi.fn(() => ({})),
}));

const captureException = vi.mocked(Sentry.captureException);
const getClient = vi.mocked(Sentry.getClient);

const FORDHAM = 'Our site—www.fordham.edu—has more.';

describe('reportMarkdownRenderFailure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClient.mockReturnValue({} as ReturnType<typeof Sentry.getClient>);
    resetMarkdownRenderReports();
  });

  it('reports the failure with the boundary tags and the source shape', () => {
    reportMarkdownRenderFailure(
      new TypeError("Cannot read properties of undefined (reading 'start')"),
      FORDHAM,
    );

    expect(captureException).toHaveBeenCalledTimes(1);
    const [error, context] = captureException.mock.calls[0];
    expect(error).toBeInstanceOf(MarkdownRenderError);
    expect((error as Error).name).toBe('MarkdownRenderError');
    expect((error as Error).message).toBe(
      "Cannot read properties of undefined (reading 'start')",
    );
    expect(context).toMatchObject({
      tags: {
        subsystem: 'markdown',
        renderer: 'boundary',
        path: 'chat',
        errorName: 'TypeError',
      },
      extra: {
        shape: expect.arrayContaining([
          'autolink-adjacent-unicode-punctuation',
        ]),
        occurrences: 1,
      },
    });
  });

  it('keeps the thrown error as the cause so the stack survives', () => {
    const thrown = new TypeError('boom');
    reportMarkdownRenderFailure(thrown, 'text');

    expect((captureException.mock.calls[0][0] as Error).cause).toBe(thrown);
  });

  it('accepts a non-Error throw', () => {
    reportMarkdownRenderFailure('a string was thrown', 'text');

    const [error, context] = captureException.mock.calls[0];
    expect((error as Error).message).toBe('a string was thrown');
    expect(context).toMatchObject({ tags: { errorName: 'Error' } });
  });

  it('accepts an explicit path', () => {
    reportMarkdownRenderFailure(new Error('boom'), 'text', 'canvas');

    expect(captureException.mock.calls[0][1]).toMatchObject({
      tags: { path: 'canvas' },
    });
  });

  it('tags the tenant when the URL carries a platform key', () => {
    window.history.pushState({}, '', '/platform/acme/mentor');
    reportMarkdownRenderFailure(new Error('boom'), 'text');
    window.history.pushState({}, '', '/');

    expect(captureException.mock.calls[0][1]).toMatchObject({
      tags: { tenant: 'acme' },
    });
  });

  it('omits the tenant tag when there is no window', () => {
    vi.stubGlobal('window', undefined);
    reportMarkdownRenderFailure(new Error('boom'), 'text');
    vi.unstubAllGlobals();

    expect(captureException.mock.calls[0][1]).not.toMatchObject({
      tags: { tenant: expect.anything() },
    });
  });

  it('stays silent without a Sentry client', () => {
    getClient.mockReturnValue(undefined);
    reportMarkdownRenderFailure(new Error('boom'), 'text');

    expect(captureException).not.toHaveBeenCalled();
  });

  it('reports a repeated failure once per session', () => {
    for (let i = 0; i < 5; i++) {
      reportMarkdownRenderFailure(new Error('boom'), FORDHAM);
    }

    expect(captureException).toHaveBeenCalledTimes(1);
  });

  it('separates failures that differ only in shape', () => {
    reportMarkdownRenderFailure(new Error('boom'), FORDHAM);
    reportMarkdownRenderFailure(new Error('boom'), '| a | b |\n| - | - |');

    expect(captureException).toHaveBeenCalledTimes(2);
  });

  it('caps the number of distinct signatures it tracks', () => {
    for (let i = 0; i < 60; i++) {
      reportMarkdownRenderFailure(new Error(`boom ${i}`), 'text');
    }

    expect(captureException).toHaveBeenCalledTimes(50);
  });

  it('forgets its signatures on reset', () => {
    reportMarkdownRenderFailure(new Error('boom'), 'text');
    resetMarkdownRenderReports();
    reportMarkdownRenderFailure(new Error('boom'), 'text');

    expect(captureException).toHaveBeenCalledTimes(2);
  });

  it('never lets a telemetry failure escape', () => {
    captureException.mockImplementationOnce(() => {
      throw new Error('sentry is down');
    });

    expect(() =>
      reportMarkdownRenderFailure(new Error('boom'), 'text'),
    ).not.toThrow();
  });
});

/**
 * The invariant the whole reporter exists to hold: the message that crashed
 * the renderer is the user's conversation, and none of it may leave the
 * browser. Only the shape does.
 */
const SECRETS = [
  'My password is hunter2 and my card is 4111 1111 1111 1111',
  'Patient John Smith, DOB 1980-01-01—www.hospital.org—admitted',
  'Email conrad@example.com about the 250,000 dollar offer',
];

describe('markdown render telemetry never carries prose', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClient.mockReturnValue({} as ReturnType<typeof Sentry.getClient>);
    resetMarkdownRenderReports();
  });

  it.each(SECRETS)('sends no fragment of %j', (source) => {
    reportMarkdownRenderFailure(new TypeError('boom'), source);

    const [error, context] = captureException.mock.calls[0];
    const payload = JSON.stringify({
      message: (error as Error).message,
      context,
    });
    for (const word of source.split(/\s+/)) {
      if (word.length < 4) continue;
      expect(payload).not.toContain(word);
    }
  });
});
