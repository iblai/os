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

// `tikzpicture` is a drawing environment: not a KaTeX environment, and not
// something markdown can express either, so the island bridge declines it too.
// Nothing can repair this one.
const BROKEN =
  '$$\n\\begin{tikzpicture}\n\\draw (0,0) -- (1,1);\n\\end{tikzpicture}\n$$';

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
    expect(extra.tex).toContain('\\begin{tikzpicture}');
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

// The silent failures: nothing throws, the reader just sees a backslash.
const RESIDUE = 'The step takes \\approx 60 minutes to finish.';
const UNRENDERABLE =
  'Diagram:\n\n\\begin{tikzpicture}\n\\draw (0,0) -- (1,1);\n\\end{tikzpicture}\n';

describe('unconverted LaTeX telemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMathErrorReports();
  });

  it('reports a command left in chat prose, with no prose attached', () => {
    render(<Markdown>{RESIDUE}</Markdown>);

    expect(captureException).toHaveBeenCalledTimes(1);
    const [error, context] = captureException.mock.calls[0];
    expect((error as Error).message).toBe(
      'Unconverted LaTeX command: \\approx',
    );
    expect(context).toMatchObject({ tags: { path: 'chat' } });
    expect(JSON.stringify(context)).not.toContain('minutes');
  });

  it('reports the environment nothing can render, on canvas too', () => {
    markdownToHtml(UNRENDERABLE);

    // The environment name and the `\draw` inside it, one report each.
    expect(captureException).toHaveBeenCalledTimes(2);
    expect(captureException.mock.calls[0][1]).toMatchObject({
      tags: { path: 'canvas', residueToken: 'tikzpicture' },
    });
  });

  it('stays silent on content that only looks like LaTeX', () => {
    const clean = [
      'Open C:\\Users\\taha\\report.docx to edit it.',
      'The regex \\d+ matches digits.',
      'Type `\\approx` to get the symbol.',
      '```latex\n\\begin{tabular}{cc}A & B\\end{tabular}\n```',
      '\\begin{itemize}\n\\item First\n\\item Second\n\\end{itemize}',
      'A price range of $100 to $200, and $x = 4$ inline.',
    ];

    for (const source of clean) {
      render(<Markdown>{source}</Markdown>);
      markdownToHtml(source);
    }

    expect(captureException).not.toHaveBeenCalled();
  });
});
