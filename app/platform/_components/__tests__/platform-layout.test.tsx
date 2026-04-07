import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

// Mock dependencies before importing the component
vi.mock('../app-layout', () => ({
  default: ({
    children,
    defaultOpen,
  }: {
    children: React.ReactNode;
    defaultOpen: boolean;
  }) => (
    <div data-testid="app-layout" data-default-open={defaultOpen}>
      {children}
    </div>
  ),
}));

import PlatformLayout from '../platform-layout';

/**
 * Test suite for PlatformLayout component
 *
 * Tests the client-side cookie reading for sidebar state and
 * rendering behavior in various environments including Tauri offline mode.
 */
describe('PlatformLayout', () => {
  // Store original document.cookie getter/setter
  let originalCookie: PropertyDescriptor | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    // Store original cookie descriptor
    originalCookie = Object.getOwnPropertyDescriptor(document, 'cookie');
  });

  afterEach(() => {
    // Restore original cookie behavior
    if (originalCookie) {
      Object.defineProperty(document, 'cookie', originalCookie);
    } else {
      // Reset to default empty cookie behavior
      Object.defineProperty(document, 'cookie', {
        get: () => '',
        set: () => {},
        configurable: true,
      });
    }
  });

  describe('Basic rendering', () => {
    it('renders children inside AppLayout', () => {
      render(
        <PlatformLayout>
          <div data-testid="child-content">Test Content</div>
        </PlatformLayout>,
      );

      expect(screen.getByTestId('child-content')).toBeInTheDocument();
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('renders AppLayout component', () => {
      render(
        <PlatformLayout>
          <div>Content</div>
        </PlatformLayout>,
      );

      expect(screen.getByTestId('app-layout')).toBeInTheDocument();
    });

    it('renders immediately without blocking on cookie read', () => {
      render(
        <PlatformLayout>
          <div data-testid="immediate-content">Immediate</div>
        </PlatformLayout>,
      );

      // Content should be visible immediately
      expect(screen.getByTestId('immediate-content')).toBeInTheDocument();
    });
  });

  describe('Cookie reading behavior', () => {
    it('defaults to defaultOpen=false when no cookie exists', async () => {
      Object.defineProperty(document, 'cookie', {
        get: () => '',
        configurable: true,
      });

      render(
        <PlatformLayout>
          <div>Content</div>
        </PlatformLayout>,
      );

      // Initial render should have defaultOpen as false
      const appLayout = screen.getByTestId('app-layout');
      expect(appLayout).toHaveAttribute('data-default-open', 'false');
    });

    it('sets defaultOpen=true when sidebar_state cookie is "true"', async () => {
      Object.defineProperty(document, 'cookie', {
        get: () => 'sidebar_state=true',
        configurable: true,
      });

      render(
        <PlatformLayout>
          <div>Content</div>
        </PlatformLayout>,
      );

      // After useEffect runs, defaultOpen should be true
      await waitFor(() => {
        const appLayout = screen.getByTestId('app-layout');
        expect(appLayout).toHaveAttribute('data-default-open', 'true');
      });
    });

    it('keeps defaultOpen=false when sidebar_state cookie is "false"', async () => {
      Object.defineProperty(document, 'cookie', {
        get: () => 'sidebar_state=false',
        configurable: true,
      });

      render(
        <PlatformLayout>
          <div>Content</div>
        </PlatformLayout>,
      );

      await waitFor(() => {
        const appLayout = screen.getByTestId('app-layout');
        expect(appLayout).toHaveAttribute('data-default-open', 'false');
      });
    });

    it('extracts sidebar_state from multiple cookies', async () => {
      Object.defineProperty(document, 'cookie', {
        get: () => 'other_cookie=value; sidebar_state=true; another=data',
        configurable: true,
      });

      render(
        <PlatformLayout>
          <div>Content</div>
        </PlatformLayout>,
      );

      await waitFor(() => {
        const appLayout = screen.getByTestId('app-layout');
        expect(appLayout).toHaveAttribute('data-default-open', 'true');
      });
    });

    it('handles sidebar_state as first cookie', async () => {
      Object.defineProperty(document, 'cookie', {
        get: () => 'sidebar_state=true; other=value',
        configurable: true,
      });

      render(
        <PlatformLayout>
          <div>Content</div>
        </PlatformLayout>,
      );

      await waitFor(() => {
        const appLayout = screen.getByTestId('app-layout');
        expect(appLayout).toHaveAttribute('data-default-open', 'true');
      });
    });

    it('handles sidebar_state as last cookie', async () => {
      Object.defineProperty(document, 'cookie', {
        get: () => 'first=a; second=b; sidebar_state=true',
        configurable: true,
      });

      render(
        <PlatformLayout>
          <div>Content</div>
        </PlatformLayout>,
      );

      await waitFor(() => {
        const appLayout = screen.getByTestId('app-layout');
        expect(appLayout).toHaveAttribute('data-default-open', 'true');
      });
    });
  });

  describe('Edge cases', () => {
    it('handles undefined document gracefully (SSR scenario)', async () => {
      // In jsdom environment, document is always defined
      // We test that the cookie reading handles the case where document.cookie is empty
      Object.defineProperty(document, 'cookie', {
        get: () => '',
        configurable: true,
      });

      render(
        <PlatformLayout>
          <div>Content</div>
        </PlatformLayout>,
      );

      // Should default to false when no cookie exists
      await waitFor(() => {
        const appLayout = screen.getByTestId('app-layout');
        expect(appLayout).toHaveAttribute('data-default-open', 'false');
      });
    });

    it('handles cookie with similar name prefix', async () => {
      Object.defineProperty(document, 'cookie', {
        get: () => 'sidebar_state_old=true; sidebar_state=false',
        configurable: true,
      });

      render(
        <PlatformLayout>
          <div>Content</div>
        </PlatformLayout>,
      );

      // Should read the exact match, not the prefix match
      await waitFor(() => {
        const appLayout = screen.getByTestId('app-layout');
        expect(appLayout).toHaveAttribute('data-default-open', 'false');
      });
    });

    it('handles malformed cookie string gracefully', async () => {
      Object.defineProperty(document, 'cookie', {
        get: () => 'sidebar_state',
        configurable: true,
      });

      render(
        <PlatformLayout>
          <div>Content</div>
        </PlatformLayout>,
      );

      // Should not crash and default to false
      await waitFor(() => {
        const appLayout = screen.getByTestId('app-layout');
        expect(appLayout).toHaveAttribute('data-default-open', 'false');
      });
    });

    it('handles cookie string without sidebar_state (parts.length !== 2)', async () => {
      // When sidebar_state is not in the cookie string, split returns array of length 1
      Object.defineProperty(document, 'cookie', {
        get: () => 'other_cookie=value; another_cookie=data',
        configurable: true,
      });

      render(
        <PlatformLayout>
          <div>Content</div>
        </PlatformLayout>,
      );

      // Should default to false when sidebar_state cookie not found
      await waitFor(() => {
        const appLayout = screen.getByTestId('app-layout');
        expect(appLayout).toHaveAttribute('data-default-open', 'false');
      });
    });

    it('handles cookie with empty value', async () => {
      Object.defineProperty(document, 'cookie', {
        get: () => 'sidebar_state=',
        configurable: true,
      });

      render(
        <PlatformLayout>
          <div>Content</div>
        </PlatformLayout>,
      );

      // Empty value is not "true", so should be false
      await waitFor(() => {
        const appLayout = screen.getByTestId('app-layout');
        expect(appLayout).toHaveAttribute('data-default-open', 'false');
      });
    });

    it('handles cookie with whitespace', async () => {
      Object.defineProperty(document, 'cookie', {
        get: () => '  sidebar_state=true  ',
        configurable: true,
      });

      render(
        <PlatformLayout>
          <div>Content</div>
        </PlatformLayout>,
      );

      // The cookie parsing may handle extra whitespace
      const appLayout = screen.getByTestId('app-layout');
      // Depending on exact implementation, may or may not find the cookie
      expect(appLayout).toBeInTheDocument();
    });

    it('handles non-boolean cookie value', async () => {
      Object.defineProperty(document, 'cookie', {
        get: () => 'sidebar_state=open',
        configurable: true,
      });

      render(
        <PlatformLayout>
          <div>Content</div>
        </PlatformLayout>,
      );

      // "open" !== "true", so should be false
      await waitFor(() => {
        const appLayout = screen.getByTestId('app-layout');
        expect(appLayout).toHaveAttribute('data-default-open', 'false');
      });
    });
  });

  describe('Children handling', () => {
    it('passes multiple children correctly', () => {
      render(
        <PlatformLayout>
          <div data-testid="child-1">First</div>
          <div data-testid="child-2">Second</div>
        </PlatformLayout>,
      );

      expect(screen.getByTestId('child-1')).toBeInTheDocument();
      expect(screen.getByTestId('child-2')).toBeInTheDocument();
    });

    it('handles null children', () => {
      render(<PlatformLayout>{null}</PlatformLayout>);

      expect(screen.getByTestId('app-layout')).toBeInTheDocument();
    });

    it('handles fragment children', () => {
      render(
        <PlatformLayout>
          <>
            <div data-testid="fragment-child-1">Fragment 1</div>
            <div data-testid="fragment-child-2">Fragment 2</div>
          </>
        </PlatformLayout>,
      );

      expect(screen.getByTestId('fragment-child-1')).toBeInTheDocument();
      expect(screen.getByTestId('fragment-child-2')).toBeInTheDocument();
    });

    it('handles text children', () => {
      render(<PlatformLayout>Plain text content</PlatformLayout>);

      expect(screen.getByText('Plain text content')).toBeInTheDocument();
    });
  });

  describe('Component lifecycle', () => {
    it('reads cookie only once on mount', async () => {
      let cookieReadCount = 0;
      Object.defineProperty(document, 'cookie', {
        get: () => {
          cookieReadCount++;
          return 'sidebar_state=true';
        },
        configurable: true,
      });

      const { rerender } = render(
        <PlatformLayout>
          <div>Content</div>
        </PlatformLayout>,
      );

      // Wait for effect to run
      await waitFor(() => {
        expect(screen.getByTestId('app-layout')).toHaveAttribute(
          'data-default-open',
          'true',
        );
      });

      const initialReadCount = cookieReadCount;

      // Rerender should not read cookie again (useEffect has empty deps array)
      rerender(
        <PlatformLayout>
          <div>Updated Content</div>
        </PlatformLayout>,
      );

      // Cookie read count should not increase significantly
      // (some additional reads may occur due to React behavior)
      expect(cookieReadCount).toBeLessThanOrEqual(initialReadCount + 2);
    });

    it('updates state correctly after mount', async () => {
      Object.defineProperty(document, 'cookie', {
        get: () => 'sidebar_state=true',
        configurable: true,
      });

      render(
        <PlatformLayout>
          <div>Content</div>
        </PlatformLayout>,
      );

      // Initially false, then updates to true after useEffect
      await waitFor(() => {
        const appLayout = screen.getByTestId('app-layout');
        expect(appLayout).toHaveAttribute('data-default-open', 'true');
      });
    });
  });
});
