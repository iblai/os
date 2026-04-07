import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useExternalPricing } from '../use-external-pricing';

// Mock config
vi.mock('@/lib/config', () => ({
  config: {
    externalPricingPageUrl: vi.fn(() => 'https://pricing.example.com'),
    authUrl: vi.fn(() => 'https://auth.example.com'),
    dmUrl: vi.fn(() => 'https://dm.example.com'),
  },
}));

// Mock constants
vi.mock('@/lib/constants', () => ({
  LOCAL_STORAGE_KEYS: {
    DM_TOKEN_KEY: 'dm_token',
  },
}));

// Mock utils
vi.mock('@/lib/utils', () => ({
  isJSON: vi.fn((str: string) => {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  }),
}));

// Mock useFreeTrial
const mockUserOnFreeTrial = vi.fn();
vi.mock('../use-free-trial', () => ({
  useFreeTrial: () => ({
    userOnFreeTrial: mockUserOnFreeTrial,
  }),
}));

// Mock getUserName
vi.mock('@/features/utils', () => ({
  getUserName: vi.fn(() => 'testuser'),
}));

describe('useExternalPricing', () => {
  const originalLocation = window.location;
  const originalLocalStorage = window.localStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUserOnFreeTrial.mockReturnValue(false);

    // Mock localStorage
    const mockStorage: Record<string, string> = {
      dm_token: 'test-token',
    };
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => mockStorage[key] || null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
      configurable: true,
    });

    // Mock location
    Object.defineProperty(window, 'location', {
      value: {
        href: 'https://app.example.com/mentor',
        origin: 'https://app.example.com',
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    });
  });

  describe('initial state', () => {
    it('should return PRICING_URL from config', () => {
      const { result } = renderHook(() => useExternalPricing());

      expect(result.current.PRICING_URL).toBe('https://pricing.example.com');
    });

    it('should return pricingBoxIframeRef', () => {
      const { result } = renderHook(() => useExternalPricing());

      expect(result.current.pricingBoxIframeRef).toBeDefined();
      expect(result.current.pricingBoxIframeRef.current).toBe(null);
    });
  });

  describe('iframe postMessage interactions', () => {
    it('should add message event listener on mount', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      renderHook(() => useExternalPricing());

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'message',
        expect.any(Function),
      );
    });

    it('should remove message event listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() => useExternalPricing());
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'message',
        expect.any(Function),
      );
    });

    it('should send data to iframe when ready message is received', () => {
      const mockPostMessage = vi.fn();
      const mockIframe = {
        contentWindow: {
          postMessage: mockPostMessage,
        },
      };

      const { result } = renderHook(() => useExternalPricing());

      // Set the iframe ref
      act(() => {
        (
          result.current.pricingBoxIframeRef as React.MutableRefObject<
            typeof mockIframe | null
          >
        ).current = mockIframe;
      });

      // Dispatch message event
      act(() => {
        const event = new MessageEvent('message', {
          data: JSON.stringify({ ready: true }),
        });
        window.dispatchEvent(event);
      });

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.stringContaining('"token":"test-token"'),
        '*',
      );
    });

    it('should include free trial data when user is on free trial', () => {
      mockUserOnFreeTrial.mockReturnValue(true);

      const mockPostMessage = vi.fn();
      const mockIframe = {
        contentWindow: {
          postMessage: mockPostMessage,
        },
      };

      const { result } = renderHook(() => useExternalPricing());

      act(() => {
        (
          result.current.pricingBoxIframeRef as React.MutableRefObject<
            typeof mockIframe | null
          >
        ).current = mockIframe;
      });

      act(() => {
        const event = new MessageEvent('message', {
          data: JSON.stringify({ ready: true }),
        });
        window.dispatchEvent(event);
      });

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.stringContaining('"is_free_trial":true'),
        '*',
      );
      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.stringContaining('"trial_days":5'),
        '*',
      );
      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.stringContaining('"skip_card":true'),
        '*',
      );
    });

    it('should redirect when payment initialization is successful', () => {
      renderHook(() => useExternalPricing());

      act(() => {
        const event = new MessageEvent('message', {
          data: JSON.stringify({
            payment_initialization_launched: true,
            payment_initialization_successful: true,
            redirect_to: 'https://payment.success.com',
          }),
        });
        window.dispatchEvent(event);
      });

      expect(window.location.href).toBe('https://payment.success.com');
    });

    it('should not redirect when payment initialization fails', () => {
      renderHook(() => useExternalPricing());

      const originalHref = window.location.href;

      act(() => {
        const event = new MessageEvent('message', {
          data: JSON.stringify({
            payment_initialization_launched: true,
            payment_initialization_successful: false,
          }),
        });
        window.dispatchEvent(event);
      });

      // Should not change location
      expect(window.location.href).toBe(originalHref);
    });

    it('should handle non-JSON message data gracefully', () => {
      const { result } = renderHook(() => useExternalPricing());

      // Should not throw
      act(() => {
        const event = new MessageEvent('message', {
          data: 'not valid json',
        });
        window.dispatchEvent(event);
      });

      expect(result.current.PRICING_URL).toBe('https://pricing.example.com');
    });

    it('should handle null/undefined message data', () => {
      const { result } = renderHook(() => useExternalPricing());

      // Should not throw
      act(() => {
        const event = new MessageEvent('message', {
          data: null,
        });
        window.dispatchEvent(event);
      });

      expect(result.current.PRICING_URL).toBe('https://pricing.example.com');
    });
  });
});
