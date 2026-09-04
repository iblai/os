/**
 * End-to-end guard for the canvas math round-trip.
 *
 * The sibling tiptap-math-extension.test.ts unit-tests the parse rules against
 * hand-built elements, so it cannot notice a change in what the markdown
 * pipeline actually emits. This suite drives the real path instead:
 *
 *   markdown -> markdownToHtml() -> live TipTap Editor -> getHTML() -> htmlToMarkdown()
 *
 * It exists because issue #2441 moved markdownToHtml() from `marked` to
 * unified, which re-parented display math from a <p> to a <div>. MathBlock is
 * declared `inline: true` on the assumption that KaTeX output sits inside a
 * paragraph; the round-trip survives only because ProseMirror re-wraps the
 * stray inline node. Nothing pinned that, so it could regress silently.
 */
import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { MathInline, MathBlock } from '../tiptap-math-extension';
import { markdownToHtml, htmlToMarkdown } from '@/lib/utils';

const EXT = [StarterKit, MathInline, MathBlock];

const roundTrip = (markdown: string) => {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = new Editor({
    element,
    extensions: EXT,
    content: markdownToHtml(markdown),
  });
  const types: string[] = [];
  const walk = (node: { type?: string; content?: unknown[] }) => {
    if (node.type) types.push(node.type);
    for (const child of (node.content ?? []) as (typeof node)[]) walk(child);
  };
  walk(editor.getJSON() as Parameters<typeof walk>[0]);
  const html = editor.getHTML();
  const markdownBack = htmlToMarkdown(html);
  editor.destroy();
  element.remove();
  return { types, html, markdownBack };
};

describe('canvas math round-trip through the real pipeline', () => {
  it.each([
    ['inline dollar', 'The area is $\\pi r^2$ here.', '\\pi r^2'],
    ['inline paren', 'The area is \\(\\pi r^2\\) here.', '\\pi r^2'],
    ['chemistry via mhchem', 'Water is $\\ce{H2O}$ today.', '\\ce{H2O}'],
  ])('keeps %s as a mathInline node', (_label, markdown, latex) => {
    const { types, html } = roundTrip(markdown);
    expect(types).toContain('mathInline');
    expect(types).not.toContain('mathBlock');
    expect(html).toContain(`data-math-latex="${latex}"`);
  });

  it.each([
    ['dollar delimiters', 'Before\n\n$$e^{i\\pi} + 1 = 0$$\n\nAfter'],
    ['bracket delimiters', 'Before\n\n\\[e^{i\\pi} + 1 = 0\\]\n\nAfter'],
  ])('keeps display math (%s) as a mathBlock node', (_label, markdown) => {
    const { types, html } = roundTrip(markdown);
    expect(types).toContain('mathBlock');
    expect(html).toContain('data-math-display="true"');
    expect(html).toContain('data-math-latex="e^{i\\pi} + 1 = 0"');
  });

  it('survives ProseMirror re-wrapping root-level display math', () => {
    // Pins the assumption MathBlock's `inline: true` depends on: rehype-katex
    // replaces the <pre> @ziloen emits, so .katex-display is a ROOT-level node,
    // not nested in a paragraph. An inline node only matches because
    // ProseMirror wraps it. If that ever stops holding the equation is dropped
    // silently, so assert both the shape and the surviving node.
    const holder = document.createElement('div');
    holder.innerHTML = markdownToHtml('$$e^{i\\pi} + 1 = 0$$');
    const display = holder.querySelector('.katex-display');
    expect(display).not.toBeNull();
    expect(display?.parentElement).toBe(holder);
    expect(roundTrip('$$e^{i\\pi} + 1 = 0$$').types).toContain('mathBlock');
  });

  it('normalises both display delimiter styles back to $$', () => {
    for (const source of [
      'Before\n\n$$e^{i\\pi} + 1 = 0$$\n\nAfter',
      'Before\n\n\\[e^{i\\pi} + 1 = 0\\]\n\nAfter',
    ]) {
      expect(roundTrip(source).markdownBack).toContain('$$e^{i\\pi} + 1 = 0$$');
    }
  });

  it('normalises \\( \\) inline delimiters back to $', () => {
    expect(
      roundTrip('The area is \\(\\pi r^2\\) here.').markdownBack,
    ).toContain('$\\pi r^2$');
  });

  it('leaves currency untouched and creates no math nodes', () => {
    const { types, markdownBack } = roundTrip(
      'A widget costs $25 and shipping is $8-$15.',
    );
    expect(types).not.toContain('mathInline');
    expect(types).not.toContain('mathBlock');
    expect(markdownBack).toContain('$25');
    expect(markdownBack).toContain('$8-$15');
  });

  it.each([
    ['<script>alert(1)</script> after', 'after'],
    ['<img src=x onerror="alert(1)"> after', 'after'],
    ['<div onclick="alert(1)">c</div>', 'c'],
  ])(
    'drops unsafe html from %s that markdownToHtml does not sanitise',
    (markdown, kept) => {
      // markdownToHtml() deliberately does not sanitise; canvas is safe only
      // because ProseMirror's schema drops anything it does not model. If the
      // canvas ever renders that HTML directly, this guard is the warning.
      const { html } = roundTrip(markdown);
      expect(html).toContain(kept);
      expect(html).not.toMatch(/<script|<iframe|\son\w+\s*=/i);
    },
  );
});
