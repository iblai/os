import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';

// Mock next/navigation
const mockUseSearchParams = vi.fn();
vi.mock('next/navigation', () => ({
  useSearchParams: () => mockUseSearchParams(),
}));

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();
vi.stubGlobal('localStorage', mockLocalStorage);

// Mock window.location
const mockLocation = {
  origin: 'https://example.com',
  href: '',
};
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

// Import after mocks
const SsoLoginModule = await import('../page');
const SsoLogin = SsoLoginModule.default;

describe('mobile-sso-login page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.clear();
    mockLocation.href = '';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should export dynamic config', () => {
    expect(SsoLoginModule.dynamic).toBe('force-dynamic');
  });

  it('should render without crashing', () => {
    mockUseSearchParams.mockReturnValue({
      get: vi.fn(() => null),
    });

    const { container } = render(<SsoLogin />);
    expect(container).toBeTruthy();
  });

  it('should process SSO login data and redirect', async () => {
    const mockData = JSON.stringify({
      axd_token: 'test-token',
      dm_token: 'dm-token',
      userData: '{"username":"testuser"}',
    });

    mockUseSearchParams.mockReturnValue({
      get: vi.fn((key: string) => {
        if (key === 'data') return mockData;
        if (key === 'redirect-path') return '/dashboard';
        return null;
      }),
    });

    render(<SsoLogin />);

    await waitFor(() => {
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('axd_token', 'test-token');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('dm_token', 'dm-token');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('userData', '{"username":"testuser"}');
      expect(mockLocation.href).toBe('https://example.com/dashboard');
    });
  });

  it('should use redirect path from query param', async () => {
    const mockData = JSON.stringify({
      token: 'test-token',
    });

    mockUseSearchParams.mockReturnValue({
      get: vi.fn((key: string) => {
        if (key === 'data') return mockData;
        if (key === 'redirect-path') return '/custom-path';
        return null;
      }),
    });

    render(<SsoLogin />);

    await waitFor(() => {
      expect(mockLocation.href).toBe('https://example.com/custom-path');
    });
  });

  it('should use redirect path from localStorage if not in query', async () => {
    mockLocalStorage.setItem('redirect-to', '/stored-path');

    const mockData = JSON.stringify({
      token: 'test-token',
    });

    mockUseSearchParams.mockReturnValue({
      get: vi.fn((key: string) => {
        if (key === 'data') return mockData;
        return null;
      }),
    });

    render(<SsoLogin />);

    await waitFor(() => {
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('redirect-to');
      expect(mockLocation.href).toBe('https://example.com/stored-path');
    });
  });

  it('should default to root path if no redirect path specified', async () => {
    const mockData = JSON.stringify({
      token: 'test-token',
    });

    mockUseSearchParams.mockReturnValue({
      get: vi.fn((key: string) => {
        if (key === 'data') return mockData;
        return null;
      }),
    });

    render(<SsoLogin />);

    await waitFor(() => {
      expect(mockLocation.href).toBe('https://example.com/');
    });
  });

  it('should remove redirect-to from localStorage after redirect', async () => {
    mockLocalStorage.setItem('redirect-to', '/test-path');

    const mockData = JSON.stringify({
      token: 'test-token',
    });

    mockUseSearchParams.mockReturnValue({
      get: vi.fn((key: string) => {
        if (key === 'data') return mockData;
        return null;
      }),
    });

    render(<SsoLogin />);

    await waitFor(() => {
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('redirect-to');
    });
  });

  it('should not redirect if no data in query params', () => {
    mockUseSearchParams.mockReturnValue({
      get: vi.fn(() => null),
    });

    render(<SsoLogin />);

    expect(mockLocation.href).toBe('');
  });

  it('should log SSO login page loaded', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    mockUseSearchParams.mockReturnValue({
      get: vi.fn(() => null),
    });

    render(<SsoLogin />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('SSO login page loaded', {
        hasQueryData: false,
        origin: 'https://example.com',
      });
    });

    consoleSpy.mockRestore();
  });

  it('should log processing SSO login data', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const mockData = JSON.stringify({ token: 'test' });

    mockUseSearchParams.mockReturnValue({
      get: vi.fn((key: string) => (key === 'data' ? mockData : null)),
    });

    render(<SsoLogin />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('processing SSO login data', {
        dataLength: mockData.length,
      });
    });

    consoleSpy.mockRestore();
  });

  it('should log SSO login redirecting', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const mockData = JSON.stringify({ token: 'test' });

    mockUseSearchParams.mockReturnValue({
      get: vi.fn((key: string) => {
        if (key === 'data') return mockData;
        if (key === 'redirect-path') return '/test';
        return null;
      }),
    });

    render(<SsoLogin />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('SSO login redirecting', {
        redirectPath: '/test',
        targetUrl: 'https://example.com/test',
      });
    });

    consoleSpy.mockRestore();
  });
});
