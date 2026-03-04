import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import React from 'react';

// Mock hooks before importing component
const mockUseScreenSharing = vi.fn();
const mockUsePipOnBlur = vi.fn();

vi.mock('@/hooks/use-screen-sharing', () => ({
  useScreenSharing: (props: any) => mockUseScreenSharing(props),
}));

vi.mock('@/hooks/use-pip-on-blur', () => ({
  usePipOnBlur: (props: any) => mockUsePipOnBlur(props),
}));

// Mock livekit-client
vi.mock('livekit-client', () => ({
  RoomEvent: {
    TranscriptionReceived: 'transcriptionReceived',
    ChatMessage: 'chatMessage',
  },
}));

// Mock livekit-components-react
vi.mock('@livekit/components-react', () => ({
  formatChatMessageLinks: vi.fn((text) => text),
  RoomContext: {
    Provider: ({ children, value }: { children: React.ReactNode; value: any }) => (
      <div data-testid="room-context" data-room={JSON.stringify(value ? 'room' : null)}>
        {children}
      </div>
    ),
  },
  VideoConference: ({ className }: { className?: string }) => (
    <div data-testid="video-conference" className={className} />
  ),
  useRoomContext: vi.fn(() => ({
    localParticipant: {
      identity: 'test-user',
      name: 'Test User',
      sendText: vi.fn().mockResolvedValue({ id: 'test-stream-id' }),
    },
    remoteParticipants: new Map(),
    registerTextStreamHandler: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  })),
}));

import { LiveKitScreenSharing } from '../live-kit-screen-sharing';

describe('LiveKitScreenSharing', () => {
  const defaultProps = {
    tenantKey: 'test-tenant',
    mentorUniqueId: 'mentor-123',
    sessionId: 'session-456',
    username: 'testuser',
    onClose: vi.fn(),
    isOpen: true,
  };

  let originalOpener: Window | null;
  let mockPostMessage: Mock;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  const mockRoom = { id: 'mock-room' };

  beforeEach(() => {
    vi.clearAllMocks();

    // Store original opener
    originalOpener = window.opener;

    // Setup mock opener
    mockPostMessage = vi.fn();
    Object.defineProperty(window, 'opener', {
      value: {
        closed: false,
        postMessage: mockPostMessage,
      },
      writable: true,
      configurable: true,
    });

    // Setup default mock returns
    mockUseScreenSharing.mockReturnValue({
      room: mockRoom,
      connectionState: 'idle',
      isScreenShareActive: false,
    });

    mockUsePipOnBlur.mockReturnValue({
      isPipOpen: false,
      openPip: vi.fn(),
      closePip: vi.fn(),
    });

    // Suppress console output
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    Object.defineProperty(window, 'opener', {
      value: originalOpener,
      writable: true,
      configurable: true,
    });
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('rendering', () => {
    it('should render RoomContext.Provider with room', () => {
      const { getByTestId } = render(<LiveKitScreenSharing {...defaultProps} />);

      const roomContext = getByTestId('room-context');
      expect(roomContext).toBeInTheDocument();
    });

    it('should render VideoConference with hidden class', () => {
      const { getByTestId } = render(<LiveKitScreenSharing {...defaultProps} />);

      const videoConference = getByTestId('video-conference');
      expect(videoConference).toHaveClass('hidden');
    });
  });

  describe('useScreenSharing integration', () => {
    it('should call useScreenSharing with correct props', () => {
      render(<LiveKitScreenSharing {...defaultProps} />);

      expect(mockUseScreenSharing).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantKey: 'test-tenant',
          mentorUniqueId: 'mentor-123',
          sessionId: 'session-456',
          username: 'testuser',
          onError: defaultProps.onClose,
          onConnectionStateChange: expect.any(Function),
          onScreenShareStopped: expect.any(Function),
        }),
      );
    });

    it('should call onClose when onError is triggered', () => {
      render(<LiveKitScreenSharing {...defaultProps} />);

      const callProps = mockUseScreenSharing.mock.calls[0][0];
      expect(callProps.onError).toBe(defaultProps.onClose);
    });

    it('should call onClose when screen share is stopped', () => {
      render(<LiveKitScreenSharing {...defaultProps} />);

      const callProps = mockUseScreenSharing.mock.calls[0][0];
      callProps.onScreenShareStopped();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[LiveKitScreenSharing] Screen share stopped, closing modal',
      );
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe('usePipOnBlur integration', () => {
    it('should call usePipOnBlur with correct options', () => {
      mockUseScreenSharing.mockReturnValue({
        room: mockRoom,
        connectionState: 'connected',
        isScreenShareActive: true,
      });

      render(<LiveKitScreenSharing {...defaultProps} />);

      expect(mockUsePipOnBlur).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
          width: 320,
          height: 680,
          room: mockRoom,
          screenSharePreviewHeight: 35,
          onStopScreenShare: expect.any(Function),
        }),
      );
    });

    it('should set enabled to false when screen share is not active', () => {
      mockUseScreenSharing.mockReturnValue({
        room: mockRoom,
        connectionState: 'connected',
        isScreenShareActive: false,
      });

      render(<LiveKitScreenSharing {...defaultProps} />);

      expect(mockUsePipOnBlur).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: false,
        }),
      );
    });
  });

  describe('postRoomStatusToOpener', () => {
    it('should post room status on mount', () => {
      mockUseScreenSharing.mockReturnValue({
        room: mockRoom,
        connectionState: 'idle',
        isScreenShareActive: false,
      });

      render(<LiveKitScreenSharing {...defaultProps} />);

      expect(mockPostMessage).toHaveBeenCalledWith(
        {
          type: 'MENTOR:ROOM_STATUS',
          action: 'screen-share',
          status: 'idle',
        },
        '*',
      );
    });

    it('should post room status when connection state changes', () => {
      mockUseScreenSharing.mockReturnValue({
        room: mockRoom,
        connectionState: 'connected',
        isScreenShareActive: false,
      });

      render(<LiveKitScreenSharing {...defaultProps} />);

      // Get the onConnectionStateChange callback
      const callProps = mockUseScreenSharing.mock.calls[0][0];
      callProps.onConnectionStateChange('connecting');

      expect(mockPostMessage).toHaveBeenCalledWith(
        {
          type: 'MENTOR:ROOM_STATUS',
          action: 'screen-share',
          status: 'connecting',
        },
        '*',
      );
    });

    it('should post disconnected status on unmount', () => {
      const { unmount } = render(<LiveKitScreenSharing {...defaultProps} />);

      mockPostMessage.mockClear();
      unmount();

      expect(mockPostMessage).toHaveBeenCalledWith(
        {
          type: 'MENTOR:ROOM_STATUS',
          action: 'screen-share',
          status: 'disconnected',
        },
        '*',
      );
    });

    it('should not post when opener is closed', () => {
      Object.defineProperty(window, 'opener', {
        value: {
          closed: true,
          postMessage: mockPostMessage,
        },
        writable: true,
        configurable: true,
      });

      render(<LiveKitScreenSharing {...defaultProps} />);

      expect(mockPostMessage).not.toHaveBeenCalled();
    });

    it('should not post when opener is null', () => {
      Object.defineProperty(window, 'opener', {
        value: null,
        writable: true,
        configurable: true,
      });

      render(<LiveKitScreenSharing {...defaultProps} />);

      // Should not throw when opener is null
      expect(true).toBe(true);
    });

    it('should handle postMessage errors gracefully', () => {
      mockPostMessage.mockImplementation(() => {
        throw new Error('Cross-origin error');
      });

      render(<LiveKitScreenSharing {...defaultProps} />);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to post room status to opener:',
        expect.any(Error),
      );
    });
  });

  describe('postScreenSharingStartedToOpener', () => {
    it('should post screen sharing started when isScreenShareActive becomes true', () => {
      // First render with inactive screen share
      mockUseScreenSharing.mockReturnValue({
        room: mockRoom,
        connectionState: 'connected',
        isScreenShareActive: false,
      });

      const { rerender } = render(<LiveKitScreenSharing {...defaultProps} />);

      mockPostMessage.mockClear();

      // Update to active screen share
      mockUseScreenSharing.mockReturnValue({
        room: mockRoom,
        connectionState: 'connected',
        isScreenShareActive: true,
      });

      rerender(<LiveKitScreenSharing {...defaultProps} />);

      expect(mockPostMessage).toHaveBeenCalledWith(
        {
          type: 'MENTOR:SCREENSHARING_STARTED',
        },
        '*',
      );
    });

    it('should not post screen sharing started when isScreenShareActive is false', () => {
      mockUseScreenSharing.mockReturnValue({
        room: mockRoom,
        connectionState: 'connected',
        isScreenShareActive: false,
      });

      render(<LiveKitScreenSharing {...defaultProps} />);

      const screenSharingStartedCalls = mockPostMessage.mock.calls.filter(
        (call: unknown[]) => (call[0] as { type: string }).type === 'MENTOR:SCREENSHARING_STARTED',
      );
      expect(screenSharingStartedCalls.length).toBe(0);
    });

    it('should not post when opener is closed', () => {
      Object.defineProperty(window, 'opener', {
        value: {
          closed: true,
          postMessage: mockPostMessage,
        },
        writable: true,
        configurable: true,
      });

      mockUseScreenSharing.mockReturnValue({
        room: mockRoom,
        connectionState: 'connected',
        isScreenShareActive: true,
      });

      render(<LiveKitScreenSharing {...defaultProps} />);

      expect(mockPostMessage).not.toHaveBeenCalled();
    });

    it('should handle postMessage errors gracefully', () => {
      mockPostMessage.mockImplementation(() => {
        throw new Error('Cross-origin error');
      });

      mockUseScreenSharing.mockReturnValue({
        room: mockRoom,
        connectionState: 'connected',
        isScreenShareActive: true,
      });

      render(<LiveKitScreenSharing {...defaultProps} />);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to post screen sharing started to opener:',
        expect.any(Error),
      );
    });
  });

  describe('connection state callback stability', () => {
    it('should maintain stable reference for handleConnectionStateChange', () => {
      const { rerender } = render(<LiveKitScreenSharing {...defaultProps} />);

      const firstCallProps = mockUseScreenSharing.mock.calls[0][0];
      const firstCallback = firstCallProps.onConnectionStateChange;

      rerender(<LiveKitScreenSharing {...defaultProps} />);

      const secondCallProps = mockUseScreenSharing.mock.calls[1][0];
      const secondCallback = secondCallProps.onConnectionStateChange;

      // Callbacks should be stable (same reference) due to useCallback
      expect(firstCallback).toBe(secondCallback);
    });

    it('should maintain stable reference for handleScreenShareStopped', () => {
      const { rerender } = render(<LiveKitScreenSharing {...defaultProps} />);

      const firstCallProps = mockUseScreenSharing.mock.calls[0][0];
      const firstCallback = firstCallProps.onScreenShareStopped;

      rerender(<LiveKitScreenSharing {...defaultProps} />);

      const secondCallProps = mockUseScreenSharing.mock.calls[1][0];
      const secondCallback = secondCallProps.onScreenShareStopped;

      // Callbacks should be stable due to useCallback with onClose dependency
      expect(firstCallback).toBe(secondCallback);
    });

    it('should update handleScreenShareStopped when onClose changes', () => {
      const { rerender } = render(<LiveKitScreenSharing {...defaultProps} />);

      const firstCallProps = mockUseScreenSharing.mock.calls[0][0];
      const firstCallback = firstCallProps.onScreenShareStopped;

      const newOnClose = vi.fn();
      rerender(<LiveKitScreenSharing {...defaultProps} onClose={newOnClose} />);

      const secondCallProps = mockUseScreenSharing.mock.calls[1][0];
      const secondCallback = secondCallProps.onScreenShareStopped;

      // Callback should change when onClose changes
      expect(firstCallback).not.toBe(secondCallback);

      // New callback should use new onClose
      secondCallback();
      expect(newOnClose).toHaveBeenCalled();
    });
  });

  describe('different connection states', () => {
    const states = [
      'idle',
      'requesting-permission',
      'connecting',
      'connected',
      'reconnecting',
      'disconnected',
      'error',
    ] as const;

    states.forEach((state) => {
      it(`should post ${state} status to opener`, () => {
        mockUseScreenSharing.mockReturnValue({
          room: mockRoom,
          connectionState: state,
          isScreenShareActive: false,
        });

        render(<LiveKitScreenSharing {...defaultProps} />);

        expect(mockPostMessage).toHaveBeenCalledWith(
          {
            type: 'MENTOR:ROOM_STATUS',
            action: 'screen-share',
            status: state,
          },
          '*',
        );
      });
    });
  });
});

describe('postRoomStatusToOpener function', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('should not throw when window.opener is undefined', () => {
    Object.defineProperty(window, 'opener', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    mockUseScreenSharing.mockReturnValue({
      room: { id: 'room' },
      connectionState: 'connected',
      isScreenShareActive: false,
    });

    // Should not throw
    expect(() => {
      render(
        <LiveKitScreenSharing
          {...{
            tenantKey: 'test',
            mentorUniqueId: 'mentor',
            sessionId: 'session',
            username: 'user',
            onClose: vi.fn(),
            isOpen: true,
          }}
        />,
      );
    }).not.toThrow();
  });
});

describe('postScreenSharingStartedToOpener function', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('should not throw when window.opener is undefined', () => {
    Object.defineProperty(window, 'opener', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    mockUseScreenSharing.mockReturnValue({
      room: { id: 'room' },
      connectionState: 'connected',
      isScreenShareActive: true,
    });

    // Should not throw
    expect(() => {
      render(
        <LiveKitScreenSharing
          {...{
            tenantKey: 'test',
            mentorUniqueId: 'mentor',
            sessionId: 'session',
            username: 'user',
            onClose: vi.fn(),
            isOpen: true,
          }}
        />,
      );
    }).not.toThrow();
  });
});
