import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow as syntaxHighlighter } from 'react-syntax-highlighter/dist/esm/styles/prism';

export interface HighlightedCodeProps {
  code: string;
  language: string;
}

// The heavy chunk: react-syntax-highlighter's Prism build bundles every
// language grammar (~hundreds of KB). It lives in its own module so it is only
// downloaded when a message actually contains a code block — see
// code-block-body.tsx, which loads this lazily.
export default function HighlightedCode({
  code,
  language,
}: HighlightedCodeProps) {
  return (
    <SyntaxHighlighter
      // The theme's inline styles carry a `.5em 0` margin and no radius; drop
      // the margin so the body sits flush under the code-block header bar.
      className="m-0!"
      style={syntaxHighlighter}
      language={language}
      PreTag="div"
    >
      {code}
    </SyntaxHighlighter>
  );
}
