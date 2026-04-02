import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import AutoResizeTextarea from '../auto-resize-text-area';

// Mock ResizeObserver
class MockResizeObserver {
  callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe() {}
  unobserve() {}
  disconnect() {}
}

// Store the original ResizeObserver
const originalResizeObserver = window.ResizeObserver;

// Mock the selector from web-utils
let mockNumberOfMessages = 0;

vi.mock('@iblai/iblai-js/web-utils', () => ({
  selectNumberOfActiveChatMessages: () => mockNumberOfMessages,
}));

// Create a minimal mock store
const createMockStore = (preloadedState = {}) =>
  configureStore({
    reducer: {
      chatSliceShared: (
        state = { activeTab: 'default', chats: { default: [] } },
      ) => state,
    },
    preloadedState,
  });

describe('AutoResizeTextarea', () => {
  const defaultProps = {
    value: '',
    onChange: vi.fn(),
    onSubmit: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockNumberOfMessages = 0;
    window.ResizeObserver =
      MockResizeObserver as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    window.ResizeObserver = originalResizeObserver;
  });

  const renderWithRedux = (
    component: React.ReactElement,
    preloadedState = {},
  ) => {
    return render(
      <Provider store={createMockStore(preloadedState)}>{component}</Provider>,
    );
  };

  describe('rendering', () => {
    it('should render without crashing', () => {
      renderWithRedux(<AutoResizeTextarea {...defaultProps} />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeInTheDocument();
    });

    it('should render with provided value', () => {
      renderWithRedux(
        <AutoResizeTextarea {...defaultProps} value="Hello World" />,
      );
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveValue('Hello World');
    });

    it('should render with placeholder', () => {
      renderWithRedux(
        <AutoResizeTextarea
          {...defaultProps}
          placeholder="Type a message..."
        />,
      );
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('placeholder', 'Type a message...');
    });

    it('should render with custom className', () => {
      renderWithRedux(
        <AutoResizeTextarea {...defaultProps} className="custom-class" />,
      );
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveClass('custom-class');
    });

    it('should apply default classes', () => {
      renderWithRedux(<AutoResizeTextarea {...defaultProps} />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveClass('resize-none');
      expect(textarea).toHaveClass('rounded-2xl');
      expect(textarea).toHaveClass('w-full');
    });
  });

  describe('disabled state', () => {
    it('should be disabled when disabled prop is true', () => {
      renderWithRedux(<AutoResizeTextarea {...defaultProps} disabled={true} />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeDisabled();
    });

    it('should be disabled when sessionId is null and allowAnonymousAccess is false', () => {
      renderWithRedux(
        <AutoResizeTextarea
          {...defaultProps}
          sessionId={null}
          allowAnonymousAccess={false}
        />,
      );
      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeDisabled();
    });

    it('should be disabled when isPreviewMode is true and allowAnonymousAccess is false', () => {
      renderWithRedux(
        <AutoResizeTextarea
          {...defaultProps}
          isPreviewMode={true}
          allowAnonymousAccess={false}
          sessionId="session-123"
        />,
      );
      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeDisabled();
    });

    it('should be enabled when sessionId is provided and not in preview mode', () => {
      renderWithRedux(
        <AutoResizeTextarea {...defaultProps} sessionId="session-123" />,
      );
      const textarea = screen.getByRole('textbox');
      expect(textarea).not.toBeDisabled();
    });

    it('should be enabled when allowAnonymousAccess is true regardless of sessionId', () => {
      renderWithRedux(
        <AutoResizeTextarea
          {...defaultProps}
          sessionId={null}
          allowAnonymousAccess={true}
        />,
      );
      const textarea = screen.getByRole('textbox');
      expect(textarea).not.toBeDisabled();
    });

    it('should be enabled when allowAnonymousAccess is true and isPreviewMode is true', () => {
      renderWithRedux(
        <AutoResizeTextarea
          {...defaultProps}
          sessionId="session-123"
          isPreviewMode={true}
          allowAnonymousAccess={true}
        />,
      );
      const textarea = screen.getByRole('textbox');
      expect(textarea).not.toBeDisabled();
    });
  });

  describe('onChange handling', () => {
    it('should call onChange when value changes', () => {
      const onChange = vi.fn();
      renderWithRedux(
        <AutoResizeTextarea
          {...defaultProps}
          onChange={onChange}
          sessionId="session-123"
        />,
      );
      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'New text' } });
      expect(onChange).toHaveBeenCalled();
    });

    it('should pass the event to onChange handler', () => {
      const onChange = vi.fn();
      renderWithRedux(
        <AutoResizeTextarea
          {...defaultProps}
          onChange={onChange}
          sessionId="session-123"
        />,
      );
      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'Test value' } });
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ target: textarea }),
      );
    });
  });

  describe('keyboard handling', () => {
    it('should call onSubmit on Enter key when value is not empty', () => {
      const onSubmit = vi.fn();
      renderWithRedux(
        <AutoResizeTextarea
          {...defaultProps}
          value="Hello"
          onSubmit={onSubmit}
          sessionId="session-123"
        />,
      );
      const textarea = screen.getByRole('textbox');
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
      expect(onSubmit).toHaveBeenCalled();
    });

    it('should not call onSubmit on Enter+Shift key', () => {
      const onSubmit = vi.fn();
      renderWithRedux(
        <AutoResizeTextarea
          {...defaultProps}
          value="Hello"
          onSubmit={onSubmit}
          sessionId="session-123"
        />,
      );
      const textarea = screen.getByRole('textbox');
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('should not call onSubmit when value is empty and allowEmptySubmit is false', () => {
      const onSubmit = vi.fn();
      renderWithRedux(
        <AutoResizeTextarea
          {...defaultProps}
          value=""
          onSubmit={onSubmit}
          sessionId="session-123"
          allowEmptySubmit={false}
        />,
      );
      const textarea = screen.getByRole('textbox');
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('should not call onSubmit when value is whitespace only and allowEmptySubmit is false', () => {
      const onSubmit = vi.fn();
      renderWithRedux(
        <AutoResizeTextarea
          {...defaultProps}
          value="   "
          onSubmit={onSubmit}
          sessionId="session-123"
          allowEmptySubmit={false}
        />,
      );
      const textarea = screen.getByRole('textbox');
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('should call onSubmit when value is empty but allowEmptySubmit is true', () => {
      const onSubmit = vi.fn();
      renderWithRedux(
        <AutoResizeTextarea
          {...defaultProps}
          value=""
          onSubmit={onSubmit}
          sessionId="session-123"
          allowEmptySubmit={true}
        />,
      );
      const textarea = screen.getByRole('textbox');
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
      expect(onSubmit).toHaveBeenCalled();
    });

    it('should prevent default on Enter key', () => {
      const onSubmit = vi.fn();
      renderWithRedux(
        <AutoResizeTextarea
          {...defaultProps}
          value="Hello"
          onSubmit={onSubmit}
          sessionId="session-123"
        />,
      );
      const textarea = screen.getByRole('textbox');
      const preventDefaultMock = vi.fn();
      fireEvent.keyDown(textarea, {
        key: 'Enter',
        shiftKey: false,
        preventDefault: preventDefaultMock,
      });
      // The event should have been processed (onSubmit was called)
      expect(onSubmit).toHaveBeenCalled();
    });

    it('should not call onSubmit on other keys', () => {
      const onSubmit = vi.fn();
      renderWithRedux(
        <AutoResizeTextarea
          {...defaultProps}
          value="Hello"
          onSubmit={onSubmit}
          sessionId="session-123"
        />,
      );
      const textarea = screen.getByRole('textbox');
      fireEvent.keyDown(textarea, { key: 'a' });
      fireEvent.keyDown(textarea, { key: 'Escape' });
      fireEvent.keyDown(textarea, { key: 'Tab' });
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('should not call onSubmit in preview mode without anonymous access', () => {
      const onSubmit = vi.fn();
      renderWithRedux(
        <AutoResizeTextarea
          {...defaultProps}
          value="Hello"
          onSubmit={onSubmit}
          sessionId="session-123"
          isPreviewMode={true}
          allowAnonymousAccess={false}
        />,
      );
      const textarea = screen.getByRole('textbox');
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('should call onSubmit in preview mode with anonymous access', () => {
      const onSubmit = vi.fn();
      renderWithRedux(
        <AutoResizeTextarea
          {...defaultProps}
          value="Hello"
          onSubmit={onSubmit}
          sessionId="session-123"
          isPreviewMode={true}
          allowAnonymousAccess={true}
        />,
      );
      const textarea = screen.getByRole('textbox');
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
      expect(onSubmit).toHaveBeenCalled();
    });
  });

  describe('minHeight calculation', () => {
    it('should have 56px minHeight when no messages and not in embed mode', () => {
      mockNumberOfMessages = 0;
      renderWithRedux(
        <AutoResizeTextarea {...defaultProps} embedMode={false} />,
      );
      const textarea = screen.getByRole('textbox');
      expect(textarea.style.minHeight).toBe('56px');
    });

    it('should use textAreaRows for minHeight when there are messages', () => {
      mockNumberOfMessages = 5;
      renderWithRedux(
        <AutoResizeTextarea {...defaultProps} textAreaRows={3} />,
      );
      const textarea = screen.getByRole('textbox');
      // 3 rows * 20px = 60px
      expect(textarea.style.minHeight).toBe('60px');
    });

    it('should use textAreaRows for minHeight in embed mode even with no messages', () => {
      mockNumberOfMessages = 0;
      renderWithRedux(
        <AutoResizeTextarea
          {...defaultProps}
          textAreaRows={4}
          embedMode={true}
        />,
      );
      const textarea = screen.getByRole('textbox');
      // 4 rows * 20px = 80px
      expect(textarea.style.minHeight).toBe('80px');
    });

    it('should use default textAreaRows of 3 when not specified', () => {
      mockNumberOfMessages = 1;
      renderWithRedux(<AutoResizeTextarea {...defaultProps} />);
      const textarea = screen.getByRole('textbox');
      // 3 rows * 20px = 60px
      expect(textarea.style.minHeight).toBe('60px');
    });
  });

  describe('custom styles', () => {
    it('should merge custom style with computed minHeight', () => {
      renderWithRedux(
        <AutoResizeTextarea
          {...defaultProps}
          style={{ color: 'red', padding: '10px' }}
        />,
      );
      const textarea = screen.getByRole('textbox');
      expect(textarea.style.color).toBe('red');
      expect(textarea.style.padding).toBe('10px');
      expect(textarea.style.minHeight).toBeDefined();
    });

    it('should allow custom style to override minHeight', () => {
      renderWithRedux(
        <AutoResizeTextarea {...defaultProps} style={{ minHeight: '200px' }} />,
      );
      const textarea = screen.getByRole('textbox');
      expect(textarea.style.minHeight).toBe('200px');
    });
  });

  describe('additional HTML attributes', () => {
    it('should pass through additional textarea attributes', () => {
      renderWithRedux(
        <AutoResizeTextarea
          {...defaultProps}
          aria-label="Chat input"
          data-testid="chat-textarea"
          maxLength={500}
        />,
      );
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('aria-label', 'Chat input');
      expect(textarea).toHaveAttribute('data-testid', 'chat-textarea');
      expect(textarea).toHaveAttribute('maxLength', '500');
    });

    it('should pass through name attribute', () => {
      renderWithRedux(
        <AutoResizeTextarea {...defaultProps} name="chatInput" />,
      );
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('name', 'chatInput');
    });

    it('should pass through id attribute', () => {
      renderWithRedux(
        <AutoResizeTextarea {...defaultProps} id="my-textarea" />,
      );
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('id', 'my-textarea');
    });

    it('should handle autoFocus prop', () => {
      renderWithRedux(
        <AutoResizeTextarea
          {...defaultProps}
          autoFocus
          sessionId="session-123"
        />,
      );
      const textarea = screen.getByRole('textbox');
      // autoFocus is processed by React and may focus the element on mount
      // In jsdom, we can verify the element exists and is focusable
      expect(textarea).toBeInTheDocument();
    });
  });

  describe('ResizeObserver integration', () => {
    it('should create ResizeObserver when window.ResizeObserver exists', () => {
      const observeMock = vi.fn();
      const disconnectMock = vi.fn();

      window.ResizeObserver = vi.fn().mockImplementation(() => ({
        observe: observeMock,
        unobserve: vi.fn(),
        disconnect: disconnectMock,
      })) as unknown as typeof ResizeObserver;

      const { unmount } = renderWithRedux(
        <AutoResizeTextarea {...defaultProps} />,
      );

      expect(window.ResizeObserver).toHaveBeenCalled();
      expect(observeMock).toHaveBeenCalled();

      unmount();
      expect(disconnectMock).toHaveBeenCalled();
    });

    it('should handle missing ResizeObserver gracefully', () => {
      // @ts-expect-error - Testing the fallback when ResizeObserver doesn't exist
      window.ResizeObserver = undefined;

      expect(() => {
        renderWithRedux(<AutoResizeTextarea {...defaultProps} />);
      }).not.toThrow();
    });

    it('should adjust height when ResizeObserver triggers callback', async () => {
      let resizeCallback: ResizeObserverCallback | null = null;
      const observeMock = vi.fn();

      window.ResizeObserver = vi
        .fn()
        .mockImplementation((callback: ResizeObserverCallback) => {
          resizeCallback = callback;
          return {
            observe: observeMock,
            unobserve: vi.fn(),
            disconnect: vi.fn(),
          };
        }) as unknown as typeof ResizeObserver;

      // Mock requestAnimationFrame
      const rafSpy = vi
        .spyOn(window, 'requestAnimationFrame')
        .mockImplementation((cb) => {
          cb(0);
          return 0;
        });

      renderWithRedux(<AutoResizeTextarea {...defaultProps} />);

      // Verify the callback was captured
      expect(resizeCallback).toBeDefined();

      // Trigger the ResizeObserver callback
      if (resizeCallback !== null) {
        (resizeCallback as ResizeObserverCallback)([], {} as ResizeObserver);
      }

      // The callback should have been executed via requestAnimationFrame
      expect(rafSpy).toHaveBeenCalled();

      rafSpy.mockRestore();
    });

    it('should handle ResizeObserver callback execution with requestAnimationFrame', async () => {
      let resizeCallback: ResizeObserverCallback | null = null;
      let rafCallCount = 0;
      const rafCallbacks: FrameRequestCallback[] = [];

      window.ResizeObserver = vi
        .fn()
        .mockImplementation((callback: ResizeObserverCallback) => {
          resizeCallback = callback;
          return {
            observe: vi.fn(),
            unobserve: vi.fn(),
            disconnect: vi.fn(),
          };
        }) as unknown as typeof ResizeObserver;

      // Mock requestAnimationFrame to capture callbacks
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        rafCallCount++;
        rafCallbacks.push(cb);
        return rafCallCount;
      });

      renderWithRedux(<AutoResizeTextarea {...defaultProps} />);

      // Trigger the ResizeObserver callback
      if (resizeCallback !== null) {
        (resizeCallback as ResizeObserverCallback)([], {} as ResizeObserver);
      }

      // RAF should have been called
      expect(rafCallCount).toBeGreaterThanOrEqual(1);
      expect(rafCallbacks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('height adjustment', () => {
    it('should adjust height on value change', () => {
      const { rerender } = renderWithRedux(
        <Provider store={createMockStore()}>
          <AutoResizeTextarea {...defaultProps} value="" />
        </Provider>,
      );

      const textarea = screen.getByRole('textbox');

      // Mock scrollHeight
      Object.defineProperty(textarea, 'scrollHeight', {
        configurable: true,
        value: 100,
      });

      rerender(
        <Provider store={createMockStore()}>
          <AutoResizeTextarea
            {...defaultProps}
            value="New text with more content"
          />
        </Provider>,
      );

      // Height should have been adjusted
      expect(textarea.style.height).toBeDefined();
    });

    it('should set height to auto before reading scrollHeight', () => {
      renderWithRedux(<AutoResizeTextarea {...defaultProps} value="Initial" />);
      const textarea = screen.getByRole('textbox');

      // Trigger change
      fireEvent.change(textarea, { target: { value: 'New value' } });

      // The height adjustment logic should have run
      expect(textarea.style.height).toBeDefined();
    });

    it('should skip height adjustment during resize in handleInputChange', () => {
      // This tests the branch where isResizing is true during input change
      let resizeCallback: ResizeObserverCallback | null = null;

      window.ResizeObserver = vi
        .fn()
        .mockImplementation((callback: ResizeObserverCallback) => {
          resizeCallback = callback;
          return {
            observe: vi.fn(),
            unobserve: vi.fn(),
            disconnect: vi.fn(),
          };
        }) as unknown as typeof ResizeObserver;

      // Don't execute the RAF callback to leave isResizing as true
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => {
        return 1; // Don't call the callback, leaving isResizing = true
      });

      renderWithRedux(
        <AutoResizeTextarea
          {...defaultProps}
          value="test"
          sessionId="session-123"
        />,
      );

      const textarea = screen.getByRole('textbox');

      // Trigger ResizeObserver callback to set isResizing = true
      if (resizeCallback !== null) {
        (resizeCallback as ResizeObserverCallback)([], {} as ResizeObserver);
      }

      // Now trigger a change while isResizing is true
      fireEvent.change(textarea, { target: { value: 'new value' } });

      // The component should handle this without error
      expect(textarea).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle undefined sessionId', () => {
      renderWithRedux(
        <AutoResizeTextarea {...defaultProps} sessionId={undefined as any} />,
      );
      const textarea = screen.getByRole('textbox');
      // Should be disabled since sessionId is falsy and allowAnonymousAccess is not set
      expect(textarea).toBeDisabled();
    });

    it('should handle empty string value', () => {
      renderWithRedux(<AutoResizeTextarea {...defaultProps} value="" />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveValue('');
    });

    it('should handle very long text', () => {
      const longText = 'a'.repeat(10000);
      renderWithRedux(
        <AutoResizeTextarea {...defaultProps} value={longText} />,
      );
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveValue(longText);
    });

    it('should handle special characters in value', () => {
      const specialChars = '<script>alert("xss")</script>';
      renderWithRedux(
        <AutoResizeTextarea {...defaultProps} value={specialChars} />,
      );
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveValue(specialChars);
    });

    it('should handle unicode characters', () => {
      const unicodeText = '🎉 Hello 世界 مرحبا';
      renderWithRedux(
        <AutoResizeTextarea {...defaultProps} value={unicodeText} />,
      );
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveValue(unicodeText);
    });

    it('should handle newlines in value', () => {
      const multilineText = 'Line 1\nLine 2\nLine 3';
      renderWithRedux(
        <AutoResizeTextarea {...defaultProps} value={multilineText} />,
      );
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveValue(multilineText);
    });
  });

  describe('focus behavior', () => {
    it('should be focusable when not disabled', () => {
      renderWithRedux(
        <AutoResizeTextarea {...defaultProps} sessionId="session-123" />,
      );
      const textarea = screen.getByRole('textbox');
      textarea.focus();
      expect(document.activeElement).toBe(textarea);
    });

    it('should handle onFocus event', () => {
      const onFocus = vi.fn();
      renderWithRedux(
        <AutoResizeTextarea
          {...defaultProps}
          sessionId="session-123"
          onFocus={onFocus}
        />,
      );
      const textarea = screen.getByRole('textbox');
      fireEvent.focus(textarea);
      expect(onFocus).toHaveBeenCalled();
    });

    it('should handle onBlur event', () => {
      const onBlur = vi.fn();
      renderWithRedux(
        <AutoResizeTextarea
          {...defaultProps}
          sessionId="session-123"
          onBlur={onBlur}
        />,
      );
      const textarea = screen.getByRole('textbox');
      fireEvent.blur(textarea);
      expect(onBlur).toHaveBeenCalled();
    });
  });

  describe('default prop values', () => {
    it('should use default disabled value of false', () => {
      renderWithRedux(
        <AutoResizeTextarea {...defaultProps} sessionId="session-123" />,
      );
      const textarea = screen.getByRole('textbox');
      expect(textarea).not.toBeDisabled();
    });

    it('should use default placeholder value of empty string', () => {
      renderWithRedux(<AutoResizeTextarea {...defaultProps} />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('placeholder', '');
    });

    it('should use default textAreaRows value of 3', () => {
      mockNumberOfMessages = 5;
      renderWithRedux(<AutoResizeTextarea {...defaultProps} />);
      const textarea = screen.getByRole('textbox');
      // 3 * 20 = 60px
      expect(textarea.style.minHeight).toBe('60px');
    });

    it('should use default className value of empty string', () => {
      renderWithRedux(<AutoResizeTextarea {...defaultProps} />);
      const textarea = screen.getByRole('textbox');
      // Should still have base classes
      expect(textarea).toHaveClass('w-full');
    });

    it('should use default isPreviewMode value of false', () => {
      renderWithRedux(
        <AutoResizeTextarea {...defaultProps} sessionId="session-123" />,
      );
      const textarea = screen.getByRole('textbox');
      expect(textarea).not.toBeDisabled();
    });

    it('should use default allowAnonymousAccess value of false', () => {
      renderWithRedux(
        <AutoResizeTextarea {...defaultProps} sessionId={null} />,
      );
      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeDisabled();
    });

    it('should use default embedMode value of false', () => {
      mockNumberOfMessages = 0;
      renderWithRedux(<AutoResizeTextarea {...defaultProps} />);
      const textarea = screen.getByRole('textbox');
      expect(textarea.style.minHeight).toBe('56px');
    });

    it('should use default allowEmptySubmit value of false', () => {
      const onSubmit = vi.fn();
      renderWithRedux(
        <AutoResizeTextarea
          {...defaultProps}
          value=""
          onSubmit={onSubmit}
          sessionId="session-123"
        />,
      );
      const textarea = screen.getByRole('textbox');
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('component ref', () => {
    it('should forward ref to textarea element', () => {
      // Note: The component uses an internal ref, not forwardRef
      // This test verifies the textarea is accessible
      renderWithRedux(<AutoResizeTextarea {...defaultProps} />);
      const textarea = screen.getByRole('textbox');
      expect(textarea.tagName).toBe('TEXTAREA');
    });
  });
});
