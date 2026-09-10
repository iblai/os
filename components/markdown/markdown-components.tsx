import type { ComponentPropsWithoutRef } from 'react';
import type { Element } from 'hast';
import { Streamdown } from 'streamdown';

import { CopyButtonIcon } from '@/components/copy-button-icon';
import { CodeBlockBody } from './code-block-body';
import { MarkdownImageComponent } from './markdown-image-component';

type Components = ComponentPropsWithoutRef<typeof Streamdown>['components'];

/**
 * The fenced block a `<pre>` wraps -- its text and its language hint -- or null
 * when it must not take the chrome.
 *
 * The decision lives on `pre` rather than on `code` because `pre` only ever
 * wraps a fenced block, while `code` is also every inline `` `span` ``. Asking
 * `code` to tell them apart forced a `language-*` class as the proxy, so a
 * fence with no language -- a bare ``` fence, or the code this app recovers
 * from legacy `\begin{verbatim}` and `\verb` LaTeX -- fell through to inline
 * styling with no header, no copy button and no highlighting.
 */
function fencedCode(node: Element | undefined) {
  const code = node?.children.find((child) => child.type === 'element');
  // Not every `<pre>` came from a fence: raw HTML in a message reaches this
  // component too, and `<pre>text</pre>` has no `<code>` to read.
  if (code?.type !== 'element' || code.tagName !== 'code') return null;
  const classes = code.properties?.className;
  const names = Array.isArray(classes) ? classes.map(String) : [];
  // No language is exempt, `latex` included. A ```latex fence used to bypass
  // this and stay a plain <code> because the retired preprocessor handed such
  // fences to KaTeX; nothing does now -- rehype-katex reads `language-math` /
  // `math-display`, which only `$...$`, `$$...$$`, `\(...\)` and `\[...\]`
  // produce -- so the bypass delivered nothing and only stripped the chrome.
  const language = names
    .find((name) => name.startsWith('language-'))
    ?.slice('language-'.length);
  const text = code.children
    .map((child) => {
      /* istanbul ignore next -- @preserve a code element's children are all text */
      return child.type === 'text' ? child.value : '';
    })
    .join('');
  return { code: text.replace(/\n$/, ''), language };
}

/**
 * An element whose only content is still streaming in. Streamdown renders the
 * empty tag, so a heading whose text has not arrived yet flashes as a bare
 * rule and an empty `<strong>` as a gap; returning null holds the line until
 * the first character lands.
 */
const empty = (children: unknown) => !String(children ?? '').trim();

// Streamdown prestyles every element it renders, but it prestyles them for a
// document, not for a 14px chat bubble: its `h1` is `text-3xl` (30px) and its
// `strong` is a `<span>`, which both looks wrong in the bubble and misses the
// `[&_strong]:font-bold` / `[&_strong]:font-normal` rules the bubble and the
// reasoning trace hang off the real element. Every override below is one the
// app carried before the Streamdown migration and still needs; everything
// else -- `em`, `p`, `a`, `blockquote`, the table family, `hr`, `small` --
// keeps Streamdown's own component.
export const components: Components = {
  // Headings step DOWN from the bubble's own `text-sm/6`: Streamdown's scale
  // starts two sizes above the body text it sits in.
  h1: ({ node, ...props }) =>
    empty(props.children) ? null : (
      <h1
        {...props}
        className="scroll-m-20 text-xl font-extrabold tracking-tight text-balance"
      />
    ),

  h2: ({ node, ...props }) =>
    empty(props.children) ? null : (
      <h2
        {...props}
        className="scroll-m-20 border-b pb-2 text-lg font-semibold tracking-tight first:mt-0"
      />
    ),

  h3: ({ node, ...props }) =>
    empty(props.children) ? null : (
      <h3
        {...props}
        className="scroll-m-20 text-base font-semibold tracking-tight"
      />
    ),

  h4: ({ node, ...props }) =>
    empty(props.children) ? null : (
      <h4
        {...props}
        className="scroll-m-20 text-sm font-semibold tracking-tight"
      />
    ),

  // h5 and h6 were never overridden -- before the migration Tailwind's
  // preflight left every heading at `font-size: inherit`, so they simply sat
  // at the body size. Streamdown gives them `text-base` and `text-sm`, which
  // would now render h5 (16px) LARGER than the h4 (14px) above it. They step
  // down with the rest instead.
  h5: ({ node, ...props }) =>
    empty(props.children) ? null : (
      <h5
        {...props}
        className="scroll-m-20 text-sm font-semibold tracking-tight"
      />
    ),

  h6: ({ node, ...props }) =>
    empty(props.children) ? null : (
      <h6
        {...props}
        className="scroll-m-20 text-sm font-semibold tracking-tight"
      />
    ),

  // Streamdown emits `<span class="font-semibold">`, which is neither bold to
  // a screen reader nor a match for the two live `[&_strong]:` rules in
  // components/chat/ai-message-bubble.tsx and
  // components/chat/reasoning-section.tsx. `em` keeps Streamdown's own
  // element -- Streamdown does not override it -- and is listed here only for
  // the same empty-children guard.
  strong: ({ node, ...props }) =>
    empty(props.children) ? null : <strong {...props} />,

  em: ({ node, ...props }) =>
    empty(props.children) ? null : <em {...props} />,

  // Streamdown's lists are `list-inside`, which puts the marker INSIDE the
  // item's content box as its first inline box. That cannot survive the block
  // wrapper `li` needs below: the marker is pushed into an anonymous block of
  // its own and every bullet lands on its own line, doubling each item's
  // height. `list-outside` -- the browser default, and what the app had before
  // the migration -- keeps the marker in the gutter beside the content.
  //
  // A nested list keeps the top-level my-6 unless overridden, which detaches
  // it from its parent item by 24px on each side. The [ul_&]/[ol_&] variants
  // win on specificity (.x ul beats .x) and collapse the gap only when the
  // list sits inside another list.
  ul: ({ node, ...props }) => (
    <ul
      {...props}
      className="my-6 ml-6 list-disc [&>li]:mt-2 [ol_&]:my-1 [ul_&]:my-1"
    />
  ),

  ol: ({ node, ...props }) => (
    <ol
      {...props}
      className="my-6 ml-6 list-decimal [&>li]:mt-2 [ol_&]:my-1 [ul_&]:my-1"
    />
  ),

  // The scroll container has to be INSIDE the `<li>`: a list item that is
  // itself a scroll container clips its own marker, which hides every bullet
  // and number. Wide content -- a long display equation in a bullet -- still
  // scrolls via the wrapper. `[&>p]:inline` is Streamdown's, moved onto the
  // wrapper so a loose item's FIRST paragraph keeps sitting on the marker's
  // line; its `py-1` is dropped, which is what made chat lists looser than
  // they were. Scoped to `:first-child` because Streamdown's unscoped
  // `[&>p]:inline` also inlined a loose item's continuation paragraphs, so
  // `- one\n\n  two` ran together as "onetwo".
  li: ({ node, children, ...props }) => (
    <li {...props}>
      <div className="overflow-x-auto [&>p:first-child]:inline">{children}</div>
    </li>
  ),

  // Streamdown's `img` is `max-w-full rounded-lg` with no height limit, the
  // browser's broken-image glyph when a URL fails, and -- since `controls`
  // enables images by default -- a hover download button. Replacing the
  // component bypasses all three: a tall image is clamped to `max-h-96` and a
  // dead URL becomes a labelled "Image unavailable" card.
  img: ({ node, ...props }) => (
    <MarkdownImageComponent
      src={props.src}
      alt={props.alt}
      title={props.title}
    />
  ),

  code: ({ node, ...props }) => (
    <code
      {...props}
      className={`relative rounded px-[0.3rem] py-[0.2rem] font-mono text-sm ${props.className ?? ''}`}
    />
  ),

  pre: ({ node, children, ...props }) => {
    const block = fencedCode(node);
    if (!block) {
      return (
        <pre {...props} className="w-full overflow-x-auto bg-gray-200">
          {children}
        </pre>
      );
    }
    return (
      // The chrome replaces the <pre> rather than sitting inside one, so the
      // surrounding bubble's own `pre` styling -- the margin, padding and grey
      // ground this file used to have to undo with `has-[[data-code-block]]`
      // overrides -- never applies to it in the first place.
      <div
        data-code-block
        className="my-4 overflow-hidden rounded-lg border border-[#3f3f3f] bg-[#2d2d2d]"
      >
        <div className="flex items-center justify-between gap-2 border-b border-[#3f3f3f] bg-[#1f1f1f] py-1 pr-1 pl-3">
          {/* No language, no label: the header keeps its height and the copy
              button stays right-aligned, rather than claiming a language the
              fence never declared. */}
          {block.language ? (
            <span
              data-testid="code-block-language"
              className="font-mono text-xs text-[#cccccc] select-none"
            >
              {block.language}
            </span>
          ) : null}
          <CopyButtonIcon
            text={block.code}
            label="Copy"
            variant="ghost"
            data-testid="code-block-copy"
            className="ml-auto h-7 gap-1.5 px-2 text-xs text-[#cccccc] hover:bg-white/10 hover:text-white"
          />
        </div>
        {/* The syntax highlighter is lazy-loaded (see code-block-body) so the
            heavy react-syntax-highlighter bundle stays off the main chat path
            and only downloads when a code block actually appears. `text` is
            Prism's plain-text grammar, the honest hint for a fence that
            declared no language. */}
        <CodeBlockBody code={block.code} language={block.language ?? 'text'} />
      </div>
    );
  },
};
