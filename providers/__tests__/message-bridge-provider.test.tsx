import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MessageBridgeProvider } from '../message-bridge-provider';

describe('MessageBridgeProvider', () => {
  let originalOpener: typeof window.opener;
  let mockPostMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    originalOpener = window.opener;
    mockPostMessage = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    // Restore window.opener
    Object.defineProperty(window, 'opener', {
      value: originalOpener,
      writable: true,
      configurable: true,
    });
  });

  describe('Basic rendering', () => {
    it('renders children correctly', () => {
      render(
        <MessageBridgeProvider>
          <div data-testid="child">Test Content</div>
        </MessageBridgeProvider>,
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('renders multiple children', () => {
      render(
        <MessageBridgeProvider>
          <div>Child 1</div>
          <div>Child 2</div>
        </MessageBridgeProvider>,
      );

      expect(screen.getByText('Child 1')).toBeInTheDocument();
      expect(screen.getByText('Child 2')).toBeInTheDocument();
    });

    it('handles null children', () => {
      const { container } = render(
        <MessageBridgeProvider>{null}</MessageBridgeProvider>,
      );
      expect(container).toBeTruthy();
    });

    it('handles fragment children', () => {
      render(
        <MessageBridgeProvider>
          <>
            <span>Fragment 1</span>
            <span>Fragment 2</span>
          </>
        </MessageBridgeProvider>,
      );

      expect(screen.getByText('Fragment 1')).toBeInTheDocument();
      expect(screen.getByText('Fragment 2')).toBeInTheDocument();
    });
  });

  describe('Tab registration (window.opener)', () => {
    it('sends MENTOR:REGISTER_TAB message when window.opener exists', () => {
      // Mock window.opener
      Object.defineProperty(window, 'opener', {
        value: { postMessage: mockPostMessage },
        writable: true,
        configurable: true,
      });

      render(
        <MessageBridgeProvider>
          <div>Content</div>
        </MessageBridgeProvider>,
      );

      // Initial registration should have happened
      expect(mockPostMessage).toHaveBeenCalledWith(
        { type: 'MENTOR:REGISTER_TAB' },
        '*',
      );
    });

    it('re-registers every 2 seconds (heartbeat)', () => {
      Object.defineProperty(window, 'opener', {
        value: { postMessage: mockPostMessage },
        writable: true,
        configurable: true,
      });

      render(
        <MessageBridgeProvider>
          <div>Content</div>
        </MessageBridgeProvider>,
      );

      // Initial call
      expect(mockPostMessage).toHaveBeenCalledTimes(1);

      // Advance time by 2 seconds
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(mockPostMessage).toHaveBeenCalledTimes(2);

      // Advance another 2 seconds
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(mockPostMessage).toHaveBeenCalledTimes(3);

      // Advance 4 more seconds (2 more intervals)
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(mockPostMessage).toHaveBeenCalledTimes(5);
    });

    it('cleans up interval on unmount', () => {
      Object.defineProperty(window, 'opener', {
        value: { postMessage: mockPostMessage },
        writable: true,
        configurable: true,
      });

      const { unmount } = render(
        <MessageBridgeProvider>
          <div>Content</div>
        </MessageBridgeProvider>,
      );

      // Initial call
      expect(mockPostMessage).toHaveBeenCalledTimes(1);

      // Unmount the component
      unmount();

      // Advance time - should not trigger more calls since interval is cleared
      act(() => {
        vi.advanceTimersByTime(6000);
      });

      // Should still be 1 (no more calls after unmount)
      expect(mockPostMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe('No opener scenario', () => {
    it('does not attempt to post message when window.opener is null', () => {
      Object.defineProperty(window, 'opener', {
        value: null,
        writable: true,
        configurable: true,
      });

      render(
        <MessageBridgeProvider>
          <div>Content</div>
        </MessageBridgeProvider>,
      );

      // No postMessage should have been called
      expect(mockPostMessage).not.toHaveBeenCalled();
    });

    it('handles undefined window.opener', () => {
      Object.defineProperty(window, 'opener', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      // Should not throw
      expect(() =>
        render(
          <MessageBridgeProvider>
            <div>Content</div>
          </MessageBridgeProvider>,
        ),
      ).not.toThrow();
    });
  });
});
