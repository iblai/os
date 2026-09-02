import type { ComponentPropsWithoutRef } from 'react';
import { Streamdown } from 'streamdown';

import { CopyButtonIcon } from '@/components/copy-button-icon';
import { CodeBlockBody } from './code-block-body';

type Components = ComponentPropsWithoutRef<typeof Streamdown>['components'];

// Only `code` and `pre` are overridden. Every other element keeps Streamdown's
// own component, which is prestyled -- the app-specific chrome that has to
// survive is the dark code block, kept here so chat code blocks look the way
// they always have rather than adopting Streamdown's light default.
export const components: Components = {
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
        className={`relative rounded px-[0.3rem] py-[0.2rem] font-mono text-sm ${props.className ?? ''}`}
      />
    );
  },

  pre: ({ node, ...props }) => (
    <pre
      {...props}
      className="w-full overflow-x-auto bg-gray-200 has-[[data-code-block]]:m-0! has-[[data-code-block]]:bg-transparent! has-[[data-code-block]]:p-0!"
    />
  ),
};
