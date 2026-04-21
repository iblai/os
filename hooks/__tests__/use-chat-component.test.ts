import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChatComponent } from '../use-chat-component';

describe('useChatComponent', () => {
  let mentorElement: HTMLElement;
  let mockIframe: HTMLIFrameElement;
  let mockPostMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock iframe with postMessage
    mockPostMessage = vi.fn();
    mockIframe = document.createElement('iframe');
    Object.defineProperty(mockIframe, 'contentWindow', {
      value: {
        postMessage: mockPostMessage,
      },
      writable: true,
      configurable: true,
    });

    // Create mock shadow DOM with iframe
    const shadowRoot = document.createElement('div');
    shadowRoot.appendChild(mockIframe);

    // Create custom element
    mentorElement = document.createElement('div');
    Object.defineProperty(mentorElement, 'shadowRoot', {
      value: {
        querySelector: vi.fn((selector: string) => {
          if (selector === 'iframe') return mockIframe;
          return null;
        }),
      },
      writable: true,
      configurable: true,
    });

    // Mock document.querySelector
    vi.spyOn(document, 'querySelector').mockImplementation(
      (selector: string) => {
        if (selector === 'mentor-ai') return mentorElement;
        return null;
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('triggerNewChatSession', () => {
    it('should return a function', () => {
      const { result } = renderHook(() => useChatComponent());

      expect(typeof result.current.triggerNewChatSession).toBe('function');
    });

    it('should post message to iframe when mentor-ai element exists', () => {
      const { result } = renderHook(() => useChatComponent());

      act(() => {
        result.current.triggerNewChatSession();
      });

      expect(mockPostMessage).toHaveBeenCalledWith(
        { reason: 'NEW_CHAT_SESSION' },
        '*',
      );
    });

    it('should not throw when mentor-ai element does not exist', () => {
      vi.spyOn(document, 'querySelector').mockReturnValue(null);

      const { result } = renderHook(() => useChatComponent());

      expect(() => {
        act(() => {
          result.current.triggerNewChatSession();
        });
      }).not.toThrow();

      expect(mockPostMessage).not.toHaveBeenCalled();
    });

    it('should not throw when shadowRoot is null', () => {
      Object.defineProperty(mentorElement, 'shadowRoot', {
        value: null,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useChatComponent());

      expect(() => {
        act(() => {
          result.current.triggerNewChatSession();
        });
      }).not.toThrow();

      expect(mockPostMessage).not.toHaveBeenCalled();
    });

    it('should not throw when iframe is not found in shadowRoot', () => {
      Object.defineProperty(mentorElement, 'shadowRoot', {
        value: {
          querySelector: vi.fn().mockReturnValue(null),
        },
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useChatComponent());

      expect(() => {
        act(() => {
          result.current.triggerNewChatSession();
        });
      }).not.toThrow();

      expect(mockPostMessage).not.toHaveBeenCalled();
    });

    it('should handle iframe with null contentWindow', () => {
      const iframeWithoutWindow = document.createElement('iframe');
      Object.defineProperty(iframeWithoutWindow, 'contentWindow', {
        value: null,
        writable: true,
        configurable: true,
      });

      Object.defineProperty(mentorElement, 'shadowRoot', {
        value: {
          querySelector: vi.fn().mockReturnValue(iframeWithoutWindow),
        },
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useChatComponent());

      expect(() => {
        act(() => {
          result.current.triggerNewChatSession();
        });
      }).not.toThrow();

      expect(mockPostMessage).not.toHaveBeenCalled();
    });
  });

  describe('hook return structure', () => {
    it('should return object with triggerNewChatSession', () => {
      const { result } = renderHook(() => useChatComponent());

      expect(result.current).toHaveProperty('triggerNewChatSession');
      expect(Object.keys(result.current)).toHaveLength(1);
    });
  });
});
