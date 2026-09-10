import type { Root } from 'hast';

import { extractVerbRows, rehypeVerbCode } from '../rehype-verb-code';

/** The shape both pipelines hand to rehype-katex: `code` inside `pre`. */
const mathTree = (
  value: string,
  className: string[] | null = ['language-math'],
  tagName = 'code',
  parent = 'pre',
): Root => ({
  type: 'root',
  children: [
    {
      type: 'element',
      tagName: parent,
      properties: {},
      children: [
        {
          type: 'element',
          tagName,
          properties: className === null ? {} : { className },
          children: [{ type: 'text', value }],
        },
      ],
    },
  ],
});

const inner = (tree: Root) => {
  const wrapper = tree.children[0];
  if (wrapper.type !== 'element') throw new Error('no wrapper');
  const node = wrapper.children[0];
  if (node.type !== 'element') throw new Error('no node');
  return node;
};

const runOn = (tree: Root) => {
  rehypeVerbCode()(tree);
  return inner(tree);
};

const text = (tree: Root) => {
  const child = runOn(tree).children[0];
  return child.type === 'text' ? child.value : undefined;
};

const CODE = [
  '\\begin{aligned}',
  '&\\verb|const a = 1;|\\\\',
  '&\\verb|const b = 2;|\\\\',
  '\\end{aligned}',
].join('\n');

describe('extractVerbRows', () => {
  it('reads every row of an all-verb aligned block', () => {
    expect(extractVerbRows(CODE)).toEqual(['const a = 1;', 'const b = 2;']);
  });

  it('reads a row padded with spaces before its separator', () => {
    expect(
      extractVerbRows(
        '\\begin{aligned}\\verb|a|  \\\\ \\verb|b|\\end{aligned}',
      ),
    ).toEqual(['a', 'b']);
  });

  it('accepts the align, align*, aligned and aligned* spellings', () => {
    for (const env of ['align', 'align*', 'aligned', 'aligned*']) {
      expect(extractVerbRows(`\\begin{${env}}\\verb|x|\\end{${env}}`)).toEqual([
        'x',
      ]);
    }
  });

  it('accepts rows with no leading alignment marker', () => {
    expect(
      extractVerbRows('\\begin{aligned}\\verb|a|\\\\ \\verb|b|\\end{aligned}'),
    ).toEqual(['a', 'b']);
  });

  it('accepts a lone backslash row break, which markdown leaves behind', () => {
    expect(
      extractVerbRows(
        '\\begin{aligned}&\\verb|a|\\\n&\\verb|b|\\\n\\end{aligned}',
      ),
    ).toEqual(['a', 'b']);
  });

  it('keeps an empty verb row as a blank line', () => {
    expect(
      extractVerbRows('\\begin{aligned}&\\verb||\\\\&\\verb|b|\\end{aligned}'),
    ).toEqual(['', 'b']);
  });

  it('accepts any non-alphanumeric delimiter', () => {
    expect(
      extractVerbRows('\\begin{aligned}\\verb+a|b+\\end{aligned}'),
    ).toEqual(['a|b']);
  });

  it('rejects anything that is not an aligned environment', () => {
    expect(extractVerbRows('a = b')).toBeNull();
    expect(
      extractVerbRows('\\begin{pmatrix}\\verb|a|\\end{pmatrix}'),
    ).toBeNull();
  });

  it('rejects a block with any non-verb row', () => {
    expect(
      extractVerbRows('\\begin{aligned}&\\verb|a|\\\\ &b = c\\end{aligned}'),
    ).toBeNull();
    expect(extractVerbRows('\\begin{aligned}a &= b\\end{aligned}')).toBeNull();
  });

  it('rejects an empty environment', () => {
    expect(extractVerbRows('\\begin{aligned}\n\\end{aligned}')).toBeNull();
  });

  it('rejects an unusable verb delimiter', () => {
    expect(
      extractVerbRows('\\begin{aligned}\\verb a \\end{aligned}'),
    ).toBeNull();
    expect(
      extractVerbRows('\\begin{aligned}\\verb*|a|\\end{aligned}'),
    ).toBeNull();
    expect(
      extractVerbRows('\\begin{aligned}\\verb|a\\end{aligned}'),
    ).toBeNull();
    expect(extractVerbRows('\\begin{aligned}\\verb')).toBeNull();
  });
});

describe('rehypeVerbCode', () => {
  it('turns an all-verb display block into a code fence', () => {
    const tree = mathTree(CODE);
    expect(text(tree)).toBe('const a = 1;\nconst b = 2;');
    // No language class: the content is arbitrary, and the chat renderer's
    // `pre` override gives every fenced block the code-block chrome whether or
    // not it declares one.
    expect(inner(tree).properties).toEqual({});
    expect(inner(tree).tagName).toBe('code');
  });

  it('also matches the unsanitized math-display class', () => {
    expect(text(mathTree(CODE, ['language-math', 'math-display']))).toBe(
      'const a = 1;\nconst b = 2;',
    );
  });

  it('leaves real alignment maths alone', () => {
    const source = '\\begin{aligned}a &= b\\end{aligned}';
    expect(text(mathTree(source))).toBe(source);
  });

  it('ignores nodes that are not display math', () => {
    expect(text(mathTree(CODE, null))).toBe(CODE);
    expect(text(mathTree(CODE, ['language-js']))).toBe(CODE);
    expect(text(mathTree(CODE, ['language-math'], 'span'))).toBe(CODE);
    expect(text(mathTree(CODE, ['language-math'], 'code', 'div'))).toBe(CODE);
  });

  it('ignores a math element whose first child is not text', () => {
    const tree = mathTree('');
    inner(tree).children = [
      { type: 'element', tagName: 'i', properties: {}, children: [] },
    ];
    expect(() => rehypeVerbCode()(tree)).not.toThrow();
    expect(inner(tree).children[0].type).toBe('element');
  });
});
