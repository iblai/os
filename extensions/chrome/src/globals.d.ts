import type { DetailedHTMLProps, HTMLAttributes } from 'react';

// The vendored @iblai/agent-ai bundle registers <agent-ai> at load time; React
// renders it as a custom element, so JSX needs to know its attributes.
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'agent-ai': DetailedHTMLProps<
        HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        mentorurl?: string;
        authurl?: string;
        lmsurl?: string;
        theme?: 'dark' | 'light';
        component?: string;
        authrelyonhost?: string;
      };
    }
  }
}
