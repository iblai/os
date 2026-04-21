import type { Components } from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow as syntaxHighlighter } from 'react-syntax-highlighter/dist/esm/styles/prism';

import { CopyButtonIcon } from '@/components/copy-button-icon';
import { MarkdownImageComponent } from './markdown-image-component';

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

  ul: ({ node, ...props }) => (
    <ul {...props} className="my-6 ml-6 list-disc [&>li]:mt-2" />
  ),

  ol: ({ node, ...props }) => (
    <ol {...props} className="my-6 ml-6 list-decimal [&>li]:mt-2" />
  ),

  li: ({ node, ...props }) => <li {...props} className="overflow-x-auto" />,

  code: ({ node, ...props }) => {
    const match = /language-(\w+)/.exec(props.className || '');
    if (match && props.className !== 'language-latex')
      return (
        <div>
          <div className="flex">
            <div className="ml-auto">
              <CopyButtonIcon
                text={String(props.children).replace(/\n$/, '')}
              />
            </div>
          </div>
          <SyntaxHighlighter
            className="m-0"
            // @ts-expect-error - SyntaxHighlighter style prop has complex type compatibility issues
            style={syntaxHighlighter}
            language={match[1]}
            PreTag="div"
            {...props}
          >
            {String(props.children).replace(/\n$/, '')}
          </SyntaxHighlighter>
        </div>
      );

    return (
      <code
        {...props}
        className={`relative rounded px-[0.3rem] py-[0.2rem] font-mono text-sm ${props.className}`}
      />
    );
  },

  pre: ({ node, ...props }) => (
    <pre {...props} className={`w-full overflow-x-auto bg-gray-200`} />
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
