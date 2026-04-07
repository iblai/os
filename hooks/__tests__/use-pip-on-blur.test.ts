import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterEach,
  Mock,
} from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { Track, ParticipantEvent, RoomEvent } from 'livekit-client';

// Create a complete mock PIP document that works with copyStyles
const createMockPipDocument = (
  elementCallback?: (tag: string, element: any) => void,
) => {
  const eventListeners: Record<string, Function[]> = {};

  return {
    createElement: vi.fn((tag: string) => {
      const elemEventListeners: Record<string, Function[]> = {};
      const element = {
        tag,
        id: '',
        style: {
          cssText: '',
          display: '',
          borderColor: '',
          background: '',
          boxShadow: '',
          transform: '',
        },
        textContent: '',
        title: '',
        innerHTML: '',
        src: '',
        rel: '',
        href: '',
        autoplay: false,
        muted: false,
        playsInline: false,
        allow: '',
        children: [] as any[],
        appendChild: vi.fn((child: any) => {
          element.children.push(child);
          return child;
        }),
        removeEventListener: vi.fn((event: string, handler: Function) => {
          const listeners = elemEventListeners[event];
          if (listeners) {
            const idx = listeners.indexOf(handler);
            if (idx > -1) listeners.splice(idx, 1);
          }
        }),
        addEventListener: vi.fn((event: string, handler: Function) => {
          if (!elemEventListeners[event]) {
            elemEventListeners[event] = [];
          }
          elemEventListeners[event].push(handler);
        }),
        setAttribute: vi.fn(),
        createTextNode: vi.fn((text: string) => ({ text })),
        _eventListeners: elemEventListeners,
        _triggerEvent: (event: string, ...args: unknown[]) => {
          elemEventListeners[event]?.forEach((h) => h(...args));
        },
      };
      elementCallback?.(tag, element);
      return element;
    }),
    createTextNode: vi.fn((text: string) => ({ text })),
    head: {
      appendChild: vi.fn(),
    },
    body: {
      appendChild: vi.fn(),
    },
    styleSheets: [],
    _windowEventListeners: eventListeners,
  };
};

// Create mock PIP window
const createMockPipWindow = (
  elementCallback?: (tag: string, element: any) => void,
) => {
  const eventListeners: Record<string, Function[]> = {};
  const mockDocument = createMockPipDocument(elementCallback);

  const pipWindow = {
    document: mockDocument,
    close: vi.fn(),
    addEventListener: vi.fn((event: string, handler: Function) => {
      if (!eventListeners[event]) {
        eventListeners[event] = [];
      }
      eventListeners[event].push(handler);
    }),
    removeEventListener: vi.fn(),
    // Helper to trigger events in tests
    _triggerEvent: (event: string) => {
      eventListeners[event]?.forEach((handler) => handler());
    },
    _eventListeners: eventListeners,
  };

  return pipWindow;
};

// Create a mock remote participant
const createMockRemoteParticipant = (
  overrides?: Partial<{ isSpeaking: boolean }>,
) => {
  const eventListeners: Record<string, Function[]> = {};
  return {
    isSpeaking: overrides?.isSpeaking ?? false,
    setVolume: vi.fn(),
    on: vi.fn((event: string, handler: Function) => {
      if (!eventListeners[event]) {
        eventListeners[event] = [];
      }
      eventListeners[event].push(handler);
    }),
    off: vi.fn((event: string, handler: Function) => {
      const listeners = eventListeners[event];
      if (listeners) {
        const index = listeners.indexOf(handler);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    }),
    _triggerEvent: (event: string, ...args: unknown[]) => {
      eventListeners[event]?.forEach((handler) => handler(...args));
    },
    _eventListeners: eventListeners,
  };
};

// Create mock Room
const createMockRoom = (
  overrides?: Partial<{
    isMicrophoneEnabled: boolean;
    isSpeaking: boolean;
  }>,
) => {
  const participantEventListeners: Record<string, Function[]> = {};
  const roomEventListeners: Record<string, Function[]> = {};

  const mockLocalParticipant = {
    isMicrophoneEnabled: overrides?.isMicrophoneEnabled ?? true,
    isSpeaking: overrides?.isSpeaking ?? false,
    setMicrophoneEnabled: vi.fn().mockResolvedValue(undefined),
    trackPublications: new Map(),
    on: vi.fn((event: string, handler: Function) => {
      if (!participantEventListeners[event]) {
        participantEventListeners[event] = [];
      }
      participantEventListeners[event].push(handler);
    }),
    off: vi.fn((event: string, handler: Function) => {
      const listeners = participantEventListeners[event];
      if (listeners) {
        const index = listeners.indexOf(handler);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    }),
    // Helper to trigger participant events in tests
    _triggerEvent: (event: string, ...args: unknown[]) => {
      participantEventListeners[event]?.forEach((handler) => handler(...args));
    },
    _eventListeners: participantEventListeners,
  };

  const mockRemoteParticipant = createMockRemoteParticipant({
    isSpeaking: overrides?.isSpeaking ?? false,
  });

  const remoteParticipants = new Map([
    ['remote-participant-1', mockRemoteParticipant],
  ]);

  return {
    localParticipant: mockLocalParticipant,
    remoteParticipants,
    _mockRemoteParticipant: mockRemoteParticipant,
    on: vi.fn((event: string, handler: Function) => {
      if (!roomEventListeners[event]) {
        roomEventListeners[event] = [];
      }
      roomEventListeners[event].push(handler);
    }),
    off: vi.fn(),
    _roomEventListeners: roomEventListeners,
    _triggerRoomEvent: (event: string, ...args: unknown[]) => {
      roomEventListeners[event]?.forEach((handler) => handler(...args));
    },
  };
};

// Mock documentPictureInPicture API
let mockPipWindow: ReturnType<typeof createMockPipWindow> | null = null;
const mockRequestWindow = vi.fn();

describe('usePipOnBlur', () => {
  // Pre-import the module before fake timers are active to avoid timeout
  beforeAll(async () => {
    await import('../use-pip-on-blur');
  });

  let originalDocumentPictureInPicture: typeof window.documentPictureInPicture;
  let originalStyleSheets: StyleSheetList;
  let originalOpener: Window | null;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();

    // Store original values
    originalDocumentPictureInPicture = window.documentPictureInPicture;
    originalStyleSheets = document.styleSheets;
    originalOpener = window.opener;

    // Setup mock PIP window
    mockPipWindow = createMockPipWindow();
    mockRequestWindow.mockResolvedValue(mockPipWindow);

    // Mock documentPictureInPicture API
    Object.defineProperty(window, 'documentPictureInPicture', {
      value: {
        requestWindow: mockRequestWindow,
        window: null,
      },
      writable: true,
      configurable: true,
    });

    // Mock styleSheets
    Object.defineProperty(document, 'styleSheets', {
      value: [],
      writable: true,
      configurable: true,
    });

    // Mock window.opener
    Object.defineProperty(window, 'opener', {
      value: null,
      writable: true,
      configurable: true,
    });

    // Suppress console output
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();

    // Restore original values
    Object.defineProperty(window, 'documentPictureInPicture', {
      value: originalDocumentPictureInPicture,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(document, 'styleSheets', {
      value: originalStyleSheets,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, 'opener', {
      value: originalOpener,
      writable: true,
      configurable: true,
    });

    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();

    mockPipWindow = null;
  });

  // Import hook after mocks are set up
  const getHook = async () => {
    const module = await import('../use-pip-on-blur');
    return module.usePipOnBlur;
  };

  describe('initialization', () => {
    it('should return isPipOpen, openPip, and closePip', async () => {
      const usePipOnBlur = await getHook();
      const { result } = renderHook(() =>
        usePipOnBlur({
          enabled: false,
          width: 400,
          height: 600,
        }),
      );

      expect(result.current).toHaveProperty('isPipOpen');
      expect(result.current).toHaveProperty('openPip');
      expect(result.current).toHaveProperty('closePip');
      expect(typeof result.current.openPip).toBe('function');
      expect(typeof result.current.closePip).toBe('function');
    });

    it('should not open PIP when disabled', async () => {
      const usePipOnBlur = await getHook();
      renderHook(() =>
        usePipOnBlur({
          enabled: false,
        }),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(mockRequestWindow).not.toHaveBeenCalled();
    });

    it('should open PIP when enabled', async () => {
      const usePipOnBlur = await getHook();
      renderHook(() =>
        usePipOnBlur({
          enabled: true,
        }),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(mockRequestWindow).toHaveBeenCalled();
    });
  });

  describe('PIP window options', () => {
    it('should pass width and height to requestWindow', async () => {
      const usePipOnBlur = await getHook();
      renderHook(() =>
        usePipOnBlur({
          enabled: true,
          width: 500,
          height: 700,
        }),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(mockRequestWindow).toHaveBeenCalledWith({
        width: 500,
        height: 700,
      });
    });

    it('should use default width and height when not provided', async () => {
      const usePipOnBlur = await getHook();
      renderHook(() =>
        usePipOnBlur({
          enabled: true,
        }),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(mockRequestWindow).toHaveBeenCalledWith({
        width: 400,
        height: 600,
      });
    });
  });

  describe('callbacks', () => {
    it('should call onOpen when PIP opens', async () => {
      const onOpen = vi.fn();
      const usePipOnBlur = await getHook();
      renderHook(() =>
        usePipOnBlur({
          enabled: true,
          onOpen,
        }),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(onOpen).toHaveBeenCalled();
    });

    it('should call onClose when PIP closes via pagehide', async () => {
      const onClose = vi.fn();
      const usePipOnBlur = await getHook();
      renderHook(() =>
        usePipOnBlur({
          enabled: true,
          onClose,
        }),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Simulate pagehide event
      act(() => {
        mockPipWindow?._triggerEvent('pagehide');
      });

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('closePip', () => {
    it('should close PIP window when called', async () => {
      const usePipOnBlur = await getHook();
      const { result } = renderHook(() =>
        usePipOnBlur({
          enabled: true,
        }),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      act(() => {
        result.current.closePip();
      });

      expect(mockPipWindow?.close).toHaveBeenCalled();
    });

    it('should close PIP when enabled changes to false', async () => {
      const usePipOnBlur = await getHook();
      const { rerender } = renderHook(
        ({ enabled }) =>
          usePipOnBlur({
            enabled,
          }),
        { initialProps: { enabled: true } },
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      rerender({ enabled: false });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(mockPipWindow?.close).toHaveBeenCalled();
    });
  });

  describe('API not supported', () => {
    it('should warn when documentPictureInPicture is not supported', async () => {
      Object.defineProperty(window, 'documentPictureInPicture', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const usePipOnBlur = await getHook();
      const { result } = renderHook(() =>
        usePipOnBlur({
          enabled: true,
        }),
      );

      await act(async () => {
        result.current.openPip();
        await vi.runAllTimersAsync();
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Document Picture-in-Picture API is not supported',
      );
    });
  });

  describe('error handling', () => {
    it('should handle requestWindow errors gracefully', async () => {
      mockRequestWindow.mockRejectedValue(new Error('PIP not allowed'));

      const usePipOnBlur = await getHook();
      renderHook(() =>
        usePipOnBlur({
          enabled: true,
        }),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to open Picture-in-Picture window:',
        expect.any(Error),
      );
    });
  });

  describe('prevent multiple opens', () => {
    it('should not open PIP if already opening', async () => {
      // Create a delayed promise to simulate slow opening
      let resolveWindow: (value: unknown) => void;
      const delayedPromise = new Promise((resolve) => {
        resolveWindow = resolve;
      });
      mockRequestWindow.mockReturnValue(delayedPromise);

      const usePipOnBlur = await getHook();
      const { result } = renderHook(() =>
        usePipOnBlur({
          enabled: true,
        }),
      );

      // First call starts opening
      await act(async () => {
        result.current.openPip();
      });

      // Second call should be skipped
      await act(async () => {
        result.current.openPip();
      });

      expect(mockRequestWindow).toHaveBeenCalledTimes(1);

      // Resolve the promise
      await act(async () => {
        resolveWindow!(mockPipWindow);
        await vi.runAllTimersAsync();
      });
    });

    it('should close stale PIP window before reopening', async () => {
      const stalePipWindow = { close: vi.fn() };
      Object.defineProperty(window, 'documentPictureInPicture', {
        value: {
          requestWindow: mockRequestWindow,
          window: stalePipWindow,
        },
        writable: true,
        configurable: true,
      });

      const usePipOnBlur = await getHook();
      renderHook(() =>
        usePipOnBlur({
          enabled: true,
        }),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(stalePipWindow.close).toHaveBeenCalled();
    });
  });

  describe('cooldown after close', () => {
    it('should not reopen immediately after close', async () => {
      const usePipOnBlur = await getHook();
      const { result } = renderHook(() =>
        usePipOnBlur({
          enabled: true,
        }),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Close PIP
      act(() => {
        result.current.closePip();
      });

      mockRequestWindow.mockClear();

      // Try to open immediately
      await act(async () => {
        result.current.openPip();
      });

      expect(mockRequestWindow).not.toHaveBeenCalled();

      // After cooldown
      await act(async () => {
        vi.advanceTimersByTime(1600);
      });

      await act(async () => {
        result.current.openPip();
        await vi.runAllTimersAsync();
      });

      expect(mockRequestWindow).toHaveBeenCalled();
    });
  });

  describe('with LiveKit room', () => {
    it('should create screen share preview when room is provided', async () => {
      const mockRoom = createMockRoom();
      const usePipOnBlur = await getHook();
      renderHook(() =>
        usePipOnBlur({
          enabled: true,
          room: mockRoom as any,
          screenSharePreviewHeight: 30,
        }),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Verify video element was created
      expect(mockPipWindow?.document.createElement).toHaveBeenCalledWith(
        'video',
      );
    });

    it('should not create screen share preview when screenSharePreviewHeight is 0', async () => {
      const mockRoom = createMockRoom();
      const usePipOnBlur = await getHook();

      // Reset createElement mock to track calls
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockPipWindow!.document.createElement = vi.fn((_tag: string) => ({
        style: { cssText: '' },
        textContent: '',
        innerHTML: '',
        appendChild: vi.fn(),
        addEventListener: vi.fn(),
        setAttribute: vi.fn(),
      })) as any;

      renderHook(() =>
        usePipOnBlur({
          enabled: true,
          room: mockRoom as any,
          screenSharePreviewHeight: 0,
        }),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Video element should not be created when screenSharePreviewHeight is 0
      const createElementCalls = (mockPipWindow?.document.createElement as Mock)
        .mock.calls;
      const videoCreated = createElementCalls.some(
        (call: unknown[]) => (call[0] as string) === 'video',
      );
      expect(videoCreated).toBe(false);
    });

    it('should create audio status bar when room is provided', async () => {
      const mockRoom = createMockRoom();
      const usePipOnBlur = await getHook();
      renderHook(() =>
        usePipOnBlur({
          enabled: true,
          room: mockRoom as any,
        }),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Verify button (mute button) was created
      expect(mockPipWindow?.document.createElement).toHaveBeenCalledWith(
        'button',
      );
    });
  });

  describe('chat component', () => {
    it('should create chat container when room is provided', async () => {
      const mockRoom = createMockRoom();
      const usePipOnBlur = await getHook();

      const createdElements: { tag: string; element: any }[] = [];
      const originalCreateElement = mockPipWindow!.document.createElement;

      mockPipWindow!.document.createElement = vi.fn((tag: string) => {
        const element = originalCreateElement(tag);
        createdElements.push({ tag, element });
        return element;
      }) as any;

      renderHook(() =>
        usePipOnBlur({
          enabled: true,
          room: mockRoom as any,
        }),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Verify chat container div was created with correct id
      const chatContainer = createdElements.find(
        ({ element }) => element.id === 'pip-chat-root',
      );
      expect(chatContainer).toBeDefined();
    });

    it('should not create iframe anymore (uses React chat instead)', async () => {
      const mockRoom = createMockRoom();
      const usePipOnBlur = await getHook();

      const createdElements: { tag: string; element: any }[] = [];
      const originalCreateElement = mockPipWindow!.document.createElement;

      mockPipWindow!.document.createElement = vi.fn((tag: string) => {
        const element = originalCreateElement(tag);
        createdElements.push({ tag, element });
        return element;
      }) as any;

      renderHook(() =>
        usePipOnBlur({
          enabled: true,
          room: mockRoom as any,
        }),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Verify no iframe was created
      const iframe = createdElements.find(({ tag }) => tag === 'iframe');
      expect(iframe).toBeUndefined();
    });
  });

  describe('copyStyles', () => {
    it('should copy stylesheets with cssRules', async () => {
      const mockCssRule = { cssText: '.test { color: red; }' };
      const mockStyleSheet = {
        cssRules: [mockCssRule],
        href: null,
      };

      Object.defineProperty(document, 'styleSheets', {
        value: [mockStyleSheet],
        writable: true,
        configurable: true,
      });

      const usePipOnBlur = await getHook();
      renderHook(() =>
        usePipOnBlur({
          enabled: true,
        }),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Verify style element was created and appended to head
      expect(mockPipWindow?.document.createElement).toHaveBeenCalledWith(
        'style',
      );
      expect(mockPipWindow?.document.head.appendChild).toHaveBeenCalled();
    });

    it('should copy stylesheets with href when cssRules exist', async () => {
      const mockStyleSheet = {
        cssRules: null,
        href: 'https://example.com/styles.css',
      };

      Object.defineProperty(document, 'styleSheets', {
        value: [mockStyleSheet],
        writable: true,
        configurable: true,
      });

      const usePipOnBlur = await getHook();
      renderHook(() =>
        usePipOnBlur({
          enabled: true,
        }),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(mockPipWindow?.document.createElement).toHaveBeenCalledWith(
        'link',
      );
    });

    it('should handle cross-origin stylesheet errors', async () => {
      const mockStyleSheet = {
        get cssRules() {
          throw new Error('Cross-origin stylesheet');
        },
        href: 'https://external.com/styles.css',
      };

      Object.defineProperty(document, 'styleSheets', {
        value: [mockStyleSheet],
        writable: true,
        configurable: true,
      });

      const usePipOnBlur = await getHook();
      renderHook(() =>
        usePipOnBlur({
          enabled: true,
        }),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Should create link element as fallback
      expect(mockPipWindow?.document.createElement).toHaveBeenCalledWith(
        'link',
      );
    });
  });
});

describe('createAudioStatusBar', () => {
  let mockRoom: ReturnType<typeof createMockRoom>;
  let mockPipDoc: any;
  let createdElements: Record<string, any>;
  let originalOpener: Window | null;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    createdElements = {};
    let elementCounter = 0;

    mockPipDoc = {
      createElement: vi.fn((tag: string) => {
        const id = `${tag}-${elementCounter++}`;
        const eventListeners: Record<string, Function[]> = {};
        const element = {
          id,
          tag,
          style: {
            cssText: '',
            display: '',
            borderColor: '',
            background: '',
            boxShadow: '',
            transform: '',
          },
          textContent: '',
          innerHTML: '',
          title: '',
          appendChild: vi.fn((child: any) => {
            element.children.push(child);
          }),
          addEventListener: vi.fn((event: string, handler: Function) => {
            if (!eventListeners[event]) {
              eventListeners[event] = [];
            }
            eventListeners[event].push(handler);
          }),
          removeEventListener: vi.fn((event: string, handler: Function) => {
            const listeners = eventListeners[event];
            if (listeners) {
              const index = listeners.indexOf(handler);
              if (index > -1) {
                listeners.splice(index, 1);
              }
            }
          }),
          setAttribute: vi.fn(),
          children: [] as any[],
          _eventListeners: eventListeners,
          _triggerEvent: (event: string, ...args: unknown[]) => {
            eventListeners[event]?.forEach((handler) => handler(...args));
          },
        };
        createdElements[id] = element;
        return element;
      }),
      createTextNode: vi.fn((text: string) => ({ text })),
      head: {
        appendChild: vi.fn(),
      },
      body: {
        appendChild: vi.fn(),
      },
    };

    mockRoom = createMockRoom();
    originalOpener = window.opener;

    Object.defineProperty(window, 'opener', {
      value: {
        closed: false,
        postMessage: vi.fn(),
      },
      writable: true,
      configurable: true,
    });

    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    Object.defineProperty(window, 'opener', {
      value: originalOpener,
      writable: true,
      configurable: true,
    });
    consoleErrorSpy.mockRestore();
  });

  // Helper to get the createAudioStatusBar function by accessing it through the hook
  const getCreateAudioStatusBar = async () => {
    // We need to test the internal createAudioStatusBar function
    // Since it's not exported, we'll test it through the hook behavior
    const module = await import('../use-pip-on-blur');
    return module;
  };

  describe('speaking indicator', () => {
    it('should update speaking indicator when remote participant starts speaking', async () => {
      vi.useFakeTimers();

      const mockRequestWindow = vi.fn().mockResolvedValue({
        document: mockPipDoc,
        close: vi.fn(),
        addEventListener: vi.fn(),
      });

      Object.defineProperty(window, 'documentPictureInPicture', {
        value: {
          requestWindow: mockRequestWindow,
          window: null,
        },
        writable: true,
        configurable: true,
      });

      const { usePipOnBlur } = await getCreateAudioStatusBar();
      renderHook(() =>
        usePipOnBlur({
          enabled: true,
          room: mockRoom as any,
        }),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Trigger speaking event on remote participant
      act(() => {
        mockRoom._mockRemoteParticipant._triggerEvent(
          ParticipantEvent.IsSpeakingChanged,
          true,
        );
      });

      // Verify postMessage was called with speaking status
      expect((window.opener as any).postMessage).toHaveBeenCalledWith(
        { type: 'MENTOR:SCREENSHARING_MENTOR_SPEAKING', speaking: true },
        '*',
      );

      vi.useRealTimers();
    });

    it('should update speaking indicator when remote participant stops speaking', async () => {
      vi.useFakeTimers();

      const mockRequestWindow = vi.fn().mockResolvedValue({
        document: mockPipDoc,
        close: vi.fn(),
        addEventListener: vi.fn(),
      });

      Object.defineProperty(window, 'documentPictureInPicture', {
        value: {
          requestWindow: mockRequestWindow,
          window: null,
        },
        writable: true,
        configurable: true,
      });

      const { usePipOnBlur } = await getCreateAudioStatusBar();
      renderHook(() =>
        usePipOnBlur({
          enabled: true,
          room: mockRoom as any,
        }),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Trigger stop speaking event on remote participant
      act(() => {
        mockRoom._mockRemoteParticipant._triggerEvent(
          ParticipantEvent.IsSpeakingChanged,
          false,
        );
      });

      expect((window.opener as any).postMessage).toHaveBeenCalledWith(
        { type: 'MENTOR:SCREENSHARING_MENTOR_SPEAKING', speaking: false },
        '*',
      );

      vi.useRealTimers();
    });

    it('should update mic speaking indicator when local participant starts speaking', async () => {
      vi.useFakeTimers();

      const mockRequestWindow = vi.fn().mockResolvedValue({
        document: mockPipDoc,
        close: vi.fn(),
        addEventListener: vi.fn(),
      });

      Object.defineProperty(window, 'documentPictureInPicture', {
        value: {
          requestWindow: mockRequestWindow,
          window: null,
        },
        writable: true,
        configurable: true,
      });

      const { usePipOnBlur } = await getCreateAudioStatusBar();
      renderHook(() =>
        usePipOnBlur({
          enabled: true,
          room: mockRoom as any,
        }),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Trigger speaking event on local participant
      act(() => {
        mockRoom.localParticipant._triggerEvent(
          ParticipantEvent.IsSpeakingChanged,
          true,
        );
      });

      // Verify postMessage was called with local speaking status
      expect((window.opener as any).postMessage).toHaveBeenCalledWith(
        { type: 'MENTOR:SCREENSHARING_SPEAKING', speaking: true },
        '*',
      );

      vi.useRealTimers();
    });
  });

  describe('mentor mute button', () => {
    it('should mute mentor audio when mentor mute button is clicked', async () => {
      vi.useFakeTimers();

      const buttons: any[] = [];
      const mockPipWindow = createMockPipWindow((tag, element) => {
        if (tag === 'button') {
          buttons.push(element);
        }
      });
      const mockRequestWindow = vi.fn().mockResolvedValue(mockPipWindow);

      Object.defineProperty(window, 'documentPictureInPicture', {
        value: {
          requestWindow: mockRequestWindow,
          window: null,
        },
        writable: true,
        configurable: true,
      });

      const { usePipOnBlur } = await getCreateAudioStatusBar();
      renderHook(() =>
        usePipOnBlur({
          enabled: true,
          room: mockRoom as any,
        }),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // First button is the mentor mute button
      const mentorMuteButton = buttons[0];

      // Click mentor mute button
      act(() => {
        mentorMuteButton._triggerEvent('click');
      });

      // Should have set volume to 0 on remote participant
      expect(mockRoom._mockRemoteParticipant.setVolume).toHaveBeenCalledWith(0);

      // Should have posted mentor muted status
      expect((window.opener as any).postMessage).toHaveBeenCalledWith(
        { type: 'MENTOR:SCREENSHARING_MENTOR_MUTED', muted: true },
        '*',
      );

      vi.useRealTimers();
    });

    it('should unmute mentor audio when mentor mute button is clicked again', async () => {
      vi.useFakeTimers();

      const buttons: any[] = [];
      const mockPipWindow = createMockPipWindow((tag, element) => {
        if (tag === 'button') {
          buttons.push(element);
        }
      });
      const mockRequestWindow = vi.fn().mockResolvedValue(mockPipWindow);

      Object.defineProperty(window, 'documentPictureInPicture', {
        value: {
          requestWindow: mockRequestWindow,
          window: null,
        },
        writable: true,
        configurable: true,
      });

      const { usePipOnBlur } = await getCreateAudioStatusBar();
      renderHook(() =>
        usePipOnBlur({
          enabled: true,
          room: mockRoom as any,
        }),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      const mentorMuteButton = buttons[0];

      // Click mute button twice (mute then unmute)
      act(() => {
        mentorMuteButton._triggerEvent('click');
      });
      act(() => {
        mentorMuteButton._triggerEvent('click');
      });

      // Should have set volume to 1 on the second click
      expect(
        mockRoom._mockRemoteParticipant.setVolume,
      ).toHaveBeenLastCalledWith(1);

      // Should have posted unmuted status
      expect((window.opener as any).postMessage).toHaveBeenLastCalledWith(
        { type: 'MENTOR:SCREENSHARING_MENTOR_MUTED', muted: false },
        '*',
      );

      vi.useRealTimers();
    });

    it('should handle mentor mute button click error gracefully', async () => {
      vi.useFakeTimers();

      // Make setVolume throw
      mockRoom._mockRemoteParticipant.setVolume = vi
        .fn()
        .mockImplementation(() => {
          throw new Error('Permission denied');
        });

      const buttons: any[] = [];
      const mockPipWindow = createMockPipWindow((tag, element) => {
        if (tag === 'button') {
          buttons.push(element);
        }
      });
      const mockRequestWindow = vi.fn().mockResolvedValue(mockPipWindow);

      Object.defineProperty(window, 'documentPictureInPicture', {
        value: {
          requestWindow: mockRequestWindow,
          window: null,
        },
        writable: true,
        configurable: true,
      });

      const { usePipOnBlur } = await getCreateAudioStatusBar();
      renderHook(() =>
        usePipOnBlur({
          enabled: true,
          room: mockRoom as any,
        }),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      const mentorMuteButton = buttons[0];

      // Click mentor mute button - should not throw
      act(() => {
        mentorMuteButton._triggerEvent('click');
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to toggle mentor audio:',
        expect.any(Error),
      );

      vi.useRealTimers();
    });

    it('should toggle mentor audio when receiving MENTOR:SCREENSHARING_MENTOR_MUTED message', async () => {
      vi.useFakeTimers();

      const mockRequestWindow = vi.fn().mockResolvedValue({
        document: mockPipDoc,
        close: vi.fn(),
        addEventListener: vi.fn(),
      });

      Object.defineProperty(window, 'documentPictureInPicture', {
        value: {
          requestWindow: mockRequestWindow,
          window: null,
        },
        writable: true,
        configurable: true,
      });

      const { usePipOnBlur } = await getCreateAudioStatusBar();
      renderHook(() =>
        usePipOnBlur({
          enabled: true,
          room: mockRoom as any,
        }),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Simulate receiving MENTOR:SCREENSHARING_MENTOR_MUTED from opener
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: { type: 'MENTOR:SCREENSHARING_MENTOR_MUTED' },
          }),
        );
      });

      // Should have set volume to 0 on remote participant (first toggle = mute)
      expect(mockRoom._mockRemoteParticipant.setVolume).toHaveBeenCalledWith(0);

      // Should have posted mentor muted status back to opener
      expect((window.opener as any).postMessage).toHaveBeenCalledWith(
        { type: 'MENTOR:SCREENSHARING_MENTOR_MUTED', muted: true },
        '*',
      );

      vi.useRealTimers();
    });
  });

  describe('mic mute button', () => {
    it('should update mic mute button when track is muted', async () => {
      vi.useFakeTimers();

      const mockRequestWindow = vi.fn().mockResolvedValue({
        document: mockPipDoc,
        close: vi.fn(),
        addEventListener: vi.fn(),
      });

      Object.defineProperty(window, 'documentPictureInPicture', {
        value: {
          requestWindow: mockRequestWindow,
          window: null,
        },
        writable: true,
        configurable: true,
      });

      const { usePipOnBlur } = await getCreateAudioStatusBar();
      renderHook(() =>
        usePipOnBlur({
          enabled: true,
          room: mockRoom as any,
        }),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Trigger track muted event
      act(() => {
        mockRoom.localParticipant._triggerEvent(ParticipantEvent.TrackMuted, {
          source: Track.Source.Microphone,
        });
      });

      expect((window.opener as any).postMessage).toHaveBeenCalledWith(
        { type: 'MENTOR:SCREENSHARING_MUTED', muted: true },
        '*',
      );

      vi.useRealTimers();
    });

    it('should update mic mute button when track is unmuted', async () => {
      vi.useFakeTimers();

      const mockRequestWindow = vi.fn().mockResolvedValue({
        document: mockPipDoc,
        close: vi.fn(),
        addEventListener: vi.fn(),
      });

      Object.defineProperty(window, 'documentPictureInPicture', {
        value: {
          requestWindow: mockRequestWindow,
          window: null,
        },
        writable: true,
        configurable: true,
      });

      const { usePipOnBlur } = await getCreateAudioStatusBar();
      renderHook(() =>
        usePipOnBlur({
          enabled: true,
          room: mockRoom as any,
        }),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Trigger track unmuted event
      act(() => {
        mockRoom.localParticipant._triggerEvent(ParticipantEvent.TrackUnmuted, {
          source: Track.Source.Microphone,
        });
      });

      expect((window.opener as any).postMessage).toHaveBeenCalledWith(
        { type: 'MENTOR:SCREENSHARING_MUTED', muted: false },
        '*',
      );

      vi.useRealTimers();
    });

    it('should not update when non-microphone track is muted', async () => {
      vi.useFakeTimers();

      const mockRequestWindow = vi.fn().mockResolvedValue({
        document: mockPipDoc,
        close: vi.fn(),
        addEventListener: vi.fn(),
      });

      Object.defineProperty(window, 'documentPictureInPicture', {
        value: {
          requestWindow: mockRequestWindow,
          window: null,
        },
        writable: true,
        configurable: true,
      });

      const { usePipOnBlur } = await getCreateAudioStatusBar();
      renderHook(() =>
        usePipOnBlur({
          enabled: true,
          room: mockRoom as any,
        }),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Clear previous calls
      (window.opener as any).postMessage.mockClear();

      // Trigger track muted event for camera (not microphone)
      act(() => {
        mockRoom.localParticipant._triggerEvent(ParticipantEvent.TrackMuted, {
          source: Track.Source.Camera,
        });
      });

      // Should not have been called with muted status
      const mutedCalls = (window.opener as any).postMessage.mock.calls.filter(
        ([msg]: [any]) => msg.type === 'MENTOR:SCREENSHARING_MUTED',
      );
      expect(mutedCalls.length).toBe(0);

      vi.useRealTimers();
    });

    it('should toggle microphone when mic mute button is clicked', async () => {
      vi.useFakeTimers();

      const buttons: any[] = [];
      const mockPipWindow = createMockPipWindow((tag, element) => {
        if (tag === 'button') {
          buttons.push(element);
        }
      });
      const mockRequestWindow = vi.fn().mockResolvedValue(mockPipWindow);

      Object.defineProperty(window, 'documentPictureInPicture', {
        value: {
          requestWindow: mockRequestWindow,
          window: null,
        },
        writable: true,
        configurable: true,
      });

      const { usePipOnBlur } = await getCreateAudioStatusBar();
      renderHook(() =>
        usePipOnBlur({
          enabled: true,
          room: mockRoom as any,
        }),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Second button is the mic mute button
      const micMuteButton = buttons[1];

      // Click mic mute button
      await act(async () => {
        micMuteButton._triggerEvent('click');
        await vi.runAllTimersAsync();
      });

      // Should have toggled microphone
      expect(mockRoom.localParticipant.setMicrophoneEnabled).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should handle mic mute button click error gracefully', async () => {
      vi.useFakeTimers();

      mockRoom.localParticipant.setMicrophoneEnabled = vi
        .fn()
        .mockRejectedValue(new Error('Permission denied'));

      const buttons: any[] = [];
      const mockPipWindow = createMockPipWindow((tag, element) => {
        if (tag === 'button') {
          buttons.push(element);
        }
      });
      const mockRequestWindow = vi.fn().mockResolvedValue(mockPipWindow);

      Object.defineProperty(window, 'documentPictureInPicture', {
        value: {
          requestWindow: mockRequestWindow,
          window: null,
        },
        writable: true,
        configurable: true,
      });

      const { usePipOnBlur } = await getCreateAudioStatusBar();
      renderHook(() =>
        usePipOnBlur({
          enabled: true,
          room: mockRoom as any,
        }),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      const micMuteButton = buttons[1];

      // Click mic mute button - should not throw
      await act(async () => {
        await micMuteButton._triggerEvent('click');
        await vi.runAllTimersAsync();
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to toggle microphone:',
        expect.any(Error),
      );

      vi.useRealTimers();
    });

    it('should toggle microphone when receiving MENTOR:SCREENSHARING_MUTED message', async () => {
      vi.useFakeTimers();

      const mockRequestWindow = vi.fn().mockResolvedValue({
        document: mockPipDoc,
        close: vi.fn(),
        addEventListener: vi.fn(),
      });

      Object.defineProperty(window, 'documentPictureInPicture', {
        value: {
          requestWindow: mockRequestWindow,
          window: null,
        },
        writable: true,
        configurable: true,
      });

      const { usePipOnBlur } = await getCreateAudioStatusBar();
      renderHook(() =>
        usePipOnBlur({
          enabled: true,
          room: mockRoom as any,
        }),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Simulate receiving MENTOR:SCREENSHARING_MUTED from opener
      await act(async () => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: { type: 'MENTOR:SCREENSHARING_MUTED' },
          }),
        );
        await vi.runAllTimersAsync();
      });

      // Should have toggled microphone
      expect(mockRoom.localParticipant.setMicrophoneEnabled).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('postStatusToOpener', () => {
    it('should not post message when opener is closed', async () => {
      vi.useFakeTimers();

      Object.defineProperty(window, 'opener', {
        value: {
          closed: true,
          postMessage: vi.fn(),
        },
        writable: true,
        configurable: true,
      });

      const mockRequestWindow = vi.fn().mockResolvedValue({
        document: mockPipDoc,
        close: vi.fn(),
        addEventListener: vi.fn(),
      });

      Object.defineProperty(window, 'documentPictureInPicture', {
        value: {
          requestWindow: mockRequestWindow,
          window: null,
        },
        writable: true,
        configurable: true,
      });

      const { usePipOnBlur } = await getCreateAudioStatusBar();
      renderHook(() =>
        usePipOnBlur({
          enabled: true,
          room: mockRoom as any,
        }),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Trigger speaking event on remote participant
      act(() => {
        mockRoom._mockRemoteParticipant._triggerEvent(
          ParticipantEvent.IsSpeakingChanged,
          true,
        );
      });

      expect((window.opener as any).postMessage).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should not post message when opener is null', async () => {
      vi.useFakeTimers();

      Object.defineProperty(window, 'opener', {
        value: null,
        writable: true,
        configurable: true,
      });

      const mockRequestWindow = vi.fn().mockResolvedValue({
        document: mockPipDoc,
        close: vi.fn(),
        addEventListener: vi.fn(),
      });

      Object.defineProperty(window, 'documentPictureInPicture', {
        value: {
          requestWindow: mockRequestWindow,
          window: null,
        },
        writable: true,
        configurable: true,
      });

      const { usePipOnBlur } = await getCreateAudioStatusBar();
      renderHook(() =>
        usePipOnBlur({
          enabled: true,
          room: mockRoom as any,
        }),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Should not throw when triggering events with null opener
      act(() => {
        mockRoom._mockRemoteParticipant._triggerEvent(
          ParticipantEvent.IsSpeakingChanged,
          true,
        );
      });

      vi.useRealTimers();
    });

    it('should handle postMessage errors gracefully', async () => {
      vi.useFakeTimers();

      Object.defineProperty(window, 'opener', {
        value: {
          closed: false,
          postMessage: vi.fn().mockImplementation(() => {
            throw new Error('Cross-origin error');
          }),
        },
        writable: true,
        configurable: true,
      });

      const mockRequestWindow = vi.fn().mockResolvedValue({
        document: mockPipDoc,
        close: vi.fn(),
        addEventListener: vi.fn(),
      });

      Object.defineProperty(window, 'documentPictureInPicture', {
        value: {
          requestWindow: mockRequestWindow,
          window: null,
        },
        writable: true,
        configurable: true,
      });

      const { usePipOnBlur } = await getCreateAudioStatusBar();
      renderHook(() =>
        usePipOnBlur({
          enabled: true,
          room: mockRoom as any,
        }),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Should not throw when postMessage fails
      act(() => {
        mockRoom._mockRemoteParticipant._triggerEvent(
          ParticipantEvent.IsSpeakingChanged,
          true,
        );
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to post status to opener:',
        expect.any(Error),
      );

      vi.useRealTimers();
    });
  });

  describe('cleanup', () => {
    it('should remove event listeners on cleanup', async () => {
      vi.useFakeTimers();

      const mockRequestWindow = vi.fn().mockResolvedValue({
        document: mockPipDoc,
        close: vi.fn(),
        addEventListener: vi.fn(),
      });

      Object.defineProperty(window, 'documentPictureInPicture', {
        value: {
          requestWindow: mockRequestWindow,
          window: null,
        },
        writable: true,
        configurable: true,
      });

      const { usePipOnBlur } = await getCreateAudioStatusBar();
      const { unmount } = renderHook(() =>
        usePipOnBlur({
          enabled: true,
          room: mockRoom as any,
        }),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Verify listeners were added on remote participant
      expect(mockRoom._mockRemoteParticipant.on).toHaveBeenCalledWith(
        ParticipantEvent.IsSpeakingChanged,
        expect.any(Function),
      );

      // Verify room-level listeners were added
      expect(mockRoom.on).toHaveBeenCalledWith(
        RoomEvent.ParticipantConnected,
        expect.any(Function),
      );
      expect(mockRoom.on).toHaveBeenCalledWith(
        RoomEvent.ParticipantDisconnected,
        expect.any(Function),
      );

      // Verify local participant listeners were added
      expect(mockRoom.localParticipant.on).toHaveBeenCalledWith(
        ParticipantEvent.IsSpeakingChanged,
        expect.any(Function),
      );
      expect(mockRoom.localParticipant.on).toHaveBeenCalledWith(
        ParticipantEvent.TrackMuted,
        expect.any(Function),
      );
      expect(mockRoom.localParticipant.on).toHaveBeenCalledWith(
        ParticipantEvent.TrackUnmuted,
        expect.any(Function),
      );

      unmount();

      vi.useRealTimers();
    });
  });

  describe('initial mute state', () => {
    it('should show mentor mute button unmuted initially', async () => {
      vi.useFakeTimers();

      const buttons: any[] = [];
      const mockPipWindow = createMockPipWindow((tag, element) => {
        if (tag === 'button') {
          buttons.push(element);
        }
      });
      const mockRequestWindow = vi.fn().mockResolvedValue(mockPipWindow);

      Object.defineProperty(window, 'documentPictureInPicture', {
        value: {
          requestWindow: mockRequestWindow,
          window: null,
        },
        writable: true,
        configurable: true,
      });

      const { usePipOnBlur } = await getCreateAudioStatusBar();
      renderHook(() =>
        usePipOnBlur({
          enabled: true,
          room: mockRoom as any,
        }),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Mentor mute button (first) should show unmuted state
      expect(buttons[0].style.borderColor).not.toBe('#dc2626');

      vi.useRealTimers();
    });

    it('should show mic muted state when microphone is initially disabled', async () => {
      vi.useFakeTimers();

      const mutedRoom = createMockRoom({ isMicrophoneEnabled: false });

      const buttons: any[] = [];
      const mockPipWindow = createMockPipWindow((tag, element) => {
        if (tag === 'button') {
          buttons.push(element);
        }
      });
      const mockRequestWindow = vi.fn().mockResolvedValue(mockPipWindow);

      Object.defineProperty(window, 'documentPictureInPicture', {
        value: {
          requestWindow: mockRequestWindow,
          window: null,
        },
        writable: true,
        configurable: true,
      });

      const { usePipOnBlur } = await getCreateAudioStatusBar();
      renderHook(() =>
        usePipOnBlur({
          enabled: true,
          room: mutedRoom as any,
        }),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Mic mute button (second) should show muted state (red border)
      expect(buttons[1].style.borderColor).toBe('#dc2626');
      expect(buttons[1].style.background).toBe('rgba(220, 38, 38, 0.1)');

      vi.useRealTimers();
    });

    it('should show mentor muted state after clicking mentor mute button', async () => {
      vi.useFakeTimers();

      const buttons: any[] = [];
      const mockPipWindow = createMockPipWindow((tag, element) => {
        if (tag === 'button') {
          buttons.push(element);
        }
      });
      const mockRequestWindow = vi.fn().mockResolvedValue(mockPipWindow);

      Object.defineProperty(window, 'documentPictureInPicture', {
        value: {
          requestWindow: mockRequestWindow,
          window: null,
        },
        writable: true,
        configurable: true,
      });

      const { usePipOnBlur } = await getCreateAudioStatusBar();
      renderHook(() =>
        usePipOnBlur({
          enabled: true,
          room: mockRoom as any,
        }),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      const mentorMuteButton = buttons[0];

      // Click mentor mute button
      act(() => {
        mentorMuteButton._triggerEvent('click');
      });

      // Mentor mute button should show muted state (red border)
      expect(mentorMuteButton.style.borderColor).toBe('#dc2626');
      expect(mentorMuteButton.style.background).toBe('rgba(220, 38, 38, 0.1)');

      vi.useRealTimers();
    });
  });

  describe('stop sharing button', () => {
    it('should call onStopScreenShare when stop button is clicked', async () => {
      vi.useFakeTimers();

      const onStopScreenShare = vi.fn();
      const buttons: any[] = [];
      const mockPipWindow = createMockPipWindow((tag, element) => {
        if (tag === 'button') {
          buttons.push(element);
        }
      });
      const mockRequestWindow = vi.fn().mockResolvedValue(mockPipWindow);

      Object.defineProperty(window, 'documentPictureInPicture', {
        value: {
          requestWindow: mockRequestWindow,
          window: null,
        },
        writable: true,
        configurable: true,
      });

      const { usePipOnBlur } = await getCreateAudioStatusBar();
      renderHook(() =>
        usePipOnBlur({
          enabled: true,
          room: mockRoom as any,
          onStopScreenShare,
        }),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Third button is the stop sharing button (after mentor mute + mic mute)
      const stopButton = buttons[2];
      expect(stopButton).toBeDefined();
      expect(stopButton.title).toBe('Stop screen sharing');

      // Click stop sharing button
      act(() => {
        stopButton._triggerEvent('click');
      });

      expect(onStopScreenShare).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should not create stop button when onStopScreenShare is not provided', async () => {
      vi.useFakeTimers();

      const buttons: any[] = [];
      const mockPipWindow = createMockPipWindow((tag, element) => {
        if (tag === 'button') {
          buttons.push(element);
        }
      });
      const mockRequestWindow = vi.fn().mockResolvedValue(mockPipWindow);

      Object.defineProperty(window, 'documentPictureInPicture', {
        value: {
          requestWindow: mockRequestWindow,
          window: null,
        },
        writable: true,
        configurable: true,
      });

      const { usePipOnBlur } = await getCreateAudioStatusBar();
      renderHook(() =>
        usePipOnBlur({
          enabled: true,
          room: mockRoom as any,
        }),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Should only have 2 buttons (mentor mute + mic mute)
      expect(buttons.length).toBe(2);

      vi.useRealTimers();
    });
  });
});

describe('getScreenShareTrack', () => {
  it('should find screen share track by source', async () => {
    vi.useFakeTimers();

    const mockTrack = {
      kind: 'video',
      source: 'screen_share',
      attach: vi.fn(),
    };
    const mockPublication = {
      source: 'screen_share',
      track: mockTrack,
      trackName: 'screen-share',
    };
    const mockRoom = createMockRoom();
    mockRoom.localParticipant.trackPublications.set('screen', mockPublication);

    const mockPipWindow = createMockPipWindow();
    const mockRequestWindow = vi.fn().mockResolvedValue(mockPipWindow);

    Object.defineProperty(window, 'documentPictureInPicture', {
      value: {
        requestWindow: mockRequestWindow,
        window: null,
      },
      writable: true,
      configurable: true,
    });

    const { usePipOnBlur } = await import('../use-pip-on-blur');
    renderHook(() =>
      usePipOnBlur({
        enabled: true,
        room: mockRoom as any,
        screenSharePreviewHeight: 30,
      }),
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Track should be attached to video element
    expect(mockTrack.attach).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('should find screen share track by track source', async () => {
    vi.useFakeTimers();

    const mockTrack = {
      kind: 'video',
      source: 'screen_share',
      attach: vi.fn(),
    };
    const mockPublication = {
      source: 'other',
      track: mockTrack,
      trackName: 'other',
    };
    const mockRoom = createMockRoom();
    mockRoom.localParticipant.trackPublications.set('screen', mockPublication);

    const mockPipWindow = createMockPipWindow();
    const mockRequestWindow = vi.fn().mockResolvedValue(mockPipWindow);

    Object.defineProperty(window, 'documentPictureInPicture', {
      value: {
        requestWindow: mockRequestWindow,
        window: null,
      },
      writable: true,
      configurable: true,
    });

    const { usePipOnBlur } = await import('../use-pip-on-blur');
    renderHook(() =>
      usePipOnBlur({
        enabled: true,
        room: mockRoom as any,
        screenSharePreviewHeight: 30,
      }),
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockTrack.attach).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('should find screen share track by trackName', async () => {
    vi.useFakeTimers();

    const mockTrack = {
      kind: 'video',
      source: 'unknown',
      attach: vi.fn(),
    };
    const mockPublication = {
      source: 'other',
      track: mockTrack,
      trackName: 'screen-share-video',
    };
    const mockRoom = createMockRoom();
    mockRoom.localParticipant.trackPublications.set('screen', mockPublication);

    const mockPipWindow = createMockPipWindow();
    const mockRequestWindow = vi.fn().mockResolvedValue(mockPipWindow);

    Object.defineProperty(window, 'documentPictureInPicture', {
      value: {
        requestWindow: mockRequestWindow,
        window: null,
      },
      writable: true,
      configurable: true,
    });

    const { usePipOnBlur } = await import('../use-pip-on-blur');
    renderHook(() =>
      usePipOnBlur({
        enabled: true,
        room: mockRoom as any,
        screenSharePreviewHeight: 30,
      }),
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockTrack.attach).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('should listen for track published when no existing track', async () => {
    vi.useFakeTimers();

    const mockRoom = createMockRoom();
    // No track publications initially

    const mockPipWindow = createMockPipWindow();
    const mockRequestWindow = vi.fn().mockResolvedValue(mockPipWindow);

    Object.defineProperty(window, 'documentPictureInPicture', {
      value: {
        requestWindow: mockRequestWindow,
        window: null,
      },
      writable: true,
      configurable: true,
    });

    const { usePipOnBlur } = await import('../use-pip-on-blur');
    renderHook(() =>
      usePipOnBlur({
        enabled: true,
        room: mockRoom as any,
        screenSharePreviewHeight: 30,
      }),
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Should have registered listener for LocalTrackPublished
    expect(mockRoom.localParticipant.on).toHaveBeenCalledWith(
      RoomEvent.LocalTrackPublished,
      expect.any(Function),
    );

    vi.useRealTimers();
  });
});

describe('hover effects', () => {
  it('should apply hover styles on mentor mute button mouseenter when unmuted', async () => {
    vi.useFakeTimers();

    const mockRoom = createMockRoom();

    const buttons: any[] = [];
    const mockPipWindow = createMockPipWindow((tag, element) => {
      if (tag === 'button') {
        buttons.push(element);
      }
    });
    const mockRequestWindow = vi.fn().mockResolvedValue(mockPipWindow);

    Object.defineProperty(window, 'documentPictureInPicture', {
      value: {
        requestWindow: mockRequestWindow,
        window: null,
      },
      writable: true,
      configurable: true,
    });

    Object.defineProperty(window, 'opener', {
      value: {
        closed: false,
        postMessage: vi.fn(),
      },
      writable: true,
      configurable: true,
    });

    const { usePipOnBlur } = await import('../use-pip-on-blur');
    renderHook(() =>
      usePipOnBlur({
        enabled: true,
        room: mockRoom as any,
      }),
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    const mentorMuteButton = buttons[0];

    // Trigger mouseenter
    act(() => {
      mentorMuteButton._triggerEvent('mouseenter');
    });

    expect(mentorMuteButton.style.borderColor).toBe('#93C5FD');
    expect(mentorMuteButton.style.background).toBe('rgba(37, 99, 235, 0.1)');

    // Trigger mouseleave
    act(() => {
      mentorMuteButton._triggerEvent('mouseleave');
    });

    expect(mentorMuteButton.style.borderColor).toBe('rgba(255, 255, 255, 0.2)');
    expect(mentorMuteButton.style.background).toBe('transparent');

    vi.useRealTimers();
  });

  it('should apply hover styles on mentor mute button mouseenter when muted', async () => {
    vi.useFakeTimers();

    const mockRoom = createMockRoom();

    const buttons: any[] = [];
    const mockPipWindow = createMockPipWindow((tag, element) => {
      if (tag === 'button') {
        buttons.push(element);
      }
    });
    const mockRequestWindow = vi.fn().mockResolvedValue(mockPipWindow);

    Object.defineProperty(window, 'documentPictureInPicture', {
      value: {
        requestWindow: mockRequestWindow,
        window: null,
      },
      writable: true,
      configurable: true,
    });

    Object.defineProperty(window, 'opener', {
      value: {
        closed: false,
        postMessage: vi.fn(),
      },
      writable: true,
      configurable: true,
    });

    const { usePipOnBlur } = await import('../use-pip-on-blur');
    renderHook(() =>
      usePipOnBlur({
        enabled: true,
        room: mockRoom as any,
      }),
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    const mentorMuteButton = buttons[0];

    // First click mentor mute button to enter muted state
    act(() => {
      mentorMuteButton._triggerEvent('click');
    });

    // Trigger mouseenter when muted
    act(() => {
      mentorMuteButton._triggerEvent('mouseenter');
    });

    expect(mentorMuteButton.style.background).toBe('rgba(220, 38, 38, 0.2)');

    // Trigger mouseleave when muted
    act(() => {
      mentorMuteButton._triggerEvent('mouseleave');
    });

    expect(mentorMuteButton.style.borderColor).toBe('#dc2626');
    expect(mentorMuteButton.style.background).toBe('rgba(220, 38, 38, 0.1)');

    vi.useRealTimers();
  });
});
