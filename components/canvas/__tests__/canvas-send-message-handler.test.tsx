import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';

import {
  useCanvasSendMessageHandler,
  useCanvasUpdateDetector,
} from '../canvas-send-message-handler';

// ============================================================================
// MOCKS
// ============================================================================

// Mock artifact type
const mockArtifact = {
  id: 123,
  title: 'Test Artifact',
  content: '# Test Content',
  file_extension: 'md',
};

// ============================================================================
// TESTS
// ============================================================================

describe('canvas-send-message-handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  // ==========================================================================
  // useCanvasSendMessageHandler
  // ==========================================================================

  describe('useCanvasSendMessageHandler', () => {
    it('returns sendFullArtifactUpdate function', () => {
      const { result } = renderHook(() =>
        useCanvasSendMessageHandler({
          currentArtifact: mockArtifact as any,
          sendMessage: vi.fn(),
        }),
      );

      expect(typeof result.current.sendFullArtifactUpdate).toBe('function');
    });

    it('returns lastMessage as empty string initially', () => {
      const { result } = renderHook(() =>
        useCanvasSendMessageHandler({
          currentArtifact: mockArtifact as any,
          sendMessage: vi.fn(),
        }),
      );

      expect(result.current.lastMessage).toBe('');
    });

    it('returns false when currentArtifact is null', () => {
      const sendMessage = vi.fn();
      const { result } = renderHook(() =>
        useCanvasSendMessageHandler({
          currentArtifact: null,
          sendMessage,
        }),
      );

      const success = result.current.sendFullArtifactUpdate('Test message');
      expect(success).toBe(false);
      expect(sendMessage).not.toHaveBeenCalled();
    });

    it('returns false when sendMessage is undefined', () => {
      const { result } = renderHook(() =>
        useCanvasSendMessageHandler({
          currentArtifact: mockArtifact as any,
          sendMessage: undefined,
        }),
      );

      const success = result.current.sendFullArtifactUpdate('Test message');
      expect(success).toBe(false);
    });

    it('sends message with full artifact payload', () => {
      const sendMessage = vi.fn();
      const onMessageSent = vi.fn();
      const { result } = renderHook(() =>
        useCanvasSendMessageHandler({
          currentArtifact: mockArtifact as any,
          sendMessage,
          onMessageSent,
        }),
      );

      act(() => {
        result.current.sendFullArtifactUpdate('Make it shorter');
      });

      expect(sendMessage).toHaveBeenCalledWith('Make it shorter', {
        visible: true,
        artifact: {
          title: 'Test Artifact',
          file_extension: 'md',
          id: '123',
          is_partial: false,
        },
      });
    });

    it('calls onMessageSent callback after sending', () => {
      const sendMessage = vi.fn();
      const onMessageSent = vi.fn();
      const { result } = renderHook(() =>
        useCanvasSendMessageHandler({
          currentArtifact: mockArtifact as any,
          sendMessage,
          onMessageSent,
        }),
      );

      act(() => {
        result.current.sendFullArtifactUpdate('Test message');
      });

      expect(onMessageSent).toHaveBeenCalled();
    });

    it('returns true on successful send', () => {
      const sendMessage = vi.fn();
      const { result } = renderHook(() =>
        useCanvasSendMessageHandler({
          currentArtifact: mockArtifact as any,
          sendMessage,
        }),
      );

      let success: boolean;
      act(() => {
        success = result.current.sendFullArtifactUpdate('Test message');
      });

      expect(success!).toBe(true);
    });

    it('uses default title when artifact title is empty', () => {
      const sendMessage = vi.fn();
      const artifactNoTitle = { ...mockArtifact, title: '' };
      const { result } = renderHook(() =>
        useCanvasSendMessageHandler({
          currentArtifact: artifactNoTitle as any,
          sendMessage,
        }),
      );

      act(() => {
        result.current.sendFullArtifactUpdate('Test message');
      });

      expect(sendMessage).toHaveBeenCalledWith('Test message', {
        visible: true,
        artifact: expect.objectContaining({
          title: 'Untitled Artifact',
        }),
      });
    });

    it('uses default file_extension when not provided', () => {
      const sendMessage = vi.fn();
      const artifactNoExt = { ...mockArtifact, file_extension: undefined };
      const { result } = renderHook(() =>
        useCanvasSendMessageHandler({
          currentArtifact: artifactNoExt as any,
          sendMessage,
        }),
      );

      act(() => {
        result.current.sendFullArtifactUpdate('Test message');
      });

      expect(sendMessage).toHaveBeenCalledWith('Test message', {
        visible: true,
        artifact: expect.objectContaining({
          file_extension: 'txt',
        }),
      });
    });

    it('listens for canvas-send-message events', () => {
      const sendMessage = vi.fn();
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      renderHook(() =>
        useCanvasSendMessageHandler({
          currentArtifact: mockArtifact as any,
          sendMessage,
        }),
      );

      expect(addEventListenerSpy).toHaveBeenCalledWith('canvas-send-message', expect.any(Function));

      addEventListenerSpy.mockRestore();
    });

    it('removes event listener on unmount', () => {
      const sendMessage = vi.fn();
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() =>
        useCanvasSendMessageHandler({
          currentArtifact: mockArtifact as any,
          sendMessage,
        }),
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'canvas-send-message',
        expect.any(Function),
      );

      removeEventListenerSpy.mockRestore();
    });

    it('handles global message event with withArtifact=true', () => {
      const sendMessage = vi.fn();

      renderHook(() =>
        useCanvasSendMessageHandler({
          currentArtifact: mockArtifact as any,
          sendMessage,
        }),
      );

      // Dispatch custom event
      act(() => {
        const event = new CustomEvent('canvas-send-message', {
          detail: { message: 'Global message', withArtifact: true },
        });
        window.dispatchEvent(event);
      });

      expect(sendMessage).toHaveBeenCalledWith('Global message', expect.any(Object));
    });

    it('ignores global message event without withArtifact', () => {
      const sendMessage = vi.fn();

      renderHook(() =>
        useCanvasSendMessageHandler({
          currentArtifact: mockArtifact as any,
          sendMessage,
        }),
      );

      act(() => {
        const event = new CustomEvent('canvas-send-message', {
          detail: { message: 'Global message', withArtifact: false },
        });
        window.dispatchEvent(event);
      });

      expect(sendMessage).not.toHaveBeenCalled();
    });

    it('ignores global message event when currentArtifact is null', () => {
      const sendMessage = vi.fn();

      renderHook(() =>
        useCanvasSendMessageHandler({
          currentArtifact: null,
          sendMessage,
        }),
      );

      act(() => {
        const event = new CustomEvent('canvas-send-message', {
          detail: { message: 'Global message', withArtifact: true },
        });
        window.dispatchEvent(event);
      });

      expect(sendMessage).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // useCanvasUpdateDetector
  // ==========================================================================

  describe('useCanvasUpdateDetector', () => {
    it('does nothing when currentArtifact is null', () => {
      const onUpdate = vi.fn();
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      renderHook(() => useCanvasUpdateDetector(null, onUpdate));

      // Should not add listener when artifact is null
      const calls = addEventListenerSpy.mock.calls.filter((call) => call[0] === 'artifact-updated');
      expect(calls.length).toBe(0);

      addEventListenerSpy.mockRestore();
    });

    it('listens for artifact-updated events when artifact exists', () => {
      const onUpdate = vi.fn();
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      renderHook(() => useCanvasUpdateDetector(mockArtifact as any, onUpdate));

      expect(addEventListenerSpy).toHaveBeenCalledWith('artifact-updated', expect.any(Function));

      addEventListenerSpy.mockRestore();
    });

    it('removes event listener on unmount', () => {
      const onUpdate = vi.fn();
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() => useCanvasUpdateDetector(mockArtifact as any, onUpdate));

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('artifact-updated', expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });

    it('calls onUpdate when artifact matches event', () => {
      const onUpdate = vi.fn();

      renderHook(() => useCanvasUpdateDetector(mockArtifact as any, onUpdate));

      act(() => {
        const event = new CustomEvent('artifact-updated', {
          detail: {
            artifactId: 123,
            content: 'Updated content',
            messageId: 'msg-1',
          },
        });
        window.dispatchEvent(event);
      });

      expect(onUpdate).toHaveBeenCalledWith('Updated content');
    });

    it('ignores events for different artifacts', () => {
      const onUpdate = vi.fn();

      renderHook(() => useCanvasUpdateDetector(mockArtifact as any, onUpdate));

      act(() => {
        const event = new CustomEvent('artifact-updated', {
          detail: {
            artifactId: 999, // Different ID
            content: 'Different artifact content',
            messageId: 'msg-1',
          },
        });
        window.dispatchEvent(event);
      });

      expect(onUpdate).not.toHaveBeenCalled();
    });

    it('ignores duplicate message IDs', () => {
      const onUpdate = vi.fn();

      renderHook(() => useCanvasUpdateDetector(mockArtifact as any, onUpdate));

      // First event
      act(() => {
        const event = new CustomEvent('artifact-updated', {
          detail: {
            artifactId: 123,
            content: 'First content',
            messageId: 'msg-1',
          },
        });
        window.dispatchEvent(event);
      });

      expect(onUpdate).toHaveBeenCalledTimes(1);

      // Same message ID - should be ignored
      act(() => {
        const event = new CustomEvent('artifact-updated', {
          detail: {
            artifactId: 123,
            content: 'Same message ID content',
            messageId: 'msg-1',
          },
        });
        window.dispatchEvent(event);
      });

      expect(onUpdate).toHaveBeenCalledTimes(1);
    });

    it('processes new message IDs', () => {
      const onUpdate = vi.fn();

      renderHook(() => useCanvasUpdateDetector(mockArtifact as any, onUpdate));

      act(() => {
        const event1 = new CustomEvent('artifact-updated', {
          detail: {
            artifactId: 123,
            content: 'Content 1',
            messageId: 'msg-1',
          },
        });
        window.dispatchEvent(event1);
      });

      act(() => {
        const event2 = new CustomEvent('artifact-updated', {
          detail: {
            artifactId: 123,
            content: 'Content 2',
            messageId: 'msg-2', // Different message ID
          },
        });
        window.dispatchEvent(event2);
      });

      expect(onUpdate).toHaveBeenCalledTimes(2);
      expect(onUpdate).toHaveBeenNthCalledWith(1, 'Content 1');
      expect(onUpdate).toHaveBeenNthCalledWith(2, 'Content 2');
    });

    it('updates when artifact changes', () => {
      const onUpdate = vi.fn();
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { rerender } = renderHook(
        ({ artifact }) => useCanvasUpdateDetector(artifact, onUpdate),
        { initialProps: { artifact: mockArtifact as any } },
      );

      const newArtifact = { ...mockArtifact, id: 456 };
      rerender({ artifact: newArtifact as any });

      // Should have added/removed listeners
      expect(addEventListenerSpy).toHaveBeenCalled();
      expect(removeEventListenerSpy).toHaveBeenCalled();

      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('edge cases', () => {
    it('handles artifact with numeric id correctly', () => {
      const sendMessage = vi.fn();
      const { result } = renderHook(() =>
        useCanvasSendMessageHandler({
          currentArtifact: { ...mockArtifact, id: 42 } as any,
          sendMessage,
        }),
      );

      act(() => {
        result.current.sendFullArtifactUpdate('Test');
      });

      expect(sendMessage).toHaveBeenCalledWith('Test', {
        visible: true,
        artifact: expect.objectContaining({
          id: '42', // Should be string
        }),
      });
    });

    it('handles empty message gracefully', () => {
      const sendMessage = vi.fn();
      const { result } = renderHook(() =>
        useCanvasSendMessageHandler({
          currentArtifact: mockArtifact as any,
          sendMessage,
        }),
      );

      act(() => {
        result.current.sendFullArtifactUpdate('');
      });

      expect(sendMessage).toHaveBeenCalledWith('', expect.any(Object));
    });

    it('handles special characters in message', () => {
      const sendMessage = vi.fn();
      const { result } = renderHook(() =>
        useCanvasSendMessageHandler({
          currentArtifact: mockArtifact as any,
          sendMessage,
        }),
      );

      const specialMessage = '<script>alert("xss")</script>';
      act(() => {
        result.current.sendFullArtifactUpdate(specialMessage);
      });

      expect(sendMessage).toHaveBeenCalledWith(specialMessage, expect.any(Object));
    });

    it('handles very long messages', () => {
      const sendMessage = vi.fn();
      const { result } = renderHook(() =>
        useCanvasSendMessageHandler({
          currentArtifact: mockArtifact as any,
          sendMessage,
        }),
      );

      const longMessage = 'A'.repeat(10000);
      act(() => {
        result.current.sendFullArtifactUpdate(longMessage);
      });

      expect(sendMessage).toHaveBeenCalledWith(longMessage, expect.any(Object));
    });

    it('handles unicode in artifact title', () => {
      const sendMessage = vi.fn();
      const unicodeArtifact = { ...mockArtifact, title: '你好世界 🎉' };
      const { result } = renderHook(() =>
        useCanvasSendMessageHandler({
          currentArtifact: unicodeArtifact as any,
          sendMessage,
        }),
      );

      act(() => {
        result.current.sendFullArtifactUpdate('Test');
      });

      expect(sendMessage).toHaveBeenCalledWith('Test', {
        visible: true,
        artifact: expect.objectContaining({
          title: '你好世界 🎉',
        }),
      });
    });
  });
});
