import type { Components } from 'react-markdown';

import { CopyButtonIcon } from '@/components/copy-button-icon';
import { MarkdownImageComponent } from './markdown-image-component';
import { CodeBlockBody } from './code-block-body';

export const components: Components = {
  h1: ({ node, ...props }) => {
    const content = String(props.children || '').trim();
    if (!content) return null;
    return (
      <h1
        {...props}
        className="scroll-m-20 text-xl font-extrabold tracking-tight text-balance"
      />
    );
  },

  h2: ({ node, ...props }) => {
    const content = String(props.children || '').trim();
    if (!content) return null;
    return (
      <h2
        {...props}
        className="scroll-m-20 border-b pb-2 text-lg font-semibold tracking-tight first:mt-0"
      />
    );
  },

  h3: ({ node, ...props }) => {
    const content = String(props.children || '').trim();
    if (!content) return null;
    return (
      <h3
        {...props}
        className="scroll-m-20 text-base font-semibold tracking-tight"
      />
    );
  },

  h4: ({ node, ...props }) => {
    const content = String(props.children || '').trim();
    if (!content) return null;
    return (
      <h4
        {...props}
        className="scroll-m-20 text-sm font-semibold tracking-tight"
      />
    );
  },

  p: ({ node, ...props }) => (
    <p {...props} className="leading-7 [&:not(:first-child)]:mt-6" />
  ),

  strong: ({ node, ...props }) => {
    const content = String(props.children || '').trim();
    if (!content) return null;
    return <strong {...props} />;
  },

  em: ({ node, ...props }) => {
    const content = String(props.children || '').trim();
    if (!content) return null;
    return <em {...props} />;
  },

  a: ({ node, ...props }) => (
    <a
      className="text-blue-500 underline"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),

  blockquote: ({ node, ...props }) => (
    <blockquote {...props} className="mt-6 border-l-2 pl-6 italic" />
  ),

  table: ({ node, ...props }) => (
    <div className="my-6 w-full overflow-x-auto">
      <table {...props} className="w-full border-collapse" />
    </div>
  ),

  tr: ({ node, ...props }) => (
    <tr
      {...props}
      className="even:bg-muted m-0 border-t p-0 even:text-gray-700"
    />
  ),

  th: ({ node, ...props }) => (
    <th
      {...props}
      className="border px-4 py-2 text-left font-bold whitespace-nowrap [&[align=center]]:text-center [&[align=right]]:text-right"
    />
  ),

  td: ({ node, ...props }) => (
    <td
      {...props}
      className="border px-4 py-2 text-left whitespace-nowrap [&[align=center]]:text-center [&[align=right]]:text-right"
    />
  ),

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

  // The scroll container has to be inside the <li>: a list item that is itself
  // a scroll container clips its own marker, which hides every bullet and
  // number. Wide content (long equations) still scrolls via the wrapper.
  li: ({ node, children, ...props }) => (
    <li {...props}>
      <div className="overflow-x-auto">{children}</div>
    </li>
  ),

  // Fenced code blocks get ChatGPT/Claude-style chrome: a header bar carrying
  // the language name and a Copy control, sitting directly on top of the
  // highlighted body inside one rounded, clipped container.
  //
  // The `tomorrow` Prism theme is a dark palette (#2d2d2d body) in both app
  // themes, so the header is always dark too — #1f1f1f reads as a deliberate
  // companion shade rather than a light strip clashing with the code. Its
  // foreground is the theme's own #ccc (10.3:1 against #1f1f1f).
  code: ({ node, ...props }) => {
    const match = /language-(\w+)/.exec(props.className || '');
    // `language-latex` deliberately bypasses this path: those blocks are
    // handed to KaTeX downstream and must stay plain <code>.
    if (match && props.className !== 'language-latex') {
      const code = String(props.children).replace(/\n$/, '');
      return (
        <div
          data-code-block
          className="my-4 overflow-hidden rounded-lg border border-[#3f3f3f] bg-[#2d2d2d]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-[#3f3f3f] bg-[#1f1f1f] py-1 pr-1 pl-3">
            <span
              data-testid="code-block-language"
              className="font-mono text-xs text-[#cccccc] select-none"
            >
              {match[1]}
            </span>
            <CopyButtonIcon
              text={code}
              label="Copy"
              variant="ghost"
              data-testid="code-block-copy"
              className="h-7 gap-1.5 px-2 text-xs text-[#cccccc] hover:bg-white/10 hover:text-white"
            />
          </div>
          {/* The syntax highlighter is lazy-loaded (see code-block-body) so
              the heavy react-syntax-highlighter bundle stays off the main chat
              path and only downloads when a code block actually appears. */}
          <CodeBlockBody code={code} language={match[1]} />
        </div>
      );
    }

    return (
      <code
        {...props}
        className={`relative rounded px-[0.3rem] py-[0.2rem] font-mono text-sm ${props.className}`}
      />
    );
  },

  // react-markdown wraps fenced blocks in <pre>, which would otherwise draw a
  // light grey padded box around the dark chrome above. Neutralise it only when
  // it actually contains that chrome — plain <pre> blocks keep their styling.
  // `!` is required: the chat bubble sets `[&_pre]:bg-gray-200 [&_pre]:p-2`,
  // which outranks a bare class on the element itself.
  pre: ({ node, ...props }) => (
    <pre
      {...props}
      className="w-full overflow-x-auto bg-gray-200 has-[[data-code-block]]:m-0! has-[[data-code-block]]:bg-transparent! has-[[data-code-block]]:p-0!"
    />
  ),

  small: ({ node, ...props }) => (
    <small {...props} className="text-sm leading-none font-medium" />
  ),

  img: ({ node, ...props }) => (
    <MarkdownImageComponent
      src={props.src}
      alt={props.alt}
      title={props.title}
    />
  ),

  textarea: ({ node, ...props }) => {
    // Extract children and use as defaultValue instead
    const content = String(props.children || '').trim();
    const { children, ...restProps } = props;
    return <textarea {...restProps} defaultValue={content} readOnly />;
  },
};
