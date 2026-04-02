import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock data-layer
const mockLoadGuidedPrompts = vi.fn();
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useLazyGetGuidedPromptsQuery: () => [mockLoadGuidedPrompts],
}));

// Mock useMentorSettings
const mockUseMentorSettings = vi.fn();
vi.mock('../use-mentors/use-mentor-settings', () => ({
  useMentorSettings: () => mockUseMentorSettings(),
}));

import useWelcome from '../use-welcome-message';

describe('useWelcome', () => {
  let mockWebSocketInstance: {
    send: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    onmessage: ((event: MessageEvent) => void) | null;
    onopen: (() => void) | null;
    readyState: number;
  };
  let MockWebSocketConstructor: ReturnType<typeof vi.fn>;

  const defaultProps = {
    sessionId: 'session-123',
    username: 'testuser',
    tenantKey: 'tenant-1',
    mentorUniqueId: 'mentor-123',
    token: 'test-token',
    wsUrl: 'wss://test-url',
    isNewSession: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock WebSocket instance
    mockWebSocketInstance = {
      send: vi.fn(),
      close: vi.fn(),
      onmessage: null,
      onopen: null,
      readyState: 1, // OPEN
    };

    // Mock WebSocket constructor with constants
    const mockWsConstructor = vi.fn(() => mockWebSocketInstance);
    MockWebSocketConstructor = Object.assign(mockWsConstructor, {
      CONNECTING: 0,
      OPEN: 1,
      CLOSING: 2,
      CLOSED: 3,
    }) as typeof MockWebSocketConstructor;
    vi.stubGlobal('WebSocket', MockWebSocketConstructor);

    // Default mock return value
    mockUseMentorSettings.mockReturnValue({
      data: {
        greetingMethod: 'proactive_response',
        proactiveResponse: 'Hello! How can I help you?',
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('initial state', () => {
    it('should return empty welcome message initially when no mentor settings', () => {
      mockUseMentorSettings.mockReturnValue({ data: null });

      const { result } = renderHook(() => useWelcome(defaultProps));

      expect(result.current.welcomeMessage).toBe('');
    });

    it('should return handleSendProactivePrompt function', () => {
      const { result } = renderHook(() => useWelcome(defaultProps));

      expect(typeof result.current.handleSendProactivePrompt).toBe('function');
    });
  });

  describe('proactive_response greeting method', () => {
    it('should set welcome message from proactiveResponse', () => {
      mockUseMentorSettings.mockReturnValue({
        data: {
          greetingMethod: 'proactive_response',
          proactiveResponse: 'Welcome!',
        },
      });

      const { result } = renderHook(() => useWelcome(defaultProps));

      // Initial render should set the message
      expect(result.current.welcomeMessage).toBe('Welcome!');
    });

    it('should set empty string when proactiveResponse is null', () => {
      mockUseMentorSettings.mockReturnValue({
        data: {
          greetingMethod: 'proactive_response',
          proactiveResponse: null,
        },
      });

      const { result } = renderHook(() => useWelcome(defaultProps));

      expect(result.current.welcomeMessage).toBe('');
    });
  });

  describe('proactive_prompt greeting method', () => {
    beforeEach(() => {
      mockUseMentorSettings.mockReturnValue({
        data: {
          greetingMethod: 'proactive_prompt',
          proactiveResponse: null,
        },
      });
    });

    it('should create WebSocket connection when isNewSession is true', () => {
      renderHook(() => useWelcome(defaultProps));

      expect(MockWebSocketConstructor).toHaveBeenCalledWith('wss://test-url');
    });

    it('should not create WebSocket when isNewSession is false', () => {
      renderHook(() =>
        useWelcome({
          ...defaultProps,
          isNewSession: false,
        }),
      );

      expect(MockWebSocketConstructor).not.toHaveBeenCalled();
    });

    it('should set onmessage and onopen handlers', () => {
      renderHook(() => useWelcome(defaultProps));

      expect(mockWebSocketInstance.onmessage).not.toBeNull();
      expect(mockWebSocketInstance.onopen).not.toBeNull();
    });

    it('should accumulate welcome message from data responses', () => {
      const { result } = renderHook(() => useWelcome(defaultProps));

      // Simulate receiving data messages
      act(() => {
        mockWebSocketInstance.onmessage?.(
          new MessageEvent('message', {
            data: JSON.stringify({ data: 'Hello ' }),
          }),
        );
      });

      act(() => {
        mockWebSocketInstance.onmessage?.(
          new MessageEvent('message', {
            data: JSON.stringify({ data: 'World!' }),
          }),
        );
      });

      expect(result.current.welcomeMessage).toBe('Hello World!');
    });

    it('should handle error response and log it', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      renderHook(() => useWelcome(defaultProps));

      act(() => {
        mockWebSocketInstance.onmessage?.(
          new MessageEvent('message', {
            data: JSON.stringify({ error: 'Something went wrong' }),
          }),
        );
      });

      expect(consoleSpy).toHaveBeenCalledWith('Something went wrong');
      consoleSpy.mockRestore();
    });
  });

  describe('handleSendProactivePrompt', () => {
    it('should create WebSocket when called with proactive_prompt method', () => {
      mockUseMentorSettings.mockReturnValue({
        data: {
          greetingMethod: 'proactive_prompt',
          proactiveResponse: null,
        },
      });

      // Render with isNewSession false so it doesn't auto-connect
      const { result } = renderHook(() =>
        useWelcome({
          ...defaultProps,
          isNewSession: false,
        }),
      );

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      act(() => {
        result.current.handleSendProactivePrompt();
      });

      expect(MockWebSocketConstructor).toHaveBeenCalledWith('wss://test-url');
      consoleSpy.mockRestore();
    });

    it('should not create WebSocket when greeting method is not proactive_prompt', () => {
      mockUseMentorSettings.mockReturnValue({
        data: {
          greetingMethod: 'proactive_response',
          proactiveResponse: 'Hello',
        },
      });

      const { result } = renderHook(() =>
        useWelcome({
          ...defaultProps,
          isNewSession: false,
        }),
      );

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      act(() => {
        result.current.handleSendProactivePrompt();
      });

      expect(MockWebSocketConstructor).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('should not initiate when mentorUniqueId is empty', () => {
      mockUseMentorSettings.mockReturnValue({
        data: {
          greetingMethod: 'proactive_prompt',
          proactiveResponse: null,
        },
      });

      renderHook(() =>
        useWelcome({
          ...defaultProps,
          mentorUniqueId: '',
        }),
      );

      expect(MockWebSocketConstructor).not.toHaveBeenCalled();
    });

    it('should handle onopen and send initial payload when readyState is OPEN', () => {
      mockUseMentorSettings.mockReturnValue({
        data: {
          greetingMethod: 'proactive_prompt',
          proactiveResponse: null,
        },
      });

      // Ensure readyState matches WebSocket.OPEN (which is 1)
      mockWebSocketInstance.readyState = WebSocket.OPEN;

      renderHook(() => useWelcome(defaultProps));

      // Trigger onopen
      act(() => {
        mockWebSocketInstance.onopen?.();
      });

      expect(mockWebSocketInstance.send).toHaveBeenCalled();
    });

    it('should send proactive query after receiving connection confirmation', () => {
      mockUseMentorSettings.mockReturnValue({
        data: {
          greetingMethod: 'proactive_prompt',
          proactiveResponse: null,
        },
      });

      // Ensure readyState is OPEN
      mockWebSocketInstance.readyState = WebSocket.OPEN;

      renderHook(() => useWelcome(defaultProps));

      // Trigger onopen first
      act(() => {
        mockWebSocketInstance.onopen?.();
      });

      // Clear previous calls (from _initiateConnection)
      mockWebSocketInstance.send.mockClear();

      // Send connection confirmation
      act(() => {
        mockWebSocketInstance.onmessage?.(
          new MessageEvent('message', {
            data: JSON.stringify({ detail: 'Connected.' }),
          }),
        );
      });

      expect(mockWebSocketInstance.send).toHaveBeenCalled();
      const callArg = mockWebSocketInstance.send.mock.calls[0][0];
      expect(callArg).toContain('"is_proactive":true');
    });

    it('should not send if WebSocket is not open state', () => {
      mockUseMentorSettings.mockReturnValue({
        data: {
          greetingMethod: 'proactive_prompt',
          proactiveResponse: null,
        },
      });

      // Set readyState to CONNECTING (0) - not OPEN
      mockWebSocketInstance.readyState = WebSocket.CONNECTING;

      renderHook(() => useWelcome(defaultProps));

      // Trigger onopen but readyState is still CONNECTING
      act(() => {
        mockWebSocketInstance.onopen?.();
      });

      expect(mockWebSocketInstance.send).not.toHaveBeenCalled();
    });

    it('should handle error in _initiateConnection gracefully', () => {
      mockUseMentorSettings.mockReturnValue({
        data: {
          greetingMethod: 'proactive_prompt',
          proactiveResponse: null,
        },
      });

      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Set readyState to OPEN so send will be attempted
      mockWebSocketInstance.readyState = WebSocket.OPEN;

      mockWebSocketInstance.send.mockImplementation(() => {
        throw new Error('Send failed');
      });

      renderHook(() => useWelcome(defaultProps));

      // Trigger onopen
      act(() => {
        mockWebSocketInstance.onopen?.();
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should close connection and load guided prompts on eos response', async () => {
      vi.useFakeTimers();

      mockUseMentorSettings.mockReturnValue({
        data: {
          greetingMethod: 'proactive_prompt',
          proactiveResponse: null,
        },
      });

      mockWebSocketInstance.readyState = WebSocket.OPEN;

      renderHook(() => useWelcome(defaultProps));

      // Simulate receiving eos message
      act(() => {
        mockWebSocketInstance.onmessage?.(
          new MessageEvent('message', {
            data: JSON.stringify({ eos: true }),
          }),
        );
      });

      // Advance timers to trigger the setTimeout callback (200ms)
      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      // Should have closed the connection
      expect(mockWebSocketInstance.close).toHaveBeenCalled();

      // Should have loaded guided prompts
      expect(mockLoadGuidedPrompts).toHaveBeenCalledWith({
        org: 'tenant-1',
        sessionId: 'session-123',
        userId: 'testuser',
      });

      vi.useRealTimers();
    });
  });
});
