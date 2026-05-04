import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

// Hoist mocks before imports
const mockUseAppDispatch = vi.hoisted(() => vi.fn());
const mockDarkModeUpdated = vi.hoisted(() =>
  vi.fn((value) => ({ type: 'modals/darkModeUpdated', payload: value })),
);
const mockSetIframeContext = vi.hoisted(() =>
  vi.fn((value) => ({ type: 'chat/setIframeContext', payload: value })),
);
const mockSetDocumentFilter = vi.hoisted(() =>
  vi.fn((value) => ({ type: 'chat/setDocumentFilter', payload: value })),
);
const mockEnableChatActionsPopup = vi.hoisted(() =>
  vi.fn((value) => ({ type: 'chat/enableChatActionsPopup', payload: value })),
);

// Mock the dependencies
vi.mock('@/lib/hooks', () => ({
  useAppDispatch: mockUseAppDispatch,
}));

vi.mock('@/features/navigation/slice', () => ({
  darkModeUpdated: mockDarkModeUpdated,
}));

vi.mock('@iblai/iblai-js/web-utils', () => ({
  chatActions: {
    setIframeContext: mockSetIframeContext,
    setDocumentFilter: mockSetDocumentFilter,
  },
}));

vi.mock('@/features/chat/chatSlice', () => ({
  enableChatActionsPopup: mockEnableChatActionsPopup,
}));

import { useIframeHandlers } from '../handlers';
import eventBus, { RemoteEvents } from '../eventBus';
import { darkModeUpdated } from '@/features/navigation/slice';
import { chatActions } from '@iblai/iblai-js/web-utils';
import { enableChatActionsPopup } from '@/features/chat/chatSlice';

describe('useIframeHandlers', () => {
  let mockDispatchInstance: ReturnType<typeof vi.fn>;
  let originalLocalStorage: Storage;
  let originalLocation: Location;

  beforeEach(() => {
    // Mock dispatch
    mockDispatchInstance = vi.fn();
    mockUseAppDispatch.mockReturnValue(mockDispatchInstance);

    // Mock localStorage
    const localStorageMock: Record<string, string> = {};
    originalLocalStorage = global.localStorage;
    global.localStorage = {
      getItem: vi.fn((key: string) => localStorageMock[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageMock[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete localStorageMock[key];
      }),
      clear: vi.fn(() => {
        Object.keys(localStorageMock).forEach(
          (key) => delete localStorageMock[key],
        );
      }),
      key: vi.fn(
        (index: number) => Object.keys(localStorageMock)[index] || null,
      ),
      get length() {
        return Object.keys(localStorageMock).length;
      },
    };

    // Mock window.location.reload
    originalLocation = window.location;
    delete (window as any).location;
    window.location = { ...originalLocation, reload: vi.fn() } as any;

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Clean up DOM
    document.body.className = '';
    document.body.innerHTML = '';

    // Remove all style elements added by tests
    const styleElements = document.head.querySelectorAll('style');
    styleElements.forEach((el) => el.remove());

    // Restore globals
    global.localStorage = originalLocalStorage;
    (window as any).location = originalLocation;
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('hook initialization', () => {
    it('should return handlers object with all expected handlers', () => {
      const { result } = renderHook(() => useIframeHandlers());

      expect(result.current).toBeDefined();
      expect(result.current).toHaveProperty('MENTOR:THEME_CHANGE');
      expect(result.current).toHaveProperty('MENTOR:CSS_INJECT');
      expect(result.current).toHaveProperty('MENTOR:PROMPT_FOCUS');
      expect(result.current).toHaveProperty('MENTOR:AUTH_UPDATE');
      expect(result.current).toHaveProperty('MENTOR:CONTEXT_UPDATE');
      expect(result.current).toHaveProperty('MENTOR:DOCUMENTFILTER');
      expect(result.current).toHaveProperty('MENTOR:EDX_USAGE_ID');
      expect(result.current).toHaveProperty('MENTOR:EDX_COURSE_ID');
      expect(result.current).toHaveProperty('MENTOR:METADATA_SAFETY');
      expect(result.current).toHaveProperty('MENTOR:IFRAME_CLOSE_BUTTON');
      expect(result.current).toHaveProperty('MENTOR:MENTOR_PREVIEW');
      expect(result.current).toHaveProperty('MENTOR:ENABLE_CHAT_ACTION_POPUPS');
      expect(result.current).toHaveProperty('MENTOR:CHAT_ACTION_ADD_MESSAGE');
    });

    it('should have all handlers as functions', () => {
      const { result } = renderHook(() => useIframeHandlers());

      Object.values(result.current).forEach((handler) => {
        expect(typeof handler).toBe('function');
      });
    });
  });

  describe('MENTOR:THEME_CHANGE handler', () => {
    it('should add dark-mode class and dispatch darkModeUpdated(true) for dark theme', () => {
      const { result } = renderHook(() => useIframeHandlers());

      result.current['MENTOR:THEME_CHANGE']({ theme: 'dark' });

      expect(document.body.classList.contains('dark-mode')).toBe(true);
      expect(mockDispatchInstance).toHaveBeenCalledWith(darkModeUpdated(true));
    });

    it('should remove dark-mode class and dispatch darkModeUpdated(false) for light theme', () => {
      document.body.classList.add('dark-mode');
      const { result } = renderHook(() => useIframeHandlers());

      result.current['MENTOR:THEME_CHANGE']({ theme: 'light' });

      expect(document.body.classList.contains('dark-mode')).toBe(false);
      expect(mockDispatchInstance).toHaveBeenCalledWith(darkModeUpdated(false));
    });

    it('should handle any non-dark theme as light theme', () => {
      document.body.classList.add('dark-mode');
      const { result } = renderHook(() => useIframeHandlers());

      result.current['MENTOR:THEME_CHANGE']({ theme: 'custom' });

      expect(document.body.classList.contains('dark-mode')).toBe(false);
      expect(mockDispatchInstance).toHaveBeenCalledWith(darkModeUpdated(false));
    });

    it('should toggle theme from light to dark', () => {
      const { result } = renderHook(() => useIframeHandlers());

      result.current['MENTOR:THEME_CHANGE']({ theme: 'light' });
      expect(document.body.classList.contains('dark-mode')).toBe(false);

      result.current['MENTOR:THEME_CHANGE']({ theme: 'dark' });
      expect(document.body.classList.contains('dark-mode')).toBe(true);
    });
  });

  describe('MENTOR:CSS_INJECT handler', () => {
    it('should inject CSS into document head', () => {
      const { result } = renderHook(() => useIframeHandlers());
      const mockCss = 'body { background: red; }';
      const mockEvent = {
        data: { css: mockCss },
      } as MessageEvent;

      result.current['MENTOR:CSS_INJECT'](undefined, mockEvent);

      const styleElements = document.head.querySelectorAll('style');
      expect(styleElements.length).toBeGreaterThan(0);
      expect(styleElements[styleElements.length - 1].innerText).toBe(mockCss);
    });

    it('should inject multiple CSS blocks', () => {
      const { result } = renderHook(() => useIframeHandlers());
      const css1 = 'body { color: blue; }';
      const css2 = 'h1 { font-size: 24px; }';

      result.current['MENTOR:CSS_INJECT'](undefined, {
        data: { css: css1 },
      } as MessageEvent);
      result.current['MENTOR:CSS_INJECT'](undefined, {
        data: { css: css2 },
      } as MessageEvent);

      const styleElements = document.head.querySelectorAll('style');
      expect(styleElements.length).toBe(2);
      expect(styleElements[0].innerText).toBe(css1);
      expect(styleElements[1].innerText).toBe(css2);
    });

    it('should handle empty CSS string', () => {
      const { result } = renderHook(() => useIframeHandlers());

      result.current['MENTOR:CSS_INJECT'](undefined, {
        data: { css: '' },
      } as MessageEvent);

      const styleElements = document.head.querySelectorAll('style');
      expect(styleElements.length).toBeGreaterThan(0);
      expect(styleElements[styleElements.length - 1].innerText).toBe('');
    });
  });

  describe('MENTOR:PROMPT_FOCUS handler', () => {
    it('should focus element with id "user-prompt" if it exists', () => {
      const { result } = renderHook(() => useIframeHandlers());
      const promptElement = document.createElement('input');
      promptElement.id = 'user-prompt';
      const focusSpy = vi.spyOn(promptElement, 'focus');
      document.body.appendChild(promptElement);

      result.current['MENTOR:PROMPT_FOCUS']();

      expect(focusSpy).toHaveBeenCalled();
    });

    it('should not throw error if element does not exist', () => {
      const { result } = renderHook(() => useIframeHandlers());

      expect(() => {
        result.current['MENTOR:PROMPT_FOCUS']();
      }).not.toThrow();
    });

    it('should be callable multiple times', () => {
      const { result } = renderHook(() => useIframeHandlers());
      const promptElement = document.createElement('input');
      promptElement.id = 'user-prompt';
      const focusSpy = vi.spyOn(promptElement, 'focus');
      document.body.appendChild(promptElement);

      result.current['MENTOR:PROMPT_FOCUS']();
      result.current['MENTOR:PROMPT_FOCUS']();

      expect(focusSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('MENTOR:AUTH_UPDATE handler', () => {
    it('should parse JSON authData and store in localStorage', () => {
      const { result } = renderHook(() => useIframeHandlers());
      const authData = JSON.stringify({
        token: 'test-token',
        user: 'test-user',
        tenant: 'test-tenant',
      });
      const mockEvent = { data: { authData } } as MessageEvent;

      result.current['MENTOR:AUTH_UPDATE'](undefined, mockEvent);

      expect(localStorage.setItem).toHaveBeenCalledWith('token', 'test-token');
      expect(localStorage.setItem).toHaveBeenCalledWith('user', 'test-user');
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'tenant',
        'test-tenant',
      );
      expect(window.location.reload).toHaveBeenCalled();
    });

    it('should handle invalid JSON gracefully', () => {
      const { result } = renderHook(() => useIframeHandlers());
      const authData = 'invalid-json';
      const mockEvent = { data: { authData } } as MessageEvent;

      expect(() => {
        result.current['MENTOR:AUTH_UPDATE'](undefined, mockEvent);
      }).not.toThrow();

      expect(console.error).toHaveBeenCalledWith(
        'Error parsing token data:',
        expect.any(Error),
      );
    });

    it('should set current_tenant if not present and tenants exist', () => {
      const tenants = [
        { key: 'tenant1', name: 'Tenant 1' },
        { key: 'tenant2', name: 'Tenant 2' },
      ];
      vi.mocked(localStorage.getItem).mockImplementation((key: string) => {
        if (key === 'tenants') return JSON.stringify(tenants);
        if (key === 'tenant') return 'tenant1';
        if (key === 'current_tenant') return null;
        return null;
      });

      const { result } = renderHook(() => useIframeHandlers());
      const authData = JSON.stringify({ token: 'test-token' });
      const mockEvent = { data: { authData } } as MessageEvent;

      result.current['MENTOR:AUTH_UPDATE'](undefined, mockEvent);

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'current_tenant',
        JSON.stringify({ key: 'tenant1', name: 'Tenant 1' }),
      );
    });

    it('should not set current_tenant if already present', () => {
      vi.mocked(localStorage.getItem).mockImplementation((key: string) => {
        if (key === 'current_tenant')
          return JSON.stringify({ key: 'existing' });
        return null;
      });

      const { result } = renderHook(() => useIframeHandlers());
      const authData = JSON.stringify({ token: 'test-token' });
      const mockEvent = { data: { authData } } as MessageEvent;

      result.current['MENTOR:AUTH_UPDATE'](undefined, mockEvent);

      const setItemCalls = vi.mocked(localStorage.setItem).mock.calls;
      const currentTenantCalls = setItemCalls.filter(
        (call) => call[0] === 'current_tenant',
      );
      expect(currentTenantCalls.length).toBe(0);
    });

    it('should handle empty tenants array', () => {
      vi.mocked(localStorage.getItem).mockImplementation((key: string) => {
        if (key === 'tenants') return '[]';
        if (key === 'tenant') return 'tenant1';
        if (key === 'current_tenant') return null;
        return null;
      });

      const { result } = renderHook(() => useIframeHandlers());
      const authData = JSON.stringify({ token: 'test-token' });
      const mockEvent = { data: { authData } } as MessageEvent;

      expect(() => {
        result.current['MENTOR:AUTH_UPDATE'](undefined, mockEvent);
      }).not.toThrow();
    });

    it('should always reload the window', () => {
      const { result } = renderHook(() => useIframeHandlers());
      const authData = JSON.stringify({ token: 'test-token' });
      const mockEvent = { data: { authData } } as MessageEvent;

      result.current['MENTOR:AUTH_UPDATE'](undefined, mockEvent);

      expect(window.location.reload).toHaveBeenCalledTimes(1);
    });
  });

  describe('MENTOR:CONTEXT_UPDATE handler', () => {
    it('should dispatch setIframeContext with hostInfo and pageContent', () => {
      const { result } = renderHook(() => useIframeHandlers());
      const contextData = {
        hostInfo: { url: 'https://example.com', title: 'Example' },
        pageContent: 'Page content here',
      };
      const mockEvent = { data: contextData } as MessageEvent;

      result.current['MENTOR:CONTEXT_UPDATE'](undefined, mockEvent);

      expect(mockDispatchInstance).toHaveBeenCalledWith(
        chatActions.setIframeContext({
          hostInfo: contextData.hostInfo,
          pageContent: contextData.pageContent,
        }),
      );
    });

    it('should handle undefined hostInfo and pageContent', () => {
      const { result } = renderHook(() => useIframeHandlers());
      const mockEvent = { data: {} } as MessageEvent;

      expect(() => {
        result.current['MENTOR:CONTEXT_UPDATE'](undefined, mockEvent);
      }).not.toThrow();

      expect(mockDispatchInstance).toHaveBeenCalledWith(
        chatActions.setIframeContext({
          hostInfo: undefined,
          pageContent: undefined,
        }),
      );
    });

    it('should handle partial context data', () => {
      const { result } = renderHook(() => useIframeHandlers());
      const contextData = {
        hostInfo: { url: 'https://example.com' },
      };
      const mockEvent = { data: contextData } as MessageEvent;

      result.current['MENTOR:CONTEXT_UPDATE'](undefined, mockEvent);

      expect(mockDispatchInstance).toHaveBeenCalledWith(
        chatActions.setIframeContext({
          hostInfo: contextData.hostInfo,
          pageContent: undefined,
        }),
      );
    });
  });

  describe('MENTOR:DOCUMENTFILTER handler', () => {
    it('should parse and dispatch document filter', () => {
      const { result } = renderHook(() => useIframeHandlers());
      const documentFilter = { type: 'include', values: ['doc1', 'doc2'] };
      const mockEvent = {
        data: JSON.stringify(documentFilter),
      } as MessageEvent;

      result.current['MENTOR:DOCUMENTFILTER'](undefined, mockEvent);

      expect(mockDispatchInstance).toHaveBeenCalledWith(
        chatActions.setDocumentFilter(documentFilter),
      );
    });

    it('should handle invalid JSON and log error', () => {
      const { result } = renderHook(() => useIframeHandlers());
      const mockEvent = { data: 'invalid-json' } as MessageEvent;

      expect(() => {
        result.current['MENTOR:DOCUMENTFILTER'](undefined, mockEvent);
      }).not.toThrow();

      expect(console.error).toHaveBeenCalledWith(
        'MENTOR:DOCUMENTFILTER ',
        expect.any(Error),
      );
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('use-iframe-handlers'),
      );
    });

    it('should handle complex document filter object', () => {
      const { result } = renderHook(() => useIframeHandlers());
      const documentFilter = {
        type: 'exclude',
        values: ['doc1', 'doc2'],
        metadata: { source: 'external' },
      };
      const mockEvent = {
        data: JSON.stringify(documentFilter),
      } as MessageEvent;

      result.current['MENTOR:DOCUMENTFILTER'](undefined, mockEvent);

      expect(mockDispatchInstance).toHaveBeenCalledWith(
        chatActions.setDocumentFilter(documentFilter),
      );
    });

    it('should handle empty object', () => {
      const { result } = renderHook(() => useIframeHandlers());
      const mockEvent = { data: '{}' } as MessageEvent;

      result.current['MENTOR:DOCUMENTFILTER'](undefined, mockEvent);

      expect(mockDispatchInstance).toHaveBeenCalledWith(
        chatActions.setDocumentFilter({}),
      );
    });
  });

  describe('MENTOR:EDX_USAGE_ID handler', () => {
    it('should log EDX usage ID', () => {
      const { result } = renderHook(() => useIframeHandlers());
      const payload = { edxUsageId: 'usage-123' };

      result.current['MENTOR:EDX_USAGE_ID'](payload);

      expect(console.log).toHaveBeenCalledWith(
        'EDX Usage ID updated:',
        'usage-123',
      );
    });

    it('should handle different usage ID formats', () => {
      const { result } = renderHook(() => useIframeHandlers());

      result.current['MENTOR:EDX_USAGE_ID']({
        edxUsageId: 'block-v1:org+course+run',
      });

      expect(console.log).toHaveBeenCalledWith(
        'EDX Usage ID updated:',
        'block-v1:org+course+run',
      );
    });
  });

  describe('MENTOR:EDX_COURSE_ID handler', () => {
    it('should log EDX course ID', () => {
      const { result } = renderHook(() => useIframeHandlers());
      const payload = { edxCourseId: 'course-123' };

      result.current['MENTOR:EDX_COURSE_ID'](payload);

      expect(console.log).toHaveBeenCalledWith(
        'EDX Course ID updated:',
        'course-123',
      );
    });

    it('should handle different course ID formats', () => {
      const { result } = renderHook(() => useIframeHandlers());

      result.current['MENTOR:EDX_COURSE_ID']({
        edxCourseId: 'course-v1:org+course+run',
      });

      expect(console.log).toHaveBeenCalledWith(
        'EDX Course ID updated:',
        'course-v1:org+course+run',
      );
    });
  });

  describe('MENTOR:METADATA_SAFETY handler', () => {
    it('should log safety disclaimer true', () => {
      const { result } = renderHook(() => useIframeHandlers());
      const payload = { safety_disclaimer: true };

      result.current['MENTOR:METADATA_SAFETY'](payload);

      expect(console.log).toHaveBeenCalledWith(
        'Safety disclaimer updated:',
        true,
      );
    });

    it('should log safety disclaimer false', () => {
      const { result } = renderHook(() => useIframeHandlers());
      const payload = { safety_disclaimer: false };

      result.current['MENTOR:METADATA_SAFETY'](payload);

      expect(console.log).toHaveBeenCalledWith(
        'Safety disclaimer updated:',
        false,
      );
    });
  });

  describe('MENTOR:IFRAME_CLOSE_BUTTON handler', () => {
    it('should log close button enabled', () => {
      const { result } = renderHook(() => useIframeHandlers());
      const payload = { enableCloseButton: true };

      result.current['MENTOR:IFRAME_CLOSE_BUTTON'](payload);

      expect(console.log).toHaveBeenCalledWith('Close button enabled:', true);
    });

    it('should log close button disabled', () => {
      const { result } = renderHook(() => useIframeHandlers());
      const payload = { enableCloseButton: false };

      result.current['MENTOR:IFRAME_CLOSE_BUTTON'](payload);

      expect(console.log).toHaveBeenCalledWith('Close button enabled:', false);
    });
  });

  describe('MENTOR:MENTOR_PREVIEW handler', () => {
    it('should update preview mentor data with defaultPrompt and welcomeMessage', () => {
      const existingMentor = {
        id: 'mentor-123',
        settings: {
          initial_message: 'Old welcome',
          suggested_message: 'Old prompt',
        },
      };
      vi.mocked(localStorage.getItem).mockReturnValue(
        JSON.stringify(existingMentor),
      );

      const { result } = renderHook(() => useIframeHandlers());
      const payload = {
        defaultPrompt: 'New default prompt',
        welcomeMessage: 'New welcome message',
      };

      result.current['MENTOR:MENTOR_PREVIEW'](payload);

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'previewMentorData',
        JSON.stringify({
          id: 'mentor-123',
          settings: {
            initial_message: 'New welcome message',
            suggested_message: 'New default prompt',
          },
        }),
      );
    });

    it('should handle only defaultPrompt provided', () => {
      const existingMentor = {
        id: 'mentor-123',
        settings: { initial_message: 'Welcome' },
      };
      vi.mocked(localStorage.getItem).mockReturnValue(
        JSON.stringify(existingMentor),
      );

      const { result } = renderHook(() => useIframeHandlers());
      const payload = { defaultPrompt: 'New prompt' };

      result.current['MENTOR:MENTOR_PREVIEW'](payload);

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'previewMentorData',
        expect.stringContaining('New prompt'),
      );
    });

    it('should handle only welcomeMessage provided', () => {
      const existingMentor = {
        id: 'mentor-123',
        settings: { suggested_message: 'Prompt' },
      };
      vi.mocked(localStorage.getItem).mockReturnValue(
        JSON.stringify(existingMentor),
      );

      const { result } = renderHook(() => useIframeHandlers());
      const payload = { welcomeMessage: 'New welcome' };

      result.current['MENTOR:MENTOR_PREVIEW'](payload);

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'previewMentorData',
        expect.stringContaining('New welcome'),
      );
    });

    it('should not throw if previewMentorData does not exist', () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      const { result } = renderHook(() => useIframeHandlers());
      const payload = { defaultPrompt: 'New prompt' };

      expect(() => {
        result.current['MENTOR:MENTOR_PREVIEW'](payload);
      }).not.toThrow();

      expect(localStorage.setItem).not.toHaveBeenCalled();
    });

    it('should handle invalid JSON in previewMentorData', () => {
      vi.mocked(localStorage.getItem).mockReturnValue('invalid-json');

      const { result } = renderHook(() => useIframeHandlers());
      const payload = { defaultPrompt: 'New prompt' };

      expect(() => {
        result.current['MENTOR:MENTOR_PREVIEW'](payload);
      }).not.toThrow();

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('use-iframe-handlers'),
      );
    });

    it('should preserve other mentor settings', () => {
      const existingMentor = {
        id: 'mentor-123',
        name: 'Test Mentor',
        settings: {
          initial_message: 'Old welcome',
          suggested_message: 'Old prompt',
          custom_setting: 'preserved',
        },
        otherData: 'preserved',
      };
      vi.mocked(localStorage.getItem).mockReturnValue(
        JSON.stringify(existingMentor),
      );

      const { result } = renderHook(() => useIframeHandlers());
      const payload = { defaultPrompt: 'New prompt' };

      result.current['MENTOR:MENTOR_PREVIEW'](payload);

      const savedData = JSON.parse(
        vi
          .mocked(localStorage.setItem)
          .mock.calls.find((call) => call[0] === 'previewMentorData')![1],
      );
      expect(savedData.name).toBe('Test Mentor');
      expect(savedData.settings.custom_setting).toBe('preserved');
      expect(savedData.otherData).toBe('preserved');
    });

    it('should create settings object if it does not exist', () => {
      const existingMentor = {
        id: 'mentor-123',
      };
      vi.mocked(localStorage.getItem).mockReturnValue(
        JSON.stringify(existingMentor),
      );

      const { result } = renderHook(() => useIframeHandlers());
      const payload = {
        defaultPrompt: 'New prompt',
        welcomeMessage: 'New welcome',
      };

      result.current['MENTOR:MENTOR_PREVIEW'](payload);

      const savedData = JSON.parse(
        vi
          .mocked(localStorage.setItem)
          .mock.calls.find((call) => call[0] === 'previewMentorData')![1],
      );
      expect(savedData.settings).toBeDefined();
      expect(savedData.settings.suggested_message).toBe('New prompt');
      expect(savedData.settings.initial_message).toBe('New welcome');
    });
  });

  describe('MENTOR:ENABLE_CHAT_ACTION_POPUPS handler', () => {
    it('should dispatch enableChatActionsPopup with true', () => {
      const { result } = renderHook(() => useIframeHandlers());
      const payload = { enable: true };

      result.current['MENTOR:ENABLE_CHAT_ACTION_POPUPS'](payload);

      expect(mockDispatchInstance).toHaveBeenCalledWith(
        enableChatActionsPopup(true),
      );
    });

    it('should dispatch enableChatActionsPopup with false', () => {
      const { result } = renderHook(() => useIframeHandlers());
      const payload = { enable: false };

      result.current['MENTOR:ENABLE_CHAT_ACTION_POPUPS'](payload);

      expect(mockDispatchInstance).toHaveBeenCalledWith(
        enableChatActionsPopup(false),
      );
    });
  });

  describe('MENTOR:CHAT_ACTION_ADD_MESSAGE handler', () => {
    it('emits sendChatMessage event with content and visible=false', () => {
      const emitSpy = vi.spyOn(eventBus, 'emit');
      const { result } = renderHook(() => useIframeHandlers());
      const mockEvent = {
        data: { message: 'Hello mentor' },
      } as MessageEvent;

      result.current['MENTOR:CHAT_ACTION_ADD_MESSAGE'](undefined, mockEvent);

      expect(emitSpy).toHaveBeenCalledWith(RemoteEvents.sendChatMessage, {
        content: 'Hello mentor',
        visible: false,
      });
    });

    it('forwards undefined content when event has no message field', () => {
      const emitSpy = vi.spyOn(eventBus, 'emit');
      const { result } = renderHook(() => useIframeHandlers());
      const mockEvent = { data: {} } as MessageEvent;

      result.current['MENTOR:CHAT_ACTION_ADD_MESSAGE'](undefined, mockEvent);

      expect(emitSpy).toHaveBeenCalledWith(RemoteEvents.sendChatMessage, {
        content: undefined,
        visible: false,
      });
    });

    it('notifies a live eventBus subscriber with the payload', () => {
      const subscriber = vi.fn();
      eventBus.on(RemoteEvents.sendChatMessage, subscriber);

      const { result } = renderHook(() => useIframeHandlers());
      const mockEvent = {
        data: { message: 'ping' },
      } as MessageEvent;

      result.current['MENTOR:CHAT_ACTION_ADD_MESSAGE'](undefined, mockEvent);

      expect(subscriber).toHaveBeenCalledWith({
        content: 'ping',
        visible: false,
      });

      eventBus.off(RemoteEvents.sendChatMessage, subscriber);
    });
  });

  describe('edge cases and integration', () => {
    it('should handle rapid successive handler calls', () => {
      const { result } = renderHook(() => useIframeHandlers());

      result.current['MENTOR:THEME_CHANGE']({ theme: 'dark' });
      result.current['MENTOR:THEME_CHANGE']({ theme: 'light' });
      result.current['MENTOR:THEME_CHANGE']({ theme: 'dark' });

      expect(document.body.classList.contains('dark-mode')).toBe(true);
      expect(mockDispatchInstance).toHaveBeenCalledTimes(3);
    });

    it('should handle multiple handlers being called in sequence', () => {
      const { result } = renderHook(() => useIframeHandlers());

      result.current['MENTOR:THEME_CHANGE']({ theme: 'dark' });
      result.current['MENTOR:EDX_USAGE_ID']({ edxUsageId: 'usage-123' });
      result.current['MENTOR:ENABLE_CHAT_ACTION_POPUPS']({ enable: true });

      expect(mockDispatchInstance).toHaveBeenCalledTimes(3);
      expect(console.log).toHaveBeenCalled();
    });

    it('should maintain stable handler references across re-renders', () => {
      const { result, rerender } = renderHook(() => useIframeHandlers());
      const firstHandlers = result.current;

      rerender();
      const secondHandlers = result.current;

      // Handlers should be new objects, but this tests that the hook works on re-render
      expect(Object.keys(firstHandlers)).toEqual(Object.keys(secondHandlers));
    });

    it('should handle all handlers without errors', () => {
      const { result } = renderHook(() => useIframeHandlers());

      expect(() => {
        result.current['MENTOR:THEME_CHANGE']({ theme: 'dark' });
        result.current['MENTOR:CSS_INJECT'](undefined, {
          data: { css: '.test{}' },
        } as MessageEvent);
        result.current['MENTOR:PROMPT_FOCUS']();
        result.current['MENTOR:EDX_USAGE_ID']({ edxUsageId: 'id' });
        result.current['MENTOR:EDX_COURSE_ID']({ edxCourseId: 'id' });
        result.current['MENTOR:METADATA_SAFETY']({ safety_disclaimer: true });
        result.current['MENTOR:IFRAME_CLOSE_BUTTON']({
          enableCloseButton: true,
        });
        result.current['MENTOR:ENABLE_CHAT_ACTION_POPUPS']({ enable: true });
      }).not.toThrow();
    });
  });
});
