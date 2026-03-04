import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock next-themes
vi.mock('next-themes', () => ({
  ThemeProvider: ({ children, ...props }: { children: React.ReactNode }) => (
    <div data-testid="theme-provider" data-props={JSON.stringify(props)}>
      {children}
    </div>
  ),
}));

import { ThemeProvider } from '../theme-provider';

describe('ThemeProvider', () => {
  it('should render children', () => {
    render(
      <ThemeProvider>
        <div data-testid="child">Test Child</div>
      </ThemeProvider>,
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Test Child')).toBeInTheDocument();
  });

  it('should pass props to NextThemesProvider', () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <div>Test</div>
      </ThemeProvider>,
    );

    const provider = screen.getByTestId('theme-provider');
    expect(provider).toBeInTheDocument();
  });

  it('should render without props', () => {
    render(
      <ThemeProvider>
        <span>Content</span>
      </ThemeProvider>,
    );

    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('should accept storageKey prop', () => {
    render(
      <ThemeProvider storageKey="mentor-theme">
        <div>Test</div>
      </ThemeProvider>,
    );

    expect(screen.getByTestId('theme-provider')).toBeInTheDocument();
  });

  it('should accept disableTransitionOnChange prop', () => {
    render(
      <ThemeProvider disableTransitionOnChange>
        <div>Test</div>
      </ThemeProvider>,
    );

    expect(screen.getByTestId('theme-provider')).toBeInTheDocument();
  });
});
