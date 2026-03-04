import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCanvasChatIntegration, useChatWithCanvas } from '../use-canvas-chat-integration';

describe('useCanvasChatIntegration', () => {
  let mockSendMessage: ReturnType<typeof vi.fn>;
  let dispatchedEvents: CustomEvent[];

  beforeEach(() => {
    mockSendMessage = vi.fn();
    dispatchedEvents = [];

    vi.spyOn(console, 'log').mockImplementation(() => {});

    vi.spyOn(window, 'dispatchEvent').mockImplementation((event) => {
      dispatchedEvents.push(event as CustomEvent);
      return true;
    });

    // Clean up any global state
    delete (window as any).__originalSendMessage;
    delete (window as any).__canvasEnhancedSendMessage;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (window as any).__originalSendMessage;
    delete (window as any).__canvasEnhancedSendMessage;
  });

  describe('when canvas is not open', () => {
    it('should not set up enhanced send message', () => {
      renderHook(() =>
        useCanvasChatIntegration({
          currentArtifact: { id: 1, title: 'Test' } as any,
          sendMessage: mockSendMessage,
          isCanvasOpen: false,
        }),
      );

      expect((window as any).__canvasEnhancedSendMessage).toBeUndefined();
    });

    it('should not dispatch events', () => {
      renderHook(() =>
        useCanvasChatIntegration({
          currentArtifact: { id: 1, title: 'Test' } as any,
          sendMessage: mockSendMessage,
          isCanvasOpen: false,
        }),
      );

      expect(dispatchedEvents).toHaveLength(0);
    });
  });

  describe('when canvas is open', () => {
    it('should set up enhanced send message on window', () => {
      renderHook(() =>
        useCanvasChatIntegration({
          currentArtifact: { id: 1, title: 'Test Artifact', file_extension: 'md' } as any,
          sendMessage: mockSendMessage,
          isCanvasOpen: true,
        }),
      );

      expect((window as any).__canvasEnhancedSendMessage).toBeDefined();
      expect(typeof (window as any).__canvasEnhancedSendMessage).toBe('function');
    });

    it('should dispatch canvas-integration-active event', () => {
      renderHook(() =>
        useCanvasChatIntegration({
          currentArtifact: { id: 1, title: 'Test Artifact' } as any,
          sendMessage: mockSendMessage,
          isCanvasOpen: true,
        }),
      );

      const activeEvent = dispatchedEvents.find((e) => e.type === 'canvas-integration-active');
      expect(activeEvent).toBeDefined();
      expect(activeEvent?.detail.artifactId).toBe(1);
    });

    it('should clean up on unmount', () => {
      const { unmount } = renderHook(() =>
        useCanvasChatIntegration({
          currentArtifact: { id: 1, title: 'Test' } as any,
          sendMessage: mockSendMessage,
          isCanvasOpen: true,
        }),
      );

      unmount();

      const inactiveEvent = dispatchedEvents.find((e) => e.type === 'canvas-integration-inactive');
      expect(inactiveEvent).toBeDefined();
      expect((window as any).__canvasEnhancedSendMessage).toBeUndefined();
    });
  });

  describe('enhanced sendMessage behavior', () => {
    it('should include artifact when sending message', () => {
      renderHook(() =>
        useCanvasChatIntegration({
          currentArtifact: {
            id: 123,
            title: 'My Artifact',
            file_extension: 'txt',
          } as any,
          sendMessage: mockSendMessage,
          isCanvasOpen: true,
        }),
      );

      const enhancedSend = (window as any).__canvasEnhancedSendMessage;
      enhancedSend('Hello');

      expect(mockSendMessage).toHaveBeenCalledWith('Hello', {
        visible: true,
        artifact: {
          title: 'My Artifact',
          file_extension: 'txt',
          id: '123',
          is_partial: false,
        },
      });
    });

    it('should not override existing artifact in options', () => {
      renderHook(() =>
        useCanvasChatIntegration({
          currentArtifact: { id: 1, title: 'Test' } as any,
          sendMessage: mockSendMessage,
          isCanvasOpen: true,
        }),
      );

      const customArtifact = { id: 'custom', title: 'Custom' };
      const enhancedSend = (window as any).__canvasEnhancedSendMessage;
      enhancedSend('Hello', { artifact: customArtifact });

      expect(mockSendMessage).toHaveBeenCalledWith('Hello', { artifact: customArtifact });
    });

    it('should use default values for missing title and file_extension', () => {
      renderHook(() =>
        useCanvasChatIntegration({
          currentArtifact: { id: 456 } as any,
          sendMessage: mockSendMessage,
          isCanvasOpen: true,
        }),
      );

      const enhancedSend = (window as any).__canvasEnhancedSendMessage;
      enhancedSend('Test message');

      expect(mockSendMessage).toHaveBeenCalledWith('Test message', {
        visible: true,
        artifact: {
          title: 'Untitled Artifact',
          file_extension: 'txt',
          id: '456',
          is_partial: false,
        },
      });
    });

    it('should respect visible: false option', () => {
      renderHook(() =>
        useCanvasChatIntegration({
          currentArtifact: { id: 1, title: 'Test' } as any,
          sendMessage: mockSendMessage,
          isCanvasOpen: true,
        }),
      );

      const enhancedSend = (window as any).__canvasEnhancedSendMessage;
      enhancedSend('Hidden message', { visible: false });

      expect(mockSendMessage).toHaveBeenCalledWith('Hidden message', {
        visible: false,
        artifact: expect.any(Object),
      });
    });

    it('should preserve original sendMessage', () => {
      renderHook(() =>
        useCanvasChatIntegration({
          currentArtifact: { id: 1, title: 'Test' } as any,
          sendMessage: mockSendMessage,
          isCanvasOpen: true,
        }),
      );

      expect((window as any).__originalSendMessage).toBe(mockSendMessage);
    });
  });

  describe('when artifact is null', () => {
    it('should not set up enhanced send message', () => {
      renderHook(() =>
        useCanvasChatIntegration({
          currentArtifact: null,
          sendMessage: mockSendMessage,
          isCanvasOpen: true,
        }),
      );

      expect((window as any).__canvasEnhancedSendMessage).toBeUndefined();
    });
  });

  describe('when sendMessage is undefined', () => {
    it('should not set up enhanced send message', () => {
      renderHook(() =>
        useCanvasChatIntegration({
          currentArtifact: { id: 1, title: 'Test' } as any,
          sendMessage: undefined,
          isCanvasOpen: true,
        }),
      );

      expect((window as any).__canvasEnhancedSendMessage).toBeUndefined();
    });
  });
});

describe('useChatWithCanvas', () => {
  beforeEach(() => {
    delete (window as any).__canvasEnhancedSendMessage;
  });

  afterEach(() => {
    delete (window as any).__canvasEnhancedSendMessage;
  });

  describe('getEnhancedSendMessage', () => {
    it('should return null when no enhanced send message is set', () => {
      const { result } = renderHook(() => useChatWithCanvas());
      expect(result.current.getEnhancedSendMessage()).toBeNull();
    });

    it('should return enhanced send message when set', () => {
      const mockEnhanced = vi.fn();
      (window as any).__canvasEnhancedSendMessage = mockEnhanced;

      const { result } = renderHook(() => useChatWithCanvas());
      expect(result.current.getEnhancedSendMessage()).toBe(mockEnhanced);
    });
  });

  describe('isCanvasActive', () => {
    it('should return false when canvas is not active', () => {
      const { result } = renderHook(() => useChatWithCanvas());
      expect(result.current.isCanvasActive()).toBe(false);
    });

    it('should return true when canvas is active', () => {
      (window as any).__canvasEnhancedSendMessage = vi.fn();

      const { result } = renderHook(() => useChatWithCanvas());
      expect(result.current.isCanvasActive()).toBe(true);
    });
  });
});
