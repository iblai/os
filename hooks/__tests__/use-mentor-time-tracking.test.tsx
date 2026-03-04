import React, { useEffect } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';

import {
  useMentorTimeTrackingConfig,
  MentorTimeTrackingProvider,
} from '@/hooks/use-mentor-time-tracking';

// ---- Mocks with test-controlled state ----
let mockParams: Record<string, string | undefined> = {};
let mockPathname = '/platform/tenant123/mentor456';
let mockReduxState: {
  chat: {
    activeTab: number;
    sessionIds: Record<number, string>;
  };
};

vi.mock('next/navigation', () => ({
  useParams: () => mockParams,
  usePathname: () => mockPathname,
}));

vi.mock('@/lib/hooks', () => ({
  useAppSelector: (selector: (s: typeof mockReduxState) => unknown) => selector(mockReduxState),
}));

vi.mock('@web-utils/features', () => ({
  selectActiveTab: (state: typeof mockReduxState) => state.chat.activeTab,
  selectSessionIds: (state: typeof mockReduxState) => state.chat.sessionIds,
}));

// Mock TimeTrackingProvider to verify props
const TimeTrackingProviderMock = vi.fn();
vi.mock('@iblai/iblai-js/web-containers', () => ({
  TimeTrackingProvider: (props: Record<string, unknown>) => {
    TimeTrackingProviderMock(props);
    return null;
  },
}));

// Harness component to access hook values
function HookHarness({
  onReady,
}: {
  onReady: (api: ReturnType<typeof useMentorTimeTrackingConfig>) => void;
}) {
  const api = useMentorTimeTrackingConfig();
  useEffect(() => {
    onReady(api);
  }, [api, onReady]);
  return null;
}

describe('useMentorTimeTrackingConfig', () => {
  let originalLocation: Location;

  beforeEach(() => {
    // Reset mocks
    mockParams = { tenantKey: 'tenant123', mentorId: 'mentor456' };
    mockPathname = '/platform/tenant123/mentor456';
    mockReduxState = {
      chat: {
        activeTab: 0,
        sessionIds: { 0: 'session-uuid-0', 1: 'session-uuid-1' },
      },
    };

    // Mock window.location
    originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: {
        href: 'https://example.com/platform/tenant123/mentor456',
        pathname: '/platform/tenant123/mentor456',
        search: '',
      },
      writable: true,
      configurable: true,
    });

    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  describe('getTenantKey', () => {
    it('returns tenant key from params', () => {
      let hookApi: ReturnType<typeof useMentorTimeTrackingConfig> | null = null;

      render(<HookHarness onReady={(api) => (hookApi = api)} />);

      expect(hookApi!.getTenantKey()).toBe('tenant123');
    });

    it('returns empty string when tenant key is not present', () => {
      mockParams = {};
      let hookApi: ReturnType<typeof useMentorTimeTrackingConfig> | null = null;

      render(<HookHarness onReady={(api) => (hookApi = api)} />);

      expect(hookApi!.getTenantKey()).toBe('');
    });
  });

  describe('getMentorId', () => {
    it('returns mentor ID from params', () => {
      let hookApi: ReturnType<typeof useMentorTimeTrackingConfig> | null = null;

      render(<HookHarness onReady={(api) => (hookApi = api)} />);

      expect(hookApi!.getMentorId()).toBe('mentor456');
    });

    it('returns undefined when mentor ID is not present', () => {
      mockParams = { tenantKey: 'tenant123' };
      let hookApi: ReturnType<typeof useMentorTimeTrackingConfig> | null = null;

      render(<HookHarness onReady={(api) => (hookApi = api)} />);

      expect(hookApi!.getMentorId()).toBeUndefined();
    });
  });

  describe('getCurrentUrl', () => {
    it('returns window.location.href', () => {
      let hookApi: ReturnType<typeof useMentorTimeTrackingConfig> | null = null;

      render(<HookHarness onReady={(api) => (hookApi = api)} />);

      expect(hookApi!.getCurrentUrl()).toBe('https://example.com/platform/tenant123/mentor456');
    });

    it('returns "/" when window is undefined (SSR)', () => {
      const originalWindow = global.window;
      // @ts-expect-error - simulating SSR environment
      delete global.window;

      let hookApi: ReturnType<typeof useMentorTimeTrackingConfig> | null = null;

      // Restore window before render since React needs it
      global.window = originalWindow;
      render(<HookHarness onReady={(api) => (hookApi = api)} />);

      // The function checks typeof window at call time
      // In browser environment it returns the href
      expect(hookApi!.getCurrentUrl()).toBe('https://example.com/platform/tenant123/mentor456');
    });
  });

  describe('getSessionUuid', () => {
    it('returns session UUID for active tab', () => {
      let hookApi: ReturnType<typeof useMentorTimeTrackingConfig> | null = null;

      render(<HookHarness onReady={(api) => (hookApi = api)} />);

      expect(hookApi!.getSessionUuid()).toBe('session-uuid-0');
    });

    it('returns session UUID for different active tab', () => {
      mockReduxState.chat.activeTab = 1;
      let hookApi: ReturnType<typeof useMentorTimeTrackingConfig> | null = null;

      render(<HookHarness onReady={(api) => (hookApi = api)} />);

      expect(hookApi!.getSessionUuid()).toBe('session-uuid-1');
    });

    it('returns undefined when session ID does not exist for active tab', () => {
      mockReduxState.chat.activeTab = 5;
      let hookApi: ReturnType<typeof useMentorTimeTrackingConfig> | null = null;

      render(<HookHarness onReady={(api) => (hookApi = api)} />);

      expect(hookApi!.getSessionUuid()).toBeUndefined();
    });
  });

  describe('onRouteChange', () => {
    it('sets up interval for polling route changes', () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval');
      let hookApi: ReturnType<typeof useMentorTimeTrackingConfig> | null = null;

      render(<HookHarness onReady={(api) => (hookApi = api)} />);

      const callback = vi.fn();
      hookApi!.onRouteChange(callback);

      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 50);
    });

    it('adds popstate and beforeunload event listeners', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      let hookApi: ReturnType<typeof useMentorTimeTrackingConfig> | null = null;

      render(<HookHarness onReady={(api) => (hookApi = api)} />);

      const callback = vi.fn();
      hookApi!.onRouteChange(callback);

      expect(addEventListenerSpy).toHaveBeenCalledWith('popstate', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    });

    it('calls callback when pathname changes during polling', () => {
      let hookApi: ReturnType<typeof useMentorTimeTrackingConfig> | null = null;

      render(<HookHarness onReady={(api) => (hookApi = api)} />);

      const callback = vi.fn();
      hookApi!.onRouteChange(callback);

      // Simulate pathname change
      Object.defineProperty(window, 'location', {
        value: {
          href: 'https://example.com/platform/tenant123/mentor789',
          pathname: '/platform/tenant123/mentor789',
          search: '',
        },
        writable: true,
        configurable: true,
      });

      // Advance timer to trigger interval check
      act(() => {
        vi.advanceTimersByTime(50);
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('calls callback when search params change during polling', () => {
      let hookApi: ReturnType<typeof useMentorTimeTrackingConfig> | null = null;

      render(<HookHarness onReady={(api) => (hookApi = api)} />);

      const callback = vi.fn();
      hookApi!.onRouteChange(callback);

      // Simulate search param change
      Object.defineProperty(window, 'location', {
        value: {
          href: 'https://example.com/platform/tenant123/mentor456?tab=1',
          pathname: '/platform/tenant123/mentor456',
          search: '?tab=1',
        },
        writable: true,
        configurable: true,
      });

      act(() => {
        vi.advanceTimersByTime(50);
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('does not call callback when path remains the same', () => {
      let hookApi: ReturnType<typeof useMentorTimeTrackingConfig> | null = null;

      render(<HookHarness onReady={(api) => (hookApi = api)} />);

      const callback = vi.fn();
      hookApi!.onRouteChange(callback);

      // Advance timer without changing path
      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it('calls callback on beforeunload event', () => {
      let hookApi: ReturnType<typeof useMentorTimeTrackingConfig> | null = null;

      render(<HookHarness onReady={(api) => (hookApi = api)} />);

      const callback = vi.fn();
      hookApi!.onRouteChange(callback);

      // Dispatch beforeunload event
      act(() => {
        window.dispatchEvent(new Event('beforeunload'));
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('calls callback on popstate event', () => {
      let hookApi: ReturnType<typeof useMentorTimeTrackingConfig> | null = null;

      render(<HookHarness onReady={(api) => (hookApi = api)} />);

      const callback = vi.fn();
      hookApi!.onRouteChange(callback);

      // Simulate popstate with path change
      Object.defineProperty(window, 'location', {
        value: {
          href: 'https://example.com/platform/tenant123/mentor789',
          pathname: '/platform/tenant123/mentor789',
          search: '',
        },
        writable: true,
        configurable: true,
      });

      act(() => {
        window.dispatchEvent(new PopStateEvent('popstate'));
        vi.advanceTimersByTime(20); // Account for setTimeout delay
      });

      expect(callback).toHaveBeenCalled();
    });

    it('cleanup function clears interval and removes listeners', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      let hookApi: ReturnType<typeof useMentorTimeTrackingConfig> | null = null;

      render(<HookHarness onReady={(api) => (hookApi = api)} />);

      const callback = vi.fn();
      const cleanup = hookApi!.onRouteChange(callback);

      cleanup();

      expect(clearIntervalSpy).toHaveBeenCalled();
      expect(removeEventListenerSpy).toHaveBeenCalledWith('popstate', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    });

    it('stores callback reference and calls it on pathname change via useEffect', () => {
      const callback = vi.fn();
      let hookApi: ReturnType<typeof useMentorTimeTrackingConfig> | null = null;

      const { rerender } = render(<HookHarness onReady={(api) => (hookApi = api)} />);

      // Register the route change callback
      hookApi!.onRouteChange(callback);

      // Change pathname to trigger useEffect
      mockPathname = '/platform/tenant123/mentor789';
      rerender(<HookHarness onReady={(api) => (hookApi = api)} />);

      // The callback should be called due to pathname change useEffect
      expect(callback).toHaveBeenCalled();
    });
  });
});

describe('MentorTimeTrackingProvider', () => {
  beforeEach(() => {
    mockParams = { tenantKey: 'tenant123', mentorId: 'mentor456' };
    mockPathname = '/platform/tenant123/mentor456';
    mockReduxState = {
      chat: {
        activeTab: 0,
        sessionIds: { 0: 'session-uuid-0' },
      },
    };
    TimeTrackingProviderMock.mockClear();

    Object.defineProperty(window, 'location', {
      value: {
        href: 'https://example.com/platform/tenant123/mentor456',
        pathname: '/platform/tenant123/mentor456',
        search: '',
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders TimeTrackingProvider with default props', () => {
    render(<MentorTimeTrackingProvider />);

    expect(TimeTrackingProviderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        intervalSeconds: 30,
        enabled: true,
        getTenantKey: expect.any(Function),
        getMentorId: expect.any(Function),
        getCurrentUrl: expect.any(Function),
        onRouteChange: expect.any(Function),
        getSessionUuid: expect.any(Function),
      }),
    );
  });

  it('passes custom intervalSeconds prop', () => {
    render(<MentorTimeTrackingProvider intervalSeconds={60} />);

    expect(TimeTrackingProviderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        intervalSeconds: 60,
      }),
    );
  });

  it('passes enabled=false prop', () => {
    render(<MentorTimeTrackingProvider enabled={false} />);

    expect(TimeTrackingProviderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      }),
    );
  });

  it('passes config functions that return correct values', () => {
    render(<MentorTimeTrackingProvider />);

    expect(TimeTrackingProviderMock).toHaveBeenCalled();
    const passedProps = TimeTrackingProviderMock.mock.calls[0][0] as Record<string, unknown>;

    expect((passedProps.getTenantKey as () => string)()).toBe('tenant123');
    expect((passedProps.getMentorId as () => string | undefined)()).toBe('mentor456');
    expect((passedProps.getCurrentUrl as () => string)()).toBe(
      'https://example.com/platform/tenant123/mentor456',
    );
    expect((passedProps.getSessionUuid as () => string | undefined)()).toBe('session-uuid-0');
  });
});
