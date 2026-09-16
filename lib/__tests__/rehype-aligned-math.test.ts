import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import zilMath from '@ziloen/remark-math';
import type { Root } from 'hast';

import { rehypeAlignedMath } from '../rehype-aligned-math';

const render = (markdown: string) =>
  String(
    unified()
      .use(remarkParse)
      .use(zilMath)
      .use(remarkRehype)
      .use(rehypeAlignedMath)
      .use(rehypeStringify)
      .processSync(markdown),
  );

/** The shape Streamdown's rehype-sanitize leaves behind: only `language-*`. */
const sanitized = (value: string, tagName = 'code', parent = 'pre'): Root => ({
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
          properties: { className: ['language-math'] },
          children: [{ type: 'text', value }],
        },
      ],
    },
  ],
});

const runOn = (tree: Root) => {
  rehypeAlignedMath()(tree);
  return tree;
};

const firstTex = (tree: Root) => {
  const wrapper = tree.children[0];
  if (wrapper.type !== 'element') throw new Error('no wrapper');
  const code = wrapper.children[0];
  if (code.type !== 'element') throw new Error('no code');
  const text = code.children[0];
  return text.type === 'text' ? text.value : undefined;
};

describe('rehypeAlignedMath', () => {
  it('wraps display math whose alignment markers have no environment', () => {
    expect(render('$$\na &= b + c \\\\\nd &= e + f\n$$')).toContain(
      '\\begin{aligned}\na &#x26;= b + c \\\\\nd &#x26;= e + f\n\\end{aligned}',
    );
  });

  it('wraps display math that only uses a row break', () => {
    expect(render('$$\na = b \\\\\nc = d\n$$')).toContain(
      '\\begin{aligned}\na = b \\\\\nc = d\n\\end{aligned}',
    );
  });

  it('leaves math that already opens an environment untouched', () => {
    for (const source of [
      '$$\\begin{aligned}\na &= b \\\\\nc &= d\n\\end{aligned}$$',
      '$$\\begin{pmatrix}1 & 2 \\\\ 3 & 4\\end{pmatrix}$$',
      '$$\\begin{cases} a & x>0 \\\\ b & x<0 \\end{cases}$$',
      '$$\\begin {array}{cc} a & b \\end{array}$$',
    ]) {
      const html = render(source);
      expect(html).not.toContain('\\begin{aligned}\n\\begin');
      expect(html.match(/\\begin\{aligned\}/g) ?? []).toHaveLength(
        source.includes('{aligned}') ? 1 : 0,
      );
    }
  });

  // A "does it contain \begin{" test skipped these: the environment binds its
  // own `&`, but the `\\` BETWEEN the two environments is as unbound as any
  // other and KaTeX drops it silently, collapsing the rows onto one line.
  it('wraps alignment that sits outside a balanced environment', () => {
    const html = render('$$\\begin{matrix} a & b \\end{matrix} \\\\ c &= d$$');
    expect(html).toContain('\\begin{aligned}');
    expect(html).toContain('\\begin{matrix}');
  });

  it('wraps a row break between two balanced environments', () => {
    const html = render(
      '$$\\begin{pmatrix}1 & 2\\end{pmatrix} \\\\ \\begin{pmatrix}3 & 4\\end{pmatrix}$$',
    );
    expect(html.match(/\\begin\{aligned\}/g) ?? []).toHaveLength(1);
  });

  it('leaves an environment left open by the stream untouched', () => {
    expect(render('$$\\begin{aligned} a &= b \\\\ c$$')).not.toContain(
      '\\begin{aligned}\n\\begin',
    );
  });

  it('leaves math with no alignment markers untouched', () => {
    expect(render('$$E = mc^2$$')).not.toContain('aligned');
  });

  it('treats an escaped ampersand as literal text, not alignment', () => {
    expect(render('$$a \\& b$$')).not.toContain('aligned');
  });

  it('leaves inline math untouched', () => {
    expect(render('the $a &= b$ span')).not.toContain('aligned');
  });

  it('wraps a sanitized language-math code fence inside a pre', () => {
    expect(firstTex(runOn(sanitized('a &= b')))).toBe(
      '\\begin{aligned}\na &= b\n\\end{aligned}',
    );
  });

  it('ignores a language-math element that is not a code fence in a pre', () => {
    expect(firstTex(runOn(sanitized('a &= b', 'span')))).toBe('a &= b');
    expect(firstTex(runOn(sanitized('a &= b', 'code', 'div')))).toBe('a &= b');
  });

  it('ignores an element with no class list', () => {
    const tree: Root = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'p',
          properties: {},
          children: [{ type: 'text', value: 'a &= b' }],
        },
      ],
    };
    runOn(tree);
    const p = tree.children[0];
    expect(p.type === 'element' && p.children[0]).toMatchObject({
      value: 'a &= b',
    });
  });

  it('ignores a math element whose first child is not text', () => {
    const tree: Root = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'span',
          properties: { className: ['math-display'] },
          children: [
            { type: 'element', tagName: 'i', properties: {}, children: [] },
          ],
        },
      ],
    };
    expect(() => runOn(tree)).not.toThrow();
    const span = tree.children[0];
    expect(span.type === 'element' && span.children[0].type).toBe('element');
  });
});
