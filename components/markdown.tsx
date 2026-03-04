import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import ReactMarkdown from 'react-markdown';

import 'katex/dist/katex.min.css';
import { preprocessLaTeX, cn } from '@/lib/utils';
import { components } from './markdown/markdown-components';

type Props = {
  children?: string;
  className?: string;
};

export default function Markdown({ children, className }: Props) {
  return (
    <div className={cn('space-y-4', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex, rehypeRaw]}
        components={components}
        urlTransform={(url) => {
          // Allow mailto:, tel:, and http(s): protocols
          if (
            url.startsWith('mailto:') ||
            url.startsWith('tel:') ||
            url.startsWith('http://') ||
            url.startsWith('https://')
          ) {
            return url;
          }
          return '';
        }}
      >
        {preprocessLaTeX(children ?? '')}
      </ReactMarkdown>
    </div>
  );
}
