import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { WebContainersLocaleProvider } from '../web-containers-locale-provider';

// next-intl's useLocale is mocked globally in vitest.setup.ts to return 'en'.
// Capture the locale forwarded into the web-containers provider.
let receivedLocale: string | undefined;
vi.mock('@iblai/iblai-js/web-containers/next', () => ({
  WebContainersI18nProvider: ({
    locale,
    children,
  }: {
    locale: string;
    children: React.ReactNode;
  }) => {
    receivedLocale = locale;
    return <div data-testid="wc-i18n-provider">{children}</div>;
  },
}));

describe('WebContainersLocaleProvider', () => {
  beforeEach(() => {
    cleanup();
    receivedLocale = undefined;
  });

  it('forwards the active locale and renders children', () => {
    render(
      <WebContainersLocaleProvider>
        <span>child-content</span>
      </WebContainersLocaleProvider>,
    );

    expect(screen.getByTestId('wc-i18n-provider')).toBeInTheDocument();
    expect(screen.getByText('child-content')).toBeInTheDocument();
    expect(receivedLocale).toBe('en');
  });
});
