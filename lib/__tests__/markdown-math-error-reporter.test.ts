import type { Root } from 'hast';
import * as Sentry from '@sentry/nextjs';

import {
  MarkdownDroppedContentError,
  MarkdownLatexResidueError,
  MarkdownMathRenderError,
  rehypeReportMathErrors,
  resetMathErrorReports,
} from '../markdown-math-error-reporter';

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  getClient: vi.fn(() => ({})),
}));

const captureException = vi.mocked(Sentry.captureException);
const getClient = vi.mocked(Sentry.getClient);

const errorTree = (title: string, tex: string): Root => ({
  type: 'root',
  children: [
    {
      type: 'element',
      tagName: 'span',
      properties: { className: ['katex-error'], title },
      children: [{ type: 'text', value: tex }],
    },
  ],
});

const run = (tree: Root, path: 'chat' | 'canvas' = 'chat') =>
  rehypeReportMathErrors({ path })(tree);

describe('rehypeReportMathErrors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClient.mockReturnValue({} as ReturnType<typeof Sentry.getClient>);
    resetMathErrorReports();
  });

  it('reports a KaTeX error span with the message, TeX and tags', () => {
    run(errorTree('ParseError: got &', 'a &= b'));

    expect(captureException).toHaveBeenCalledTimes(1);
    const [error, context] = captureException.mock.calls[0];
    expect(error).toBeInstanceOf(MarkdownMathRenderError);
    expect((error as Error).name).toBe('MarkdownMathRenderError');
    expect((error as Error).message).toBe('ParseError: got &');
    expect(context).toMatchObject({
      tags: { subsystem: 'markdown', renderer: 'katex', path: 'chat' },
      extra: {
        tex: 'a &= b',
        texLength: 6,
        truncated: false,
        occurrences: 1,
      },
    });
  });

  it('tags the tenant when the URL carries a platform key', () => {
    window.history.pushState({}, '', '/platform/acme/mentor');
    run(errorTree('ParseError: tenant', 'a &= b'), 'canvas');
    window.history.pushState({}, '', '/');

    expect(captureException.mock.calls[0][1]).toMatchObject({
      tags: { path: 'canvas', tenant: 'acme' },
    });
  });

  it('does not report when there is no error span', () => {
    run({
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'span',
          properties: { className: ['katex'] },
          children: [{ type: 'text', value: 'E = mc^2' }],
        },
        {
          type: 'element',
          tagName: 'p',
          properties: {},
          children: [{ type: 'text', value: 'prose' }],
        },
      ],
    });

    expect(captureException).not.toHaveBeenCalled();
  });

  it('truncates TeX beyond 120 characters and flags it', () => {
    const tex = 'x'.repeat(200);
    run(errorTree('ParseError: long', tex));

    expect(captureException.mock.calls[0][1]).toMatchObject({
      extra: { tex: 'x'.repeat(120), texLength: 200, truncated: true },
    });
  });

  it('reports an error span with no text child as empty TeX', () => {
    run({
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'span',
          properties: { className: ['katex-error'] },
          children: [
            { type: 'element', tagName: 'i', properties: {}, children: [] },
          ],
        },
      ],
    });

    expect(captureException.mock.calls[0][1]).toMatchObject({
      extra: { tex: '', texLength: 0 },
    });
    expect((captureException.mock.calls[0][0] as Error).message).toBe('');
  });

  it('reports one distinct signature once per session', () => {
    for (let i = 0; i < 5; i++) run(errorTree('ParseError: got &', 'a &= b'));
    run(errorTree('ParseError: got &', 'a &= b'), 'canvas');
    run(errorTree('ParseError: other', 'a &= b'));

    expect(captureException).toHaveBeenCalledTimes(3);
  });

  it('stops retaining signatures once the cap is reached', () => {
    for (let i = 0; i < 50; i++) run(errorTree(`ParseError: ${i}`, 'a'));
    expect(captureException).toHaveBeenCalledTimes(50);

    run(errorTree('ParseError: overflow', 'a'));
    expect(captureException).toHaveBeenCalledTimes(50);

    // An already-recorded signature is still deduped, not re-reported.
    run(errorTree('ParseError: 0', 'a'));
    expect(captureException).toHaveBeenCalledTimes(50);
  });

  it('is a no-op when the Sentry client is not initialised', () => {
    getClient.mockReturnValue(undefined);
    run(errorTree('ParseError: server', 'a &= b'));
    expect(captureException).not.toHaveBeenCalled();

    // The skipped report is not remembered, so a later session still sends it.
    getClient.mockReturnValue({} as ReturnType<typeof Sentry.getClient>);
    run(errorTree('ParseError: server', 'a &= b'));
    expect(captureException).toHaveBeenCalledTimes(1);
  });

  it('swallows a throwing Sentry rather than breaking the render', () => {
    captureException.mockImplementation(() => {
      throw new Error('transport down');
    });

    expect(() => run(errorTree('ParseError: boom', 'a &= b'))).not.toThrow();
  });
});

const paragraph = (value: string): Root => ({
  type: 'root',
  children: [
    {
      type: 'element',
      tagName: 'p',
      properties: {},
      children: [{ type: 'text', value }],
    },
  ],
});

const wrapped = (
  tagName: string,
  className: string[],
  value: string,
): Root => ({
  type: 'root',
  children: [
    {
      type: 'element',
      tagName,
      properties: { className },
      children: [{ type: 'text', value }],
    },
  ],
});

const runWithSource = (tree: Root, source: string) =>
  rehypeReportMathErrors({ path: 'chat' })(tree, { toString: () => source });

describe('unconverted LaTeX reporting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClient.mockReturnValue({} as ReturnType<typeof Sentry.getClient>);
    resetMathErrorReports();
  });

  it('reports a command the conversion left in visible prose', () => {
    run(paragraph('The run takes \\approx 60 minutes to finish.'));

    expect(captureException).toHaveBeenCalledTimes(1);
    const [error, context] = captureException.mock.calls[0];
    expect(error).toBeInstanceOf(MarkdownLatexResidueError);
    expect((error as Error).message).toBe(
      'Unconverted LaTeX command: \\approx',
    );
    expect(context).toMatchObject({
      tags: {
        subsystem: 'markdown',
        path: 'chat',
        renderer: 'latex-residue',
        residueKind: 'command',
        residueToken: '\\approx',
      },
      extra: { kind: 'command', token: '\\approx', matches: 1, occurrences: 1 },
    });
    expect(JSON.stringify(context)).not.toContain('minutes');
  });

  it('names an environment nothing could render', () => {
    run(paragraph('\\begin{tikzpicture} x \\end{tikzpicture}'), 'canvas');

    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException.mock.calls[0][1]).toMatchObject({
      tags: { path: 'canvas', residueKind: 'environment' },
      extra: { token: 'tikzpicture', matches: 2 },
    });
  });

  it('leaves rendered maths, code fences and MathML alone', () => {
    run(wrapped('span', ['katex'], '\\approx'));
    run(wrapped('code', ['language-latex'], '\\begin{tabular}'));
    run(wrapped('math', [], '\\frac{1}{2}'));

    expect(captureException).not.toHaveBeenCalled();
  });

  it('does not double-report the TeX inside a KaTeX error span', () => {
    run(errorTree('ParseError: env', '\\begin{tabular}{cc}'));

    expect(captureException).toHaveBeenCalledTimes(1);
    expect((captureException.mock.calls[0][0] as Error).name).toBe(
      'MarkdownMathRenderError',
    );
  });

  it('reports one residue token once per session', () => {
    for (let i = 0; i < 4; i++) run(paragraph('takes \\approx a while'));

    expect(captureException).toHaveBeenCalledTimes(1);
  });
});

describe('dropped content reporting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClient.mockReturnValue({} as ReturnType<typeof Sentry.getClient>);
    resetMathErrorReports();
  });

  const empty: Root = { type: 'root', children: [] };

  it('reports a block that rendered nothing, by environment name only', () => {
    const source = '\\begin{tabular}{cc}\nA & B\n\\end{tabular}\n';
    runWithSource(empty, source);

    expect(captureException).toHaveBeenCalledTimes(1);
    const [error, context] = captureException.mock.calls[0];
    expect(error).toBeInstanceOf(MarkdownDroppedContentError);
    expect(context).toMatchObject({
      tags: { path: 'chat', renderer: 'pipeline' },
      extra: {
        sourceLength: source.length,
        environments: ['tabular'],
        occurrences: 1,
      },
    });
    expect(JSON.stringify(context)).not.toContain('A & B');
  });

  it('stays silent when the tree rendered anything at all', () => {
    const source = '\\begin{tabular}{cc}A & B\\end{tabular}';
    runWithSource(
      { type: 'root', children: [{ type: 'comment', value: 'note' }] },
      source,
    );
    runWithSource(
      {
        type: 'root',
        children: [
          { type: 'element', tagName: 'img', properties: {}, children: [] },
        ],
      },
      source,
    );

    expect(captureException).not.toHaveBeenCalled();
  });

  it('counts any visible text as rendered', () => {
    runWithSource(paragraph('kept'), '\\begin{tabular}{cc}A\\end{tabular}');

    expect(captureException).not.toHaveBeenCalled();
  });

  it('reports an element that rendered but held nothing', () => {
    runWithSource(paragraph('   '), '\\begin{tabular}{cc}A\\end{tabular}');

    expect(captureException).toHaveBeenCalledTimes(1);
  });

  it('stays silent without a vfile, on a short source and without LaTeX', () => {
    run(empty);
    runWithSource(empty, '$$x$$');
    runWithSource(empty, '[ref]: https://example.com/\\alpha "the title"');
    runWithSource(empty, '<!-- \\begin{tabular} a hidden comment -->');

    expect(captureException).not.toHaveBeenCalled();
  });
});
