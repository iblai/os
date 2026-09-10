/**
 * @file markdown-error-boundary.tsx
 * @input The markdown source a render is about to run on, and that render
 * @output The render, or -- when it throws -- the source as plain text
 * @position Inside components/markdown.tsx, around its own Streamdown body,
 *   so all 28 `<Markdown>` call sites are covered without touching one of
 *   them.
 *
 * Before this, a single unparseable message took the whole conversation down:
 * React unwound to the ErrorBoundary wrapping the message list in
 * components/chat/index.tsx, and every message went with it. The message is
 * persisted, so it re-parsed and re-threw on every load -- the conversation
 * was unreachable forever, not broken once. Sentry c47052cc reached production
 * on ordinary prose (an em dash beside a URL) and forced a revert.
 *
 * The fallback is the CONTENT, not an apology: `Markdown` is handed the raw
 * source, so a failed render costs the reader formatting, never information.
 *
 * The reset is `componentDidUpdate` comparing the previous source, NOT a React
 * `key`. Streaming changes the content on every token; a key would remount the
 * whole Streamdown subtree each time. Comparing instead means a transient
 * throw on a half-arrived message clears itself the moment more text lands.
 */
import { Component, type ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';

import { cn } from '@/lib/utils';
import { reportMarkdownRenderFailure } from '@/lib/markdown-render-error-reporter';

type Props = {
  source?: string;
  className?: string;
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export class MarkdownErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false };

  public static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error) {
    reportMarkdownRenderFailure(error, this.props.source ?? '');
  }

  public componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.source !== this.props.source) {
      this.setState({ hasError: false });
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div
          className={cn('space-y-2', this.props.className)}
          data-testid="markdown-plain-fallback"
        >
          <p className="flex items-center gap-1.5 text-xs text-gray-500">
            <TriangleAlert className="h-3.5 w-3.5 flex-none" />
            <span>This message couldn&apos;t be displayed properly.</span>
          </p>
          <div className="whitespace-pre-wrap">{this.props.source}</div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default MarkdownErrorBoundary;
