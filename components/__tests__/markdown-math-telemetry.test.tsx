import { render } from '@testing-library/react';
import * as Sentry from '@sentry/nextjs';

import Markdown from '../markdown';
import { markdownToHtml } from '@/lib/utils';
import { resetMathErrorReports } from '@/lib/markdown-math-error-reporter';

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  getClient: vi.fn(() => ({})),
}));

const captureException = vi.mocked(Sentry.captureException);

// `enumerate` is not a KaTeX environment and no normalization can repair it.
const BROKEN =
  '$$\n\\begin{enumerate}\n\\item First step.\n\\end{enumerate}\n$$';

describe('KaTeX failure telemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMathErrorReports();
  });

  it('reports a chat render failure with the failing TeX only', () => {
    render(<Markdown>{`Some prose.\n\n${BROKEN}`}</Markdown>);

    expect(captureException).toHaveBeenCalledTimes(1);
    const [error, context] = captureException.mock.calls[0];
    expect((error as Error).message).toContain('KaTeX parse error');
    expect(context).toMatchObject({ tags: { path: 'chat' } });
    const extra = (context as { extra: { tex: string } }).extra;
    expect(extra.tex).toContain('\\begin{enumerate}');
    expect(extra.tex).not.toContain('Some prose');
  });

  it('reports a canvas render failure', () => {
    markdownToHtml(BROKEN);

    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException.mock.calls[0][1]).toMatchObject({
      tags: { path: 'canvas' },
    });
  });

  it('stays silent when the math renders cleanly', () => {
    render(<Markdown>{'$$\na &= b \\\\\nc &= d\n$$'}</Markdown>);
    markdownToHtml('$$\na &= b \\\\\nc &= d\n$$');

    expect(captureException).not.toHaveBeenCalled();
  });
});
