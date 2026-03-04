declare namespace JSX {
  interface IntrinsicElements {
    "mentor-ai": React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        mentorUrl?: string;
        authUrl?: string;
        lmsUrl?: string;
        tenant?: string;
        mentor?: string;
        authRelyOnHost?: boolean;
        component?: string;
        theme?: string;
      },
      HTMLElement
    >;
  }
}
