/**
 * The failure this pins: a single unparseable message used to unmount the
 * whole conversation, permanently, because the message is persisted and
 * re-parses on every load. The boundary has to hold the blast radius to one
 * message, show that message's own text rather than an apology, and let go
 * again the moment the content changes.
 */
import { render } from '@testing-library/react';
import * as Sentry from '@sentry/nextjs';

import { MarkdownErrorBoundary } from '../markdown-error-boundary';
import { resetMarkdownRenderReports } from '@/lib/markdown-render-error-reporter';

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  getClient: vi.fn(() => ({})),
}));

const captureException = vi.mocked(Sentry.captureException);

const FORDHAM = 'Our site—www.fordham.edu—has more.';

/** Throws on render, exactly as a renderer bug does. */
function Boom({ when = true }: { when?: boolean }) {
  if (when)
    throw new TypeError(
      "Cannot read properties of undefined (reading 'start')",
    );
  return <span>rendered</span>;
}

// React logs every caught boundary error to console.error; the noise would
// otherwise bury a real failure in the test output.
let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  resetMarkdownRenderReports();
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

describe('MarkdownErrorBoundary', () => {
  it('renders its children when nothing throws', () => {
    const { getByText, queryByTestId } = render(
      <MarkdownErrorBoundary source="hello">
        <span>hello</span>
      </MarkdownErrorBoundary>,
    );

    expect(getByText('hello')).toBeInTheDocument();
    expect(queryByTestId('markdown-plain-fallback')).not.toBeInTheDocument();
  });

  it('falls back to the raw source, not an apology', () => {
    const { getByTestId, queryByText } = render(
      <MarkdownErrorBoundary source={FORDHAM}>
        <Boom />
      </MarkdownErrorBoundary>,
    );

    expect(getByTestId('markdown-plain-fallback')).toHaveTextContent(
      'Our site—www.fordham.edu—has more.',
    );
    expect(queryByText('Oops, there was an error!')).not.toBeInTheDocument();
  });

  it('still announces the failure when there is no source', () => {
    const { getByTestId, getByText } = render(
      <MarkdownErrorBoundary>
        <Boom />
      </MarkdownErrorBoundary>,
    );

    expect(getByText(/couldn't be displayed properly/i)).toBeInTheDocument();
    expect(getByTestId('markdown-plain-fallback')).toHaveTextContent(
      /couldn't be displayed properly/i,
    );
  });

  it('merges a caller className into the fallback', () => {
    const { getByTestId } = render(
      <MarkdownErrorBoundary source="x" className="text-sm">
        <Boom />
      </MarkdownErrorBoundary>,
    );

    const fallback = getByTestId('markdown-plain-fallback');
    expect(fallback).toHaveClass('space-y-2');
    expect(fallback).toHaveClass('text-sm');
  });

  it('keeps the blast radius to the one message that threw', () => {
    const { getByText, getByTestId } = render(
      <div>
        <MarkdownErrorBoundary source="first">
          <span>first message</span>
        </MarkdownErrorBoundary>
        <MarkdownErrorBoundary source={FORDHAM}>
          <Boom />
        </MarkdownErrorBoundary>
        <MarkdownErrorBoundary source="third">
          <span>third message</span>
        </MarkdownErrorBoundary>
      </div>,
    );

    expect(getByText('first message')).toBeInTheDocument();
    expect(getByText('third message')).toBeInTheDocument();
    expect(getByTestId('markdown-plain-fallback')).toHaveTextContent(
      'fordham.edu',
    );
  });

  it('still shows the siblings after a remount, as a reload would', () => {
    const tree = (
      <div>
        <MarkdownErrorBoundary source="sibling">
          <span>sibling message</span>
        </MarkdownErrorBoundary>
        <MarkdownErrorBoundary source={FORDHAM}>
          <Boom />
        </MarkdownErrorBoundary>
      </div>
    );

    const first = render(tree);
    first.unmount();
    const { getByText, getByTestId } = render(tree);

    expect(getByText('sibling message')).toBeInTheDocument();
    expect(getByTestId('markdown-plain-fallback')).toHaveTextContent(
      'fordham.edu',
    );
  });

  describe('mid-stream reset', () => {
    it('clears the error when more of the message arrives', () => {
      const { rerender, getByTestId, getByText, queryByTestId } = render(
        <MarkdownErrorBoundary source="Our site—www.for">
          <Boom />
        </MarkdownErrorBoundary>,
      );

      expect(getByTestId('markdown-plain-fallback')).toBeInTheDocument();

      rerender(
        <MarkdownErrorBoundary source={FORDHAM}>
          <Boom when={false} />
        </MarkdownErrorBoundary>,
      );

      expect(queryByTestId('markdown-plain-fallback')).not.toBeInTheDocument();
      expect(getByText('rendered')).toBeInTheDocument();
    });

    it('stays in the fallback when the completed message throws again', () => {
      const { rerender, getByTestId } = render(
        <MarkdownErrorBoundary source="Our site—www.for">
          <Boom />
        </MarkdownErrorBoundary>,
      );

      rerender(
        <MarkdownErrorBoundary source={FORDHAM}>
          <Boom />
        </MarkdownErrorBoundary>,
      );

      expect(getByTestId('markdown-plain-fallback')).toHaveTextContent(
        'fordham.edu',
      );
    });

    it('does not reset when an unrelated prop changes', () => {
      const { rerender, getByTestId } = render(
        <MarkdownErrorBoundary source={FORDHAM}>
          <Boom />
        </MarkdownErrorBoundary>,
      );

      rerender(
        <MarkdownErrorBoundary source={FORDHAM} className="text-sm">
          <Boom when={false} />
        </MarkdownErrorBoundary>,
      );

      expect(getByTestId('markdown-plain-fallback')).toBeInTheDocument();
    });

    it('leaves a healthy render alone when the source changes', () => {
      const { rerender, getByText } = render(
        <MarkdownErrorBoundary source="one">
          <span>one</span>
        </MarkdownErrorBoundary>,
      );

      rerender(
        <MarkdownErrorBoundary source="two">
          <span>two</span>
        </MarkdownErrorBoundary>,
      );

      expect(getByText('two')).toBeInTheDocument();
    });
  });

  describe('telemetry', () => {
    it('reports the shape of the message that threw', () => {
      render(
        <MarkdownErrorBoundary source={FORDHAM}>
          <Boom />
        </MarkdownErrorBoundary>,
      );

      expect(captureException).toHaveBeenCalledTimes(1);
      expect(captureException.mock.calls[0][1]).toMatchObject({
        tags: { subsystem: 'markdown', renderer: 'boundary' },
        extra: {
          shape: expect.arrayContaining([
            'autolink-adjacent-unicode-punctuation',
          ]),
        },
      });
    });

    it('sends no word of the message itself', () => {
      const secret = 'Patient John Smith, DOB 1980-01-01—www.hospital.org—here';

      render(
        <MarkdownErrorBoundary source={secret}>
          <Boom />
        </MarkdownErrorBoundary>,
      );

      const [error, context] = captureException.mock.calls[0];
      const payload = JSON.stringify({
        message: (error as Error).message,
        context,
      });
      for (const word of secret.split(/\s+/)) {
        if (word.length < 4) continue;
        expect(payload).not.toContain(word);
      }
    });
  });
});
