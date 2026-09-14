/**
 * markdownToHtml() sanitisation.
 *
 * The canvas pipeline runs `rehype-raw`, so any HTML an assistant emits in a
 * message reaches the tree verbatim. That output is not merely returned: the
 * function's own `linkifyHtml` step assigns it to `container.innerHTML`, and a
 * detached element still loads images, so an `onerror` handler would run. Until
 * issue #2441 added `rehype-sanitize` there was nothing between the two.
 *
 * The canvas editor was never exploitable in practice, because ProseMirror's
 * schema drops anything it does not model — but that made safety a property of
 * a DOWNSTREAM consumer rather than of this function. These tests pin it here,
 * so a future consumer that renders the HTML directly cannot inherit a hole.
 */
import { describe, it, expect } from 'vitest';
import { markdownToHtml } from '../utils';

const DANGEROUS =
  /<script|<iframe|<object|<embed|<form|\son\w+\s*=|(?:java|vb)script:|href="data:text\/html/i;

describe('markdownToHtml sanitisation', () => {
  it.each([
    ['inline script', '<script>alert(1)</script> after'],
    ['img onerror', '<img src=x onerror="alert(1)"> after'],
    ['javascript: link', '[click](javascript:alert(1))'],
    ['vbscript: link', '<a href="vbscript:msgbox(1)">x</a>'],
    ['inline handler', '<div onclick="alert(1)">c</div>'],
    ['iframe', '<iframe src="https://evil.test"></iframe>'],
    ['object', '<object data="evil.swf"></object>'],
    ['svg-nested script', '<svg><script>alert(1)</script></svg>'],
    [
      'data:text/html href',
      '<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>',
    ],
    [
      'credential form',
      '<form action="https://evil.test"><input name=p></form>',
    ],
    ['style tag', '<style>body{display:none}</style> after'],
    [
      'mathml-nested script',
      '<math><mtext><script>alert(1)</script></mtext></math>',
    ],
  ])('strips %s', (_label, markdown) => {
    expect(markdownToHtml(markdown)).not.toMatch(DANGEROUS);
  });

  it('keeps the surrounding prose when it strips an element', () => {
    expect(markdownToHtml('<script>alert(1)</script> after')).toContain(
      'after',
    );
    expect(markdownToHtml('<img src=x onerror="alert(1)"> after')).toContain(
      'after',
    );
  });

  it.each([
    ['inline maths', 'inline $\\pi r^2$', /katex/],
    ['display maths', 'd\n\n$$e^{i\\pi}+1=0$$\n', /katex-display/],
    ['mhchem', 'chem $\\ce{H2O}$', /katex/],
    ['gfm table', '| a | b |\n|---|---|\n| 1 | 2 |', /<table/],
    ['fenced code', '```bash\necho $HOME\n```', /language-bash/],
    ['latex itemize', '\\begin{itemize}\n\\item one\n\\end{itemize}', /<ul>/],
    [
      'latex tabular',
      '\\begin{tabular}{cc}A & B\\\\C & D\\end{tabular}',
      /<table/,
    ],
    ['strong + link', '**b** [ok](https://example.com)', /<strong>/],
    ['image', '![i](https://example.com/a.png)', /<img/],
    ['blockquote', '> quote', /<blockquote>/],
    ['strikethrough', '~~strike~~', /<del>/],
    ['reference link', '[x][y]\n\n[y]: https://example.com', /<a href/],
  ])('leaves %s intact', (_label, markdown, expected) => {
    expect(markdownToHtml(markdown)).toMatch(expected as RegExp);
  });

  it('does not strip KaTeX markup, which is generated after the schema runs', () => {
    // rehype-sanitize's defaultSchema would remove KaTeX's MathML and class
    // names, so the plugin order (raw -> sanitize -> katex) is load-bearing.
    const html = markdownToHtml('$$e^{i\\pi}+1=0$$');
    expect(html).toContain('katex-display');
    expect(html).toContain('<annotation encoding="application/x-tex">');
    expect(html).toMatch(/<math/);
  });

  it('keeps a safe external link with its href', () => {
    expect(markdownToHtml('[ok](https://example.com)')).toContain(
      'href="https://example.com"',
    );
  });
});
