import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCanvasAwareSend } from '../use-canvas-aware-send';

describe('useCanvasAwareSend', () => {
  let mockSendMessage: ReturnType<typeof vi.fn>;
  let eventListeners: Map<string, EventListener>;

  beforeEach(() => {
    mockSendMessage = vi.fn();
    eventListeners = new Map();

    // Mock window event listeners
    vi.spyOn(window, 'addEventListener').mockImplementation((event, handler) => {
      eventListeners.set(event, handler as EventListener);
    });

    vi.spyOn(window, 'removeEventListener').mockImplementation((event) => {
      eventListeners.delete(event);
    });

    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('should return isCanvasActive as false initially', () => {
      const { result } = renderHook(() => useCanvasAwareSend(mockSendMessage));
      expect(result.current.isCanvasActive).toBe(false);
    });

    it('should return canvasArtifact as null initially', () => {
      const { result } = renderHook(() => useCanvasAwareSend(mockSendMessage));
      expect(result.current.canvasArtifact).toBeNull();
    });

    it('should return a sendMessage function', () => {
      const { result } = renderHook(() => useCanvasAwareSend(mockSendMessage));
      expect(typeof result.current.sendMessage).toBe('function');
    });
  });

  describe('event handling', () => {
    it('should set up event listeners on mount', () => {
      renderHook(() => useCanvasAwareSend(mockSendMessage));

      expect(window.addEventListener).toHaveBeenCalledWith('canvas-active', expect.any(Function));
      expect(window.addEventListener).toHaveBeenCalledWith('canvas-inactive', expect.any(Function));
    });

    it('should remove event listeners on unmount', () => {
      const { unmount } = renderHook(() => useCanvasAwareSend(mockSendMessage));
      unmount();

      expect(window.removeEventListener).toHaveBeenCalledWith(
        'canvas-active',
        expect.any(Function),
      );
      expect(window.removeEventListener).toHaveBeenCalledWith(
        'canvas-inactive',
        expect.any(Function),
      );
    });

    it('should update state when canvas-active event fires', () => {
      const { result } = renderHook(() => useCanvasAwareSend(mockSendMessage));

      act(() => {
        const handler = eventListeners.get('canvas-active');
        handler?.(
          new CustomEvent('canvas-active', {
            detail: {
              artifactId: 'artifact-123',
              title: 'My Artifact',
              file_extension: 'md',
            },
          }),
        );
      });

      expect(result.current.isCanvasActive).toBe(true);
      expect(result.current.canvasArtifact).toEqual({
        id: 'artifact-123',
        title: 'My Artifact',
        file_extension: 'md',
      });
    });

    it('should use default values for missing title and file_extension', () => {
      const { result } = renderHook(() => useCanvasAwareSend(mockSendMessage));

      act(() => {
        const handler = eventListeners.get('canvas-active');
        handler?.(
          new CustomEvent('canvas-active', {
            detail: { artifactId: 'artifact-123' },
          }),
        );
      });

      expect(result.current.canvasArtifact).toEqual({
        id: 'artifact-123',
        title: 'Untitled Artifact',
        file_extension: 'txt',
      });
    });

    it('should not set artifact when artifactId is missing', () => {
      const { result } = renderHook(() => useCanvasAwareSend(mockSendMessage));

      act(() => {
        const handler = eventListeners.get('canvas-active');
        handler?.(
          new CustomEvent('canvas-active', {
            detail: { title: 'No ID' },
          }),
        );
      });

      expect(result.current.isCanvasActive).toBe(false);
      expect(result.current.canvasArtifact).toBeNull();
    });

    it('should reset state when canvas-inactive event fires', () => {
      const { result } = renderHook(() => useCanvasAwareSend(mockSendMessage));

      // First activate
      act(() => {
        const handler = eventListeners.get('canvas-active');
        handler?.(
          new CustomEvent('canvas-active', {
            detail: { artifactId: 'artifact-123', title: 'Test', file_extension: 'txt' },
          }),
        );
      });

      expect(result.current.isCanvasActive).toBe(true);

      // Then deactivate
      act(() => {
        const handler = eventListeners.get('canvas-inactive');
        handler?.(new CustomEvent('canvas-inactive'));
      });

      expect(result.current.isCanvasActive).toBe(false);
      expect(result.current.canvasArtifact).toBeNull();
    });
  });

  describe('sendMessage behavior', () => {
    it('should call original sendMessage when canvas is not active', () => {
      const { result } = renderHook(() => useCanvasAwareSend(mockSendMessage));

      act(() => {
        result.current.sendMessage('Hello', { someOption: true });
      });

      expect(mockSendMessage).toHaveBeenCalledWith('Hello', { someOption: true });
    });

    it('should include artifact when canvas is active', () => {
      const { result } = renderHook(() => useCanvasAwareSend(mockSendMessage));

      // Activate canvas
      act(() => {
        const handler = eventListeners.get('canvas-active');
        handler?.(
          new CustomEvent('canvas-active', {
            detail: { artifactId: 'artifact-123', title: 'Test', file_extension: 'md' },
          }),
        );
      });

      // Send message
      act(() => {
        result.current.sendMessage('Update this');
      });

      expect(mockSendMessage).toHaveBeenCalledWith('Update this', {
        visible: true,
        artifact: {
          title: 'Test',
          file_extension: 'md',
          id: 'artifact-123',
          is_partial: false,
        },
      });
    });

    it('should not override existing artifact in options', () => {
      const { result } = renderHook(() => useCanvasAwareSend(mockSendMessage));

      // Activate canvas
      act(() => {
        const handler = eventListeners.get('canvas-active');
        handler?.(
          new CustomEvent('canvas-active', {
            detail: { artifactId: 'artifact-123', title: 'Test', file_extension: 'md' },
          }),
        );
      });

      const customArtifact = { id: 'custom-id', title: 'Custom' };

      // Send message with existing artifact
      act(() => {
        result.current.sendMessage('Update this', { artifact: customArtifact });
      });

      expect(mockSendMessage).toHaveBeenCalledWith('Update this', { artifact: customArtifact });
    });

    it('should preserve other options when adding artifact', () => {
      const { result } = renderHook(() => useCanvasAwareSend(mockSendMessage));

      // Activate canvas
      act(() => {
        const handler = eventListeners.get('canvas-active');
        handler?.(
          new CustomEvent('canvas-active', {
            detail: { artifactId: 'artifact-123', title: 'Test', file_extension: 'md' },
          }),
        );
      });

      // Send message with other options
      act(() => {
        result.current.sendMessage('Update this', { customOption: 'value' });
      });

      expect(mockSendMessage).toHaveBeenCalledWith('Update this', {
        customOption: 'value',
        visible: true,
        artifact: {
          title: 'Test',
          file_extension: 'md',
          id: 'artifact-123',
          is_partial: false,
        },
      });
    });

    it('should respect visible: false option', () => {
      const { result } = renderHook(() => useCanvasAwareSend(mockSendMessage));

      // Activate canvas
      act(() => {
        const handler = eventListeners.get('canvas-active');
        handler?.(
          new CustomEvent('canvas-active', {
            detail: { artifactId: 'artifact-123', title: 'Test', file_extension: 'md' },
          }),
        );
      });

      // Send message with visible: false
      act(() => {
        result.current.sendMessage('Update this', { visible: false });
      });

      expect(mockSendMessage).toHaveBeenCalledWith('Update this', {
        visible: false,
        artifact: expect.any(Object),
      });
    });
  });

  describe('artifactId conversion', () => {
    it('should convert artifactId to string', () => {
      const { result } = renderHook(() => useCanvasAwareSend(mockSendMessage));

      act(() => {
        const handler = eventListeners.get('canvas-active');
        handler?.(
          new CustomEvent('canvas-active', {
            detail: { artifactId: 12345, title: 'Test', file_extension: 'txt' },
          }),
        );
      });

      expect(result.current.canvasArtifact?.id).toBe('12345');
    });
  });
});
