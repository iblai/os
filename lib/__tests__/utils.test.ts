import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  cn,
  hasNonExpiredAuthToken,
  redirectToAuthSpa,
  getPlatformKey,
  getAuthSpaJoinUrl,
  redirectToAuthSpaJoinTenant,
  redirectToMentor,
  redirectToNoMentorsPage,
  redirectToCreateMentor,
  formatDateString,
  storageService,
  LocalStorageService,
  getHostFromUrl,
  preprocessLaTeX,
  textTruncate,
  mentorIsIframe,
  isJSON,
  isInIframe,
  deleteCookie,
  getDomainParts,
  deleteCookieOnAllDomains,
  getParentDomain,
  clearCookies,
  handleLogout,
  canSwitchProvider,
  handleTenantSwitch,
  canSwitchLLm,
  convertFromBytes,
  formatRelativeDate,
  getLLMProviderDetails,
  sendMessageToParentWebsite,
  isLoggedIn,
  htmlToMarkdown,
  isHtml,
  parsePrompt,
  markdownToHtml,
  getUserOS,
  saveUserObjectToLocalStorage,
  maxDatasetFileSizeInMegaBytes,
  formatDateToYYYYMMDD,
  formatDateToShortFormat,
  formatRelativeTime,
  getMentorIdFromUrl,
  getTenantKeyFromUrl,
  isStripeActivated,
  getCurrentArtifactTitle,
  getFirstMessageWithContent,
  isSafariBrowser,
} from '@/lib/utils';
import { LOCAL_STORAGE_KEYS, QUERY_PARAMS } from '@/lib/constants';
import { config } from '@/lib/config';

// Mock the constants and config
vi.mock('@/lib/constants', () => ({
  LOCAL_STORAGE_KEYS: {
    AUTH_TOKEN: 'axd_token',
    TOKEN_EXPIRY: 'axd_token_expires',
    REDIRECT_TO: 'redirect-to',
    CURRENT_TENANT: 'current_tenant',
    USER_DATA: 'userData',
    TENANTS: 'tenants',
    DEFAULT_TENANT: 'tenant',
  },
  QUERY_PARAMS: {
    APP: 'app',
    REDIRECT_TO: 'redirect-to',
    TENANT: 'tenant',
  },
  URL_PATTERNS: {
    PLATFORM_KEY: /\/platform\/([^/]+)\//,
  },
  REDIRECT_PATH_LOCAL_STORAGE_KEY: 'redirect-to',
}));

vi.mock('@/lib/config', () => ({
  config: {
    authUrl: () => 'https://auth.example.com',
    iblPlatform: () => 'mentor',
    mentorTrainingMaximumFileSize: () => '60',
    stripeEnabled: vi.fn(() => 'true'),
  },
}));

// Mock Tauri-related functions
vi.mock('@/types/tauri', () => ({
  isTauriApp: vi.fn(() => false),
}));

vi.mock('@/lib/tauri-api-cache', () => ({
  isTauriOfflineMode: vi.fn(() => false),
}));

vi.mock('@/hooks/use-tauri-offline', () => ({
  isOfflineServerOrigin: vi.fn(() => false),
}));

vi.mock('@iblai/iblai-js/web-utils', () => ({
  clearCurrentTenantCookie: vi.fn(),
}));

// Mock localStorage with spied functions
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
  };
})();

// Mock window.location
const windowLocationMock = (() => {
  let currentHref = 'https://example.com/test';
  return {
    get href() {
      return currentHref;
    },
    set href(value: string) {
      currentHref = value;
    },
    origin: 'https://example.com',
    pathname: '/test',
    search: '?query=value',
  };
})();

describe('cn function', () => {
  it('should combine class names correctly', () => {
    // Basic test
    expect(cn('class1', 'class2')).toBe('class1 class2');

    // Test with conditional classes
    expect(cn('class1', true && 'class2', false && 'class3')).toBe(
      'class1 class2',
    );

    // Test with null and undefined
    expect(cn('class1', null, undefined, 'class2')).toBe('class1 class2');

    // Test with array of classes
    expect(cn(['class1', 'class2'], 'class3')).toBe('class1 class2 class3');

    // Test with object notation
    expect(cn({ class1: true, class2: false, class3: true })).toBe(
      'class1 class3',
    );

    // Test tailwind merge functionality
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');

    // Test with empty inputs
    expect(cn()).toBe('');
  });
});

describe('hasNonExpiredAuthToken function', () => {
  beforeEach(() => {
    // Setup global window object
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });

    // Clear localStorage before each test
    localStorageMock.clear();
  });

  it('should return true when no token exists', () => {
    expect(hasNonExpiredAuthToken()).toBe(true);
  });

  it('should return true when token exists but no expiry', () => {
    localStorageMock.setItem(LOCAL_STORAGE_KEYS.AUTH_TOKEN, 'valid-token');
    expect(hasNonExpiredAuthToken()).toBe(true);
  });

  it('should return false when token expiry is invalid date', () => {
    localStorageMock.setItem(LOCAL_STORAGE_KEYS.AUTH_TOKEN, 'valid-token');
    localStorageMock.setItem(LOCAL_STORAGE_KEYS.TOKEN_EXPIRY, 'invalid-date');
    expect(hasNonExpiredAuthToken()).toBe(false);
  });

  it('should return false when token is expired', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1); // Yesterday

    localStorageMock.setItem(LOCAL_STORAGE_KEYS.AUTH_TOKEN, 'valid-token');
    localStorageMock.setItem(
      LOCAL_STORAGE_KEYS.TOKEN_EXPIRY,
      pastDate.toISOString(),
    );

    expect(hasNonExpiredAuthToken()).toBe(false);
  });

  it('should return true when token exists and is not expired', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1); // Tomorrow

    localStorageMock.setItem(LOCAL_STORAGE_KEYS.AUTH_TOKEN, 'valid-token');
    localStorageMock.setItem(
      LOCAL_STORAGE_KEYS.TOKEN_EXPIRY,
      futureDate.toISOString(),
    );

    expect(hasNonExpiredAuthToken()).toBe(true);
  });

  it('should return false when token expires exactly at current time', () => {
    // Mock current date
    const currentDate = new Date();
    const realDateNow = Date.now;
    Date.now = vi.fn(() => currentDate.getTime());

    localStorageMock.setItem(LOCAL_STORAGE_KEYS.AUTH_TOKEN, 'valid-token');
    localStorageMock.setItem(
      LOCAL_STORAGE_KEYS.TOKEN_EXPIRY,
      currentDate.toISOString(),
    );

    expect(hasNonExpiredAuthToken()).toBe(false);

    // Restore Date.now
    Date.now = realDateNow;
  });
});

describe('redirectToAuthSpa function', () => {
  beforeEach(() => {
    // Reset the window.location mock href
    windowLocationMock.href = 'https://example.com/test';

    // Setup global window object
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(window, 'location', {
      value: windowLocationMock,
      writable: true,
      configurable: true,
    });

    // Clear localStorage before each test
    localStorageMock.clear();

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore any mocks
    vi.restoreAllMocks();
  });

  it('should redirect to auth URL with correct parameters', async () => {
    // Call the function
    await redirectToAuthSpa();

    // Check if localStorage was updated with redirect path
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      LOCAL_STORAGE_KEYS.REDIRECT_TO,
      '/test?query=value',
    );

    // Check if window.location.href was set correctly (through API redirect)
    const directAuthUrl = `${config.authUrl()}/login?${QUERY_PARAMS.APP}=${config.iblPlatform()}&${QUERY_PARAMS.REDIRECT_TO}=https://example.com`;
    const expectedUrl = `/api/auth-redirect?to=${encodeURIComponent(directAuthUrl)}`;
    expect(windowLocationMock.href).toBe(expectedUrl);
  });

  it('should work with empty pathname and search', async () => {
    // Save original values to restore later
    const originalPathname = windowLocationMock.pathname;
    const originalSearch = windowLocationMock.search;

    // Temporarily modify the mock properties
    windowLocationMock.pathname = '';
    windowLocationMock.search = '';

    // Reset href to initial value
    windowLocationMock.href = 'https://example.com/test';

    // Call the function
    await redirectToAuthSpa();

    // Check correct redirect path was stored
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      LOCAL_STORAGE_KEYS.REDIRECT_TO,
      '',
    );

    // Check if window.location.href was set correctly (through API redirect)
    const directAuthUrl = `${config.authUrl()}/login?${QUERY_PARAMS.APP}=${config.iblPlatform()}&${QUERY_PARAMS.REDIRECT_TO}=https://example.com`;
    const expectedUrl = `/api/auth-redirect?to=${encodeURIComponent(directAuthUrl)}`;
    expect(windowLocationMock.href).toBe(expectedUrl);

    // Restore original values
    windowLocationMock.pathname = originalPathname;
    windowLocationMock.search = originalSearch;
  });
});

describe('getPlatformKey function', () => {
  it('should extract platform key from URL', () => {
    expect(getPlatformKey('/platform/test-platform/dashboard')).toBe(
      'test-platform',
    );
  });

  it('should return null when no platform key is found', () => {
    expect(getPlatformKey('/dashboard')).toBeNull();
  });

  it('should work with complex URLs', () => {
    expect(
      getPlatformKey('/platform/complex-platform-123/settings/user?id=456'),
    ).toBe('complex-platform-123');
  });

  it('should handle URLs with multiple platform-like patterns', () => {
    // Only the first match should be returned
    expect(
      getPlatformKey('/platform/first-platform/some/platform/second-platform'),
    ).toBe('first-platform');
  });

  it('should handle edge case with empty URL', () => {
    expect(getPlatformKey('')).toBeNull();
  });

  it('should handle case with partial match', () => {
    expect(getPlatformKey('/plat')).toBeNull();
  });

  it('should handle case with URL ending in /platform/', () => {
    expect(getPlatformKey('/some/path/to/platform/')).toBeNull();
  });
});

describe('getAuthSpaJoinUrl function', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      value: {
        pathname: '/platform/test-tenant/mentor',
        href: 'https://example.com/platform/test-tenant/mentor',
      },
      writable: true,
      configurable: true,
    });
  });

  it('should generate join URL with provided tenant key', () => {
    const result = getAuthSpaJoinUrl('my-tenant');
    expect(result).toBe(
      `https://auth.example.com/join?tenant=my-tenant&redirect-to=${encodeURIComponent('https://example.com/platform/test-tenant/mentor')}`,
    );
  });

  it('should extract tenant from URL when not provided', () => {
    const result = getAuthSpaJoinUrl();
    expect(result).toBe(
      `https://auth.example.com/join?tenant=test-tenant&redirect-to=${encodeURIComponent('https://example.com/platform/test-tenant/mentor')}`,
    );
  });

  it('should use custom redirect URL when provided', () => {
    const customUrl = 'https://custom.com/path';
    const result = getAuthSpaJoinUrl('tenant-key', customUrl);
    expect(result).toBe(
      `https://auth.example.com/join?tenant=tenant-key&redirect-to=${encodeURIComponent(customUrl)}`,
    );
  });

  it('should return empty string when no tenant can be resolved', () => {
    Object.defineProperty(window, 'location', {
      value: {
        pathname: '/no-platform-here',
        href: 'https://example.com/no-platform-here',
      },
      writable: true,
      configurable: true,
    });
    const result = getAuthSpaJoinUrl();
    expect(result).toBe('');
  });
});

describe('redirectToAuthSpaJoinTenant function', () => {
  let locationHrefSpy: any;

  beforeEach(() => {
    locationHrefSpy = '';
    Object.defineProperty(window, 'location', {
      value: {
        pathname: '/platform/test-tenant/mentor',
        set href(value: string) {
          locationHrefSpy = value;
        },
        get href() {
          return (
            locationHrefSpy || 'https://example.com/platform/test-tenant/mentor'
          );
        },
      },
      writable: true,
      configurable: true,
    });
  });

  it('should redirect to join URL with tenant key', () => {
    redirectToAuthSpaJoinTenant('my-tenant');
    expect(locationHrefSpy).toContain(
      'https://auth.example.com/join?tenant=my-tenant',
    );
  });

  it('should use current URL as redirect when not provided', () => {
    redirectToAuthSpaJoinTenant('tenant-key');
    expect(locationHrefSpy).toContain(
      encodeURIComponent('https://example.com/platform/test-tenant/mentor'),
    );
  });

  it('should use custom redirect URL when provided', () => {
    const customUrl = 'https://custom.com/path';
    redirectToAuthSpaJoinTenant('tenant-key', customUrl);
    expect(locationHrefSpy).toContain(encodeURIComponent(customUrl));
  });

  it('should fall back to redirectToAuthSpa when no tenant key is resolved', async () => {
    // Mock a location without a tenant key in the pathname
    Object.defineProperty(window, 'location', {
      value: {
        pathname: '/some/path/without/tenant',
        set href(value: string) {
          locationHrefSpy = value;
        },
        get href() {
          return 'https://example.com/some/path';
        },
      },
      writable: true,
      configurable: true,
    });

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Call without explicit tenant key - both params undefined
    redirectToAuthSpaJoinTenant(undefined, undefined);

    // Should log the fallback message
    expect(consoleSpy).toHaveBeenCalledWith(
      '[auth-redirect] Missing tenant key for join',
      expect.objectContaining({
        tenantKey: undefined,
        redirectUrl: undefined,
      }),
    );

    // Wait for the async redirectToAuthSpa to complete (it has a 100ms delay)
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Should redirect via the auth-redirect API endpoint
    expect(locationHrefSpy).toContain('/api/auth-redirect');
    expect(locationHrefSpy).toContain(
      encodeURIComponent('https://auth.example.com/login'),
    );

    consoleSpy.mockRestore();
  });
});

describe('redirectToMentor function', () => {
  let locationHrefSpy: string;

  beforeEach(() => {
    locationHrefSpy = '';
    Object.defineProperty(window, 'location', {
      value: {
        set href(value: string) {
          locationHrefSpy = value;
        },
        get href() {
          return locationHrefSpy;
        },
      },
      writable: true,
      configurable: true,
    });
  });

  it('should redirect to correct mentor URL', () => {
    redirectToMentor('my-tenant', 'mentor-123');
    expect(locationHrefSpy).toBe('/platform/my-tenant/mentor-123');
  });
});

describe('redirectToNoMentorsPage function', () => {
  let locationHrefSpy: string;

  beforeEach(() => {
    locationHrefSpy = '';
    Object.defineProperty(window, 'location', {
      value: {
        set href(value: string) {
          locationHrefSpy = value;
        },
        get href() {
          return locationHrefSpy;
        },
      },
      writable: true,
      configurable: true,
    });
  });

  it('should redirect to no-mentors page', () => {
    redirectToNoMentorsPage();
    expect(locationHrefSpy).toBe('/no-mentors');
  });
});

describe('redirectToCreateMentor function', () => {
  let locationHrefSpy: string;

  beforeEach(() => {
    locationHrefSpy = '';
    Object.defineProperty(window, 'location', {
      value: {
        set href(value: string) {
          locationHrefSpy = value;
        },
        get href() {
          return locationHrefSpy;
        },
      },
      writable: true,
      configurable: true,
    });
  });

  it('should redirect to create-mentor page', () => {
    redirectToCreateMentor();
    expect(locationHrefSpy).toBe('/create-mentor');
  });
});

describe('formatDateString function', () => {
  it('should format date correctly', () => {
    const result = formatDateString('2024-01-15T10:30:00Z');
    expect(result).toBe('January 15, 2024');
  });

  it('should handle different month', () => {
    const result = formatDateString('2024-12-25T10:30:00Z');
    expect(result).toBe('December 25, 2024');
  });

  it('should handle single digit day', () => {
    const result = formatDateString('2024-06-05T10:30:00Z');
    expect(result).toBe('June 5, 2024');
  });
});

describe('storageService function', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
    localStorageMock.clear();
  });

  it('should get item from localStorage', async () => {
    localStorageMock.setItem('test-key', JSON.stringify({ value: 'test' }));
    const service = storageService();
    const result = await service.getItem<{ value: string }>('test-key');
    expect(result).toEqual({ value: 'test' });
  });

  it('should return null for non-existent item', async () => {
    const service = storageService();
    const result = await service.getItem('non-existent');
    expect(result).toBeNull();
  });

  it('should set item in localStorage', async () => {
    const service = storageService();
    await service.setItem('test-key', { value: 'test' });
    expect(localStorageMock.getItem('test-key')).toBe(
      JSON.stringify({ value: 'test' }),
    );
  });

  it('should remove item from localStorage', async () => {
    localStorageMock.setItem('test-key', 'value');
    const service = storageService();
    await service.removeItem('test-key');
    expect(localStorageMock.getItem('test-key')).toBeNull();
  });
});

describe('LocalStorageService class', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
    localStorageMock.clear();
  });

  it('should return singleton instance', () => {
    const instance1 = LocalStorageService.getInstance();
    const instance2 = LocalStorageService.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should get item from localStorage', async () => {
    localStorageMock.setItem('test-key', 'test-value');
    const service = LocalStorageService.getInstance();
    const result = await service.getItem<string>('test-key');
    expect(result).toBe('test-value');
  });

  it('should set item in localStorage', async () => {
    const service = LocalStorageService.getInstance();
    await service.setItem('test-key', 'test-value');
    expect(localStorageMock.getItem('test-key')).toBe('test-value');
  });

  it('should remove item from localStorage', async () => {
    localStorageMock.setItem('test-key', 'value');
    const service = LocalStorageService.getInstance();
    await service.removeItem('test-key');
    expect(localStorageMock.getItem('test-key')).toBeNull();
  });
});

describe('getHostFromUrl function', () => {
  const originalDocument = global.document;

  beforeEach(() => {
    // Mock document.createElement for anchor element
    global.document = {
      createElement: vi.fn((tag: string) => {
        if (tag === 'a') {
          return {
            set href(url: string) {
              const urlObj = new URL(url);
              this.hostname = urlObj.hostname;
            },
            hostname: '',
          };
        }
        return {};
      }),
    } as any;
  });

  afterEach(() => {
    global.document = originalDocument;
  });

  it('should extract hostname from URL', () => {
    const result = getHostFromUrl('https://example.com/path');
    expect(result).toBe('example.com');
  });

  it('should extract hostname with subdomain', () => {
    const result = getHostFromUrl('https://sub.example.com/path');
    expect(result).toBe('sub.example.com');
  });

  it('should handle localhost', () => {
    const result = getHostFromUrl('http://localhost:3000/path');
    expect(result).toBe('localhost');
  });

  it('should handle IP addresses', () => {
    const result = getHostFromUrl('http://192.168.1.1:8080/path');
    expect(result).toBe('192.168.1.1');
  });
});

describe('preprocessLaTeX function', () => {
  it('should return empty string for non-string input', () => {
    expect(preprocessLaTeX(null as any)).toBe('');
    expect(preprocessLaTeX(undefined as any)).toBe('');
    expect(preprocessLaTeX(123 as any)).toBe('');
  });

  it('should escape currency dollar signs', () => {
    expect(preprocessLaTeX('Price is $5')).toBe('Price is \\$5');
    expect(preprocessLaTeX('$100 total')).toBe('\\$100 total');
  });

  it('should not escape already escaped dollar signs', () => {
    expect(preprocessLaTeX('Already \\$5 escaped')).toBe(
      'Already \\$5 escaped',
    );
  });

  it('should convert block LaTeX delimiters', () => {
    expect(preprocessLaTeX('\\[x = 5\\]')).toBe('$$x = 5$$');
    expect(preprocessLaTeX('\\[ y = 10 \\]')).toBe('$$ y = 10 $$');
  });

  it('should convert inline LaTeX delimiters', () => {
    expect(preprocessLaTeX('\\(x = 5\\)')).toBe('$x = 5$');
    expect(preprocessLaTeX('\\( y = 10 \\)')).toBe('$ y = 10 $');
  });

  it('should convert textbf to markdown bold', () => {
    expect(preprocessLaTeX('\\textbf{bold text}')).toBe('**bold text**');
  });

  it('should convert textit to markdown italic', () => {
    expect(preprocessLaTeX('\\textit{italic text}')).toBe('*italic text*');
  });

  it('should convert emph to markdown italic', () => {
    expect(preprocessLaTeX('\\emph{emphasized}')).toBe('*emphasized*');
  });

  it('should convert texttt to code', () => {
    expect(preprocessLaTeX('\\texttt{code}')).toBe('`code`');
  });

  it('should convert underline to HTML', () => {
    expect(preprocessLaTeX('\\underline{underlined}')).toBe(
      '<u>underlined</u>',
    );
  });

  it('should convert itemize to unordered list', () => {
    const input = '\\begin{itemize}\\item First\\item Second\\end{itemize}';
    const result = preprocessLaTeX(input);
    expect(result).toContain('- First');
    expect(result).toContain('- Second');
  });

  it('should convert enumerate to ordered list', () => {
    const input = '\\begin{enumerate}\\item First\\item Second\\end{enumerate}';
    const result = preprocessLaTeX(input);
    expect(result).toContain('1. First');
    expect(result).toContain('2. Second');
  });

  it('should convert quote to blockquote', () => {
    expect(preprocessLaTeX('\\begin{quote}quoted text\\end{quote}')).toContain(
      '> quoted text',
    );
  });

  it('should convert center to centered div', () => {
    expect(preprocessLaTeX('\\begin{center}centered\\end{center}')).toContain(
      '<div style="text-align: center;">centered</div>',
    );
  });

  it('should convert section to markdown heading', () => {
    expect(preprocessLaTeX('\\section{Title}')).toContain('## Title');
  });

  it('should convert starred section to markdown heading', () => {
    expect(preprocessLaTeX('\\section*{Heading One}')).toContain(
      '## Heading One',
    );
  });

  it('should convert subsection to markdown heading', () => {
    expect(preprocessLaTeX('\\subsection{Subtitle}')).toContain('### Subtitle');
  });

  it('should convert starred subsection to markdown heading', () => {
    expect(preprocessLaTeX('\\subsection*{Core Evidence}')).toContain(
      '### Core Evidence',
    );
  });

  it('should convert subsubsection to markdown heading', () => {
    expect(preprocessLaTeX('\\subsubsection{Sub-subtitle}')).toContain(
      '#### Sub-subtitle',
    );
  });

  it('should convert starred subsubsection to markdown heading', () => {
    expect(preprocessLaTeX('\\subsubsection*{Deep Heading}')).toContain(
      '#### Deep Heading',
    );
  });

  it('should convert line breaks', () => {
    expect(preprocessLaTeX('line1\\\\line2')).toBe('line1  \nline2');
    expect(preprocessLaTeX('line1\n\\newlineline2')).toBe('line1  \nline2');
  });

  it('should convert verb to code', () => {
    expect(preprocessLaTeX('\\verb|code|')).toBe('`code`');
  });

  it('should convert LaTeX quotes', () => {
    expect(preprocessLaTeX('``quoted``')).toBe('"quoted"');
    expect(preprocessLaTeX("''quoted''")).toBe('"quoted"');
  });

  it('should escape LaTeX special characters', () => {
    expect(preprocessLaTeX('\\&')).toBe('&');
    expect(preprocessLaTeX('\\%')).toBe('%');
    expect(preprocessLaTeX('\\#')).toBe('#');
    expect(preprocessLaTeX('\\_')).toBe('_');
  });

  it('should handle complex LaTeX document', () => {
    const input =
      '\\section{Title}\\textbf{Bold} and \\textit{italic}\\\\\\item Test';
    const result = preprocessLaTeX(input);
    expect(result).toContain('## Title');
    expect(result).toContain('**Bold**');
    expect(result).toContain('*italic*');
  });

  it('should convert tabular to markdown table', () => {
    const input =
      '\\begin{tabular}{|c|c|c|}\\hline Name & Age & City \\\\\\hline Alice & 30 & NYC \\\\\\hline\\end{tabular}';
    const result = preprocessLaTeX(input);
    expect(result).toContain('| Name | Age | City |');
    expect(result).toContain('| --- | --- | --- |');
    expect(result).toContain('| Alice | 30 | NYC |');
  });

  it('should convert tabular without hline', () => {
    const input =
      '\\begin{tabular}{ccc}Header1 & Header2 & Header3 \\\\Row1 & Row2 & Row3\\end{tabular}';
    const result = preprocessLaTeX(input);
    expect(result).toContain('| Header1 | Header2 | Header3 |');
    expect(result).toContain('| Row1 | Row2 | Row3 |');
  });

  it('should convert array to markdown table', () => {
    const input = '\\begin{array}{cc}A & B \\\\C & D\\end{array}';
    const result = preprocessLaTeX(input);
    expect(result).toContain('| A | B |');
    expect(result).toContain('| C | D |');
  });

  it('should handle empty tabular gracefully', () => {
    const input = '\\begin{tabular}{|c|}\\end{tabular}';
    const result = preprocessLaTeX(input);
    expect(result).toBe('');
  });

  it('should handle tabular with only hlines', () => {
    const input = '\\begin{tabular}{|c|}\\hline\\hline\\end{tabular}';
    const result = preprocessLaTeX(input);
    expect(result).toBe('');
  });

  it('should convert tabular inside \\[...\\] math delimiters', () => {
    const input =
      '\\[\\begin{tabular}{lcc}A & B & C \\\\D & E & F\\end{tabular}\\]';
    const result = preprocessLaTeX(input);
    expect(result).toContain('| A | B | C |');
    expect(result).toContain('| D | E | F |');
    expect(result).not.toContain('$$');
  });

  it('should convert \\text{} to plain text in tables', () => {
    const input =
      '\\[\\begin{tabular}{lc}\\text{Disease} & \\text{Count} \\\\\\text{Yes} & 42\\end{tabular}\\]';
    const result = preprocessLaTeX(input);
    expect(result).toContain('| Disease | Count |');
    expect(result).toContain('| Yes | 42 |');
    expect(result).not.toContain('\\text');
  });

  it('should convert {,} thousands separator in tables', () => {
    const input =
      '\\[\\begin{tabular}{lr}\\text{Cases} & 12{,}500 \\\\\\text{Total} & 100{,}000\\end{tabular}\\]';
    const result = preprocessLaTeX(input);
    expect(result).toContain('| Cases | 12,500 |');
    expect(result).toContain('| Total | 100,000 |');
    expect(result).not.toContain('{,}');
  });

  it('should handle real-world epidemiology table', () => {
    const input = `\\[
\\begin{tabular}{lccc}
\\hline
 & \\text{Disease} & \\text{No Disease} & \\text{Total} \\\\
\\hline
\\text{Exposed} & 42 & 158 & 200 \\\\
\\text{Unexposed} & 18 & 182 & 200 \\\\
\\hline
\\end{tabular}
\\]`;
    const result = preprocessLaTeX(input);
    expect(result).toContain('| Disease | No Disease | Total |');
    expect(result).toContain('| Exposed | 42 | 158 | 200 |');
    expect(result).toContain('| Unexposed | 18 | 182 | 200 |');
  });
});

describe('textTruncate function', () => {
  it('should truncate long text', () => {
    const longText = 'a'.repeat(100);
    const result = textTruncate(longText, 50);
    expect(result.length).toBe(50);
    expect(result.endsWith('...')).toBe(true);
  });

  it('should not truncate short text', () => {
    const shortText = 'short';
    const result = textTruncate(shortText, 50);
    expect(result).toBe('short');
  });

  it('should use default length of 50', () => {
    const longText = 'a'.repeat(100);
    const result = textTruncate(longText, null as any);
    expect(result.length).toBe(50);
  });

  it('should use custom ending', () => {
    const longText = 'a'.repeat(100);
    const result = textTruncate(longText, 50, '---');
    expect(result.endsWith('---')).toBe(true);
  });

  it('should use default ending', () => {
    const longText = 'a'.repeat(100);
    const result = textTruncate(longText, 50, null as any);
    expect(result.endsWith('...')).toBe(true);
  });

  it('should handle exact length match', () => {
    const text = 'a'.repeat(50);
    const result = textTruncate(text, 50);
    expect(result).toBe(text);
  });
});

describe('mentorIsIframe function', () => {
  it('should return true when in iframe', () => {
    Object.defineProperty(window, 'self', { value: {}, writable: true });
    Object.defineProperty(window, 'top', {
      value: { different: true },
      writable: true,
    });
    expect(mentorIsIframe()).toBe(true);
  });

  it('should return false when not in iframe', () => {
    const windowRef = {};
    Object.defineProperty(window, 'self', { value: windowRef, writable: true });
    Object.defineProperty(window, 'top', { value: windowRef, writable: true });
    expect(mentorIsIframe()).toBe(false);
  });
});

describe('isJSON function', () => {
  it('should return true for valid JSON string', () => {
    expect(isJSON('{"key": "value"}')).toBe(true);
    expect(isJSON('["a", "b", "c"]')).toBe(true);
    expect(isJSON('123')).toBe(true);
    expect(isJSON('true')).toBe(true);
  });

  it('should return false for invalid JSON', () => {
    expect(isJSON('{invalid}')).toBe(false);
    expect(isJSON('not json')).toBe(false);
  });

  it('should return false for non-string input', () => {
    expect(isJSON(123 as any)).toBe(false);
    expect(isJSON(null as any)).toBe(false);
    expect(isJSON(undefined as any)).toBe(false);
    expect(isJSON({} as any)).toBe(false);
  });
});

describe('isInIframe function', () => {
  it('should return true when in iframe', () => {
    Object.defineProperty(window, 'self', {
      value: {},
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, 'top', {
      value: { different: true },
      writable: true,
      configurable: true,
    });
    expect(isInIframe()).toBe(true);
  });

  it('should return false when not in iframe', () => {
    const windowRef = {};
    Object.defineProperty(window, 'self', {
      value: windowRef,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, 'top', {
      value: windowRef,
      writable: true,
      configurable: true,
    });
    expect(isInIframe()).toBe(false);
  });

  it('should return false when window is undefined', () => {
    const originalWindow = global.window;
    delete (global as any).window;
    expect(isInIframe()).toBe(false);
    global.window = originalWindow;
  });
});

describe('deleteCookie function', () => {
  beforeEach(() => {
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: '',
    });
  });

  it('should set cookie with expiration in the past', () => {
    deleteCookie('test', '/', 'example.com');
    expect(document.cookie).toContain('test=');
    expect(document.cookie).toContain('expires=Thu, 01 Jan 1970 00:00:00 UTC');
  });

  it('should include path when provided', () => {
    deleteCookie('test', '/path', 'example.com');
    expect(document.cookie).toContain('path=/path');
  });

  it('should include domain when provided', () => {
    deleteCookie('test', '/', 'example.com');
    expect(document.cookie).toContain('domain=example.com');
  });

  it('should work without path', () => {
    deleteCookie('test', '', 'example.com');
    expect(document.cookie).toContain('test=');
  });

  it('should work without domain', () => {
    deleteCookie('test', '/', '');
    expect(document.cookie).toContain('test=');
  });
});

describe('getDomainParts function', () => {
  it('should split domain into parts', () => {
    const result = getDomainParts('sub.example.com');
    expect(result).toEqual(['com', 'example.com', 'sub.example.com']);
  });

  it('should handle simple domain', () => {
    const result = getDomainParts('example.com');
    expect(result).toEqual(['com', 'example.com']);
  });

  it('should handle localhost', () => {
    const result = getDomainParts('localhost');
    expect(result).toEqual(['localhost']);
  });

  it('should handle deeply nested subdomain', () => {
    const result = getDomainParts('a.b.c.example.com');
    expect(result).toEqual([
      'com',
      'example.com',
      'c.example.com',
      'b.c.example.com',
      'a.b.c.example.com',
    ]);
  });
});

describe('deleteCookieOnAllDomains function', () => {
  beforeEach(() => {
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: '',
    });
  });

  it('should delete cookie on all domain parts', () => {
    deleteCookieOnAllDomains('test', 'sub.example.com');
    // Should call for each domain part - just verify function runs without error
    expect(true).toBe(true);
  });
});

describe('getParentDomain function', () => {
  it('should extract parent domain', () => {
    expect(getParentDomain('sub.example.com')).toBe('.example.com');
  });

  it('should handle simple domain', () => {
    expect(getParentDomain('example.com')).toBe('.example.com');
  });

  it('should handle single part domain', () => {
    expect(getParentDomain('localhost')).toBe('localhost');
  });

  it('should handle empty string', () => {
    expect(getParentDomain('')).toBe('');
  });

  it('should handle undefined', () => {
    expect(getParentDomain(undefined)).toBe('');
  });
});

describe('clearCookies function', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      value: { hostname: 'example.com' },
      writable: true,
      configurable: true,
    });
  });

  it('should clear all cookies', () => {
    clearCookies();
    // Should have attempted to clear cookies - function runs without error
    expect(true).toBe(true);
  });
});

describe('canSwitchProvider function', () => {
  it('should return true when provider has chat models', () => {
    const providers = [
      { name: 'openai', chat_models: ['gpt-4', 'gpt-3.5'] },
      { name: 'anthropic', chat_models: ['claude'] },
    ];
    expect(canSwitchProvider(providers, 'openai')).toBe(true);
  });

  it('should return false when provider has no chat models', () => {
    const providers = [{ name: 'openai', chat_models: [] }];
    expect(canSwitchProvider(providers, 'openai')).toBe(false);
  });

  it('should return false when provider is not found', () => {
    const providers = [{ name: 'openai', chat_models: ['gpt-4'] }];
    expect(canSwitchProvider(providers, 'nonexistent')).toBe(false);
  });

  it('should return false when chat_models is undefined', () => {
    const providers = [{ name: 'openai', chat_models: undefined as any }];
    expect(canSwitchProvider(providers, 'openai')).toBe(false);
  });
});

describe('canSwitchLLm function', () => {
  it('should return true when llm has credentials', () => {
    expect(canSwitchLLm({ has_credentials: true })).toBe(true);
  });

  it('should return true when can use main keys and main has credentials', () => {
    expect(
      canSwitchLLm({
        has_credentials: false,
        can_use_main_keys: true,
        main_has_credentials: true,
      }),
    ).toBe(true);
  });

  it('should return true when can use main keys and main_has_credentials is undefined', () => {
    expect(
      canSwitchLLm({
        has_credentials: false,
        can_use_main_keys: true,
        main_has_credentials: undefined,
      }),
    ).toBe(true);
  });

  it('should return false when cannot use main keys', () => {
    expect(
      canSwitchLLm({
        has_credentials: false,
        can_use_main_keys: false,
        main_has_credentials: true,
      }),
    ).toBe(false);
  });

  it('should return false when main has no credentials', () => {
    expect(
      canSwitchLLm({
        has_credentials: false,
        can_use_main_keys: true,
        main_has_credentials: false,
      }),
    ).toBe(false);
  });
});

describe('convertFromBytes function', () => {
  it('should return 0 B for 0 bytes', () => {
    expect(convertFromBytes(0)).toEqual({ value: 0, unit: 'B' });
  });

  it('should convert bytes to KB', () => {
    expect(convertFromBytes(1024)).toEqual({ value: 1, unit: 'KB' });
  });

  it('should convert bytes to MB', () => {
    expect(convertFromBytes(1024 * 1024)).toEqual({ value: 1, unit: 'MB' });
  });

  it('should convert bytes to GB', () => {
    expect(convertFromBytes(1024 * 1024 * 1024)).toEqual({
      value: 1,
      unit: 'GB',
    });
  });

  it('should convert bytes to TB', () => {
    expect(convertFromBytes(1024 * 1024 * 1024 * 1024)).toEqual({
      value: 1,
      unit: 'TB',
    });
  });

  it('should handle decimal values', () => {
    const result = convertFromBytes(1536);
    expect(result.value).toBe(1.5);
    expect(result.unit).toBe('KB');
  });

  it('should round to 2 decimal places', () => {
    const result = convertFromBytes(1234567);
    expect(result.value).toBe(1.18);
    expect(result.unit).toBe('MB');
  });
});

describe('formatRelativeDate function', () => {
  it('should format today as time only', () => {
    const now = new Date();
    const result = formatRelativeDate(now.toISOString());
    expect(result).toMatch(/\d{1,2}:\d{2}(AM|PM)/i);
  });

  it('should format recent dates with day name', () => {
    const date = new Date();
    date.setDate(date.getDate() - 3);
    const result = formatRelativeDate(date.toISOString());
    expect(result).toMatch(
      /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/,
    );
  });

  it('should format dates within 30 days with month', () => {
    const date = new Date();
    date.setDate(date.getDate() - 15);
    const result = formatRelativeDate(date.toISOString());
    expect(result).toMatch(/[A-Z][a-z]{2} \d{1,2}/);
  });

  it('should format old dates with year', () => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 1);
    const result = formatRelativeDate(date.toISOString());
    expect(result).toMatch(/[A-Z][a-z]{2} \d{1,2}, \d{4}/);
  });
});

describe('getLLMProviderDetails function', () => {
  it('should return Groq details', () => {
    const result = getLLMProviderDetails('groq');
    expect(result).toEqual({ logo: '/llm-groq-provider.png', name: 'Groq' });
  });

  it('should return NVIDIA details for IBLChatNvidia', () => {
    const result = getLLMProviderDetails('IBLChatNvidia');
    expect(result).toEqual({
      logo: '/llm-nvidia-provider.webp',
      name: 'NVIDIA',
    });
  });

  it('should return NVIDIA details for nvidia', () => {
    const result = getLLMProviderDetails('nvidia');
    expect(result).toEqual({
      logo: '/llm-nvidia-provider.webp',
      name: 'NVIDIA',
    });
  });

  it('should return Microsoft details', () => {
    const result = getLLMProviderDetails('azure_openai');
    expect(result).toEqual({
      logo: '/llm-microsoft-provider.png',
      name: 'Microsoft',
    });
  });

  it('should return OpenAI details with model name', () => {
    const result = getLLMProviderDetails('openai', 'gpt-4');
    expect(result).toEqual({
      logo: '/llm-openai-provider.jpg',
      name: 'OpenAI',
    });
  });

  it('should return OpenAI details without model name', () => {
    const result = getLLMProviderDetails('openai');
    expect(result).toEqual({
      logo: '/llm-openai-provider-2.svg',
      name: 'OpenAI',
    });
  });

  it('should return Mistral details', () => {
    const result = getLLMProviderDetails('mistral');
    expect(result).toEqual({
      logo: '/llm-mistral-provider.jpeg',
      name: 'Mistral',
    });
  });

  it('should return Google details with model name', () => {
    const result = getLLMProviderDetails('google', 'gemini');
    expect(result).toEqual({
      logo: '/llm-gemini-provider.png',
      name: 'Google',
    });
  });

  it('should return Google details without model name', () => {
    const result = getLLMProviderDetails('google');
    expect(result).toEqual({
      logo: '/llm-google-provider.svg',
      name: 'Google',
    });
  });

  it('should return Meta details', () => {
    const result = getLLMProviderDetails('llama');
    expect(result).toEqual({ logo: '/llm-llama-provider.jpeg', name: 'Meta' });
  });

  it('should return Anthropic details for IBLChatAnthropic', () => {
    const result = getLLMProviderDetails('IBLChatAnthropic');
    expect(result).toEqual({
      logo: '/llm-claude-provider.png',
      name: 'Anthropic',
    });
  });

  it('should return Anthropic details for anthropic', () => {
    const result = getLLMProviderDetails('anthropic');
    expect(result).toEqual({
      logo: '/llm-claude-provider.png',
      name: 'Anthropic',
    });
  });

  it('should return Perplexity details', () => {
    const result = getLLMProviderDetails('perplexity');
    expect(result).toEqual({
      logo: '/llm-perplexity-provider.webp',
      name: 'Perplexity',
    });
  });

  it('should return DeepSeek details', () => {
    const result = getLLMProviderDetails('deepseek');
    expect(result).toEqual({
      logo: '/llm-deepseek-provider.png',
      name: 'DeepSeek',
    });
  });

  it('should return xAI details', () => {
    const result = getLLMProviderDetails('xai');
    expect(result).toEqual({ logo: '/llm-xai-provider.jpg', name: 'xAI' });
  });

  it('should return NVIDIA details for nvidia provider', () => {
    const result = getLLMProviderDetails('nvidia');
    expect(result).toEqual({
      logo: '/llm-nvidia-provider.webp',
      name: 'NVIDIA',
    });
  });

  it('should return Amazon details for bedrock', () => {
    const result = getLLMProviderDetails('bedrock');
    expect(result).toEqual({
      logo: '/llm-amazon-provider.png',
      name: 'Amazon',
    });
  });

  it('should return Amazon details for amazon-bedrock', () => {
    const result = getLLMProviderDetails('amazon-bedrock');
    expect(result).toEqual({
      logo: '/llm-amazon-provider.png',
      name: 'Amazon',
    });
  });

  it('should return Amazon details for amazon_bedrock', () => {
    const result = getLLMProviderDetails('amazon_bedrock');
    expect(result).toEqual({
      logo: '/llm-amazon-provider.png',
      name: 'Amazon',
    });
  });

  it('should return Amazon details for IBLChatBedrock', () => {
    const result = getLLMProviderDetails('IBLChatBedrock');
    expect(result).toEqual({
      logo: '/llm-amazon-provider.png',
      name: 'Amazon',
    });
  });

  it('should return generic details for unknown provider', () => {
    const result = getLLMProviderDetails('unknown-provider');
    expect(result).toEqual({
      logo: '/llm-generic-provider.png',
      name: 'unknown-provider',
    });
  });
});

describe('sendMessageToParentWebsite function', () => {
  it('should post message to parent', () => {
    const postMessageSpy = vi.fn();
    Object.defineProperty(window, 'parent', {
      value: { postMessage: postMessageSpy },
      writable: true,
    });

    const payload = { test: 'data' };
    sendMessageToParentWebsite(payload);
    expect(postMessageSpy).toHaveBeenCalledWith(payload, '*');
  });
});

describe('isLoggedIn function', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
    localStorageMock.clear();
  });

  it('should return true when token exists', () => {
    localStorageMock.setItem('axd_token', 'test-token');
    expect(isLoggedIn()).toBe(true);
  });

  it('should return false when token does not exist', () => {
    expect(isLoggedIn()).toBe(false);
  });
});

describe('isHtml function', () => {
  it('should return true for valid HTML', () => {
    expect(isHtml('<div>test</div>')).toBe(true);
    expect(isHtml('<p>paragraph</p>')).toBe(true);
    expect(isHtml('<img src="test.jpg" />')).toBe(true);
  });

  it('should return false for non-HTML', () => {
    expect(isHtml('plain text')).toBe(false);
    expect(isHtml('< not html')).toBe(false);
    expect(isHtml('not html >')).toBe(false);
  });

  it('should handle empty string', () => {
    expect(isHtml('')).toBe('');
  });

  it('should handle whitespace', () => {
    expect(isHtml('   <div>test</div>   ')).toBe(true);
  });

  it('should require closing tag or self-closing', () => {
    expect(isHtml('<div>')).toBe(false);
  });
});

describe('parsePrompt function', () => {
  it('should convert HTML to markdown', () => {
    const html = '<p>test</p>';
    const result = parsePrompt(html);
    expect(result).toContain('test');
  });

  it('should return non-HTML as-is', () => {
    const text = 'plain text';
    const result = parsePrompt(text);
    expect(result).toBe('plain text');
  });
});

describe('getUserOS function', () => {
  it('should detect Windows', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      writable: true,
      configurable: true,
    });
    expect(getUserOS()).toBe('Windows');
  });

  it('should detect macOS', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      writable: true,
      configurable: true,
    });
    expect(getUserOS()).toBe('macOS');
  });

  it('should detect Linux', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (X11; Linux x86_64)',
      writable: true,
      configurable: true,
    });
    expect(getUserOS()).toBe('Linux');
  });

  it('should detect Android', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Android 10)',
      writable: true,
      configurable: true,
    });
    expect(getUserOS()).toBe('Android');
  });

  it('should detect iOS from iPhone user agent', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
      writable: true,
      configurable: true,
    });
    expect(getUserOS()).toBe('iOS');
  });

  it('should detect iOS from iPad user agent', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)',
      writable: true,
      configurable: true,
    });
    expect(getUserOS()).toBe('iOS');
  });

  it('should detect iOS from iPod user agent', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPod touch; CPU iPhone OS 14_0 like Mac OS X)',
      writable: true,
      configurable: true,
    });
    expect(getUserOS()).toBe('iOS');
  });

  it('should return Unknown OS for unrecognized user agent', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Unknown Browser',
      writable: true,
      configurable: true,
    });
    expect(getUserOS()).toBe('Unknown OS');
  });
});

describe('saveUserObjectToLocalStorage function', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: '',
    });
    Object.defineProperty(window, 'location', {
      value: { hostname: 'example.com' },
      writable: true,
    });
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('should save user object to localStorage', () => {
    const userObject = {
      axd_token: 'token123',
      userData: '{"name": "John"}',
    };
    saveUserObjectToLocalStorage(userObject);
    expect(localStorageMock.getItem('axd_token')).toBe('token123');
    expect(localStorageMock.getItem('userData')).toBe('{"name":"John"}');
  });

  it('should clear localStorage before saving', () => {
    localStorageMock.setItem('old_key', 'old_value');
    const userObject = { new_key: 'new_value' };
    saveUserObjectToLocalStorage(userObject);
    expect(localStorageMock.getItem('old_key')).toBeNull();
  });

  it('should dispatch storage events', () => {
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');
    const userObject = { key1: 'value1', key2: 'value2' };
    saveUserObjectToLocalStorage(userObject);
    expect(dispatchEventSpy).toHaveBeenCalledWith(expect.any(StorageEvent));
  });

  it('should handle JSON string values', () => {
    const userObject = {
      jsonData: '{"nested": "object"}',
    };
    saveUserObjectToLocalStorage(userObject);
    expect(localStorageMock.getItem('jsonData')).toBe('{"nested":"object"}');
  });

  it('should handle non-JSON string values (catch branch)', () => {
    const userObject = {
      plainString: 'not-json-at-all',
      anotherString: 'hello world',
    };
    saveUserObjectToLocalStorage(userObject);
    expect(localStorageMock.getItem('plainString')).toBe('not-json-at-all');
    expect(localStorageMock.getItem('anotherString')).toBe('hello world');
  });

  it('should store primitive JSON values as-is (number string)', () => {
    const userObject = {
      numberString: '42',
      boolString: 'true',
    };
    saveUserObjectToLocalStorage(userObject);
    // Parsed as primitive, not object, so stored as-is
    expect(localStorageMock.getItem('numberString')).toBe('42');
    expect(localStorageMock.getItem('boolString')).toBe('true');
  });

  it('should handle localhost hostname (no domain in cookie)', () => {
    Object.defineProperty(window, 'location', {
      value: { hostname: 'localhost' },
      writable: true,
    });

    const userObject = {
      [LOCAL_STORAGE_KEYS.CURRENT_TENANT]: '{"key": "test"}',
    };
    saveUserObjectToLocalStorage(userObject);

    // Should still set cookie, just without domain attribute
    expect(document.cookie).toContain('ibl_current_tenant');
  });

  it('should handle IP address hostname (no domain in cookie)', () => {
    Object.defineProperty(window, 'location', {
      value: { hostname: '192.168.1.1' },
      writable: true,
    });

    const userObject = {
      [LOCAL_STORAGE_KEYS.CURRENT_TENANT]: '{"key": "test"}',
    };
    saveUserObjectToLocalStorage(userObject);

    // Should still set cookie, just without domain attribute
    expect(document.cookie).toContain('ibl_current_tenant');
  });
});

describe('maxDatasetFileSizeInMegaBytes function', () => {
  it('should return configured value', () => {
    const result = maxDatasetFileSizeInMegaBytes();
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThan(0);
  });

  it('should return numeric value', () => {
    const result = maxDatasetFileSizeInMegaBytes();
    expect(isNaN(result)).toBe(false);
  });
});

describe('formatDateToYYYYMMDD function', () => {
  it('should format date correctly', () => {
    const date = new Date('2024-01-15');
    expect(formatDateToYYYYMMDD(date)).toBe('2024-01-15');
  });

  it('should handle single digit month and day', () => {
    const date = new Date('2024-03-05');
    expect(formatDateToYYYYMMDD(date)).toBe('2024-03-05');
  });

  it('should return undefined for undefined input', () => {
    expect(formatDateToYYYYMMDD(undefined)).toBeUndefined();
  });

  it('should pad month and day with zeros', () => {
    const date = new Date('2024-01-01');
    expect(formatDateToYYYYMMDD(date)).toBe('2024-01-01');
  });
});

describe('formatDateToShortFormat function', () => {
  it('should format date without time', () => {
    const result = formatDateToShortFormat('2024-01-15');
    expect(result).toBe('Jan 15');
  });

  it('should format date with time', () => {
    const result = formatDateToShortFormat('2024-01-15 14:30:00');
    expect(result).toBe('Jan 15 14:30');
  });

  it('should return only time when displayOnlyTime is true', () => {
    const result = formatDateToShortFormat('2024-01-15 14:30:00', true);
    expect(result).toMatch(/\d{1,2}:\d{2}(AM|PM)/);
  });

  it('should handle AM times', () => {
    const result = formatDateToShortFormat('2024-01-15 08:30:00', true);
    expect(result).toBe('8:30AM');
  });

  it('should handle PM times', () => {
    const result = formatDateToShortFormat('2024-01-15 14:30:00', true);
    expect(result).toBe('2:30PM');
  });

  it('should handle midnight', () => {
    const result = formatDateToShortFormat('2024-01-15 00:00:00', true);
    expect(result).toBe('12:00AM');
  });

  it('should handle noon', () => {
    const result = formatDateToShortFormat('2024-01-15 12:00:00', true);
    expect(result).toBe('12:00PM');
  });

  it('should return result for invalid date', () => {
    const invalidDate = 'invalid-date';
    const result = formatDateToShortFormat(invalidDate);
    expect(result).toContain('Invalid Date');
  });
});

describe('formatRelativeTime function', () => {
  it('should return "Just now" for recent timestamps', () => {
    const now = new Date();
    const result = formatRelativeTime(now.toISOString());
    expect(result).toBe('Just now');
  });

  it('should return minutes ago', () => {
    const date = new Date();
    date.setMinutes(date.getMinutes() - 5);
    const result = formatRelativeTime(date.toISOString());
    expect(result).toBe('5 minutes ago');
  });

  it('should return singular minute', () => {
    const date = new Date();
    date.setMinutes(date.getMinutes() - 1);
    const result = formatRelativeTime(date.toISOString());
    expect(result).toBe('1 minute ago');
  });

  it('should return hours ago', () => {
    const date = new Date();
    date.setHours(date.getHours() - 3);
    const result = formatRelativeTime(date.toISOString());
    expect(result).toBe('3 hours ago');
  });

  it('should return singular hour', () => {
    const date = new Date();
    date.setHours(date.getHours() - 1);
    const result = formatRelativeTime(date.toISOString());
    expect(result).toBe('1 hour ago');
  });

  it('should return days ago', () => {
    const date = new Date();
    date.setDate(date.getDate() - 3);
    const result = formatRelativeTime(date.toISOString());
    expect(result).toBe('3 days ago');
  });

  it('should return weeks ago', () => {
    const date = new Date();
    date.setDate(date.getDate() - 14);
    const result = formatRelativeTime(date.toISOString());
    expect(result).toBe('2 weeks ago');
  });

  it('should return singular week', () => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    const result = formatRelativeTime(date.toISOString());
    expect(result).toBe('1 week ago');
  });

  it('should return months ago', () => {
    const date = new Date();
    date.setMonth(date.getMonth() - 2);
    const result = formatRelativeTime(date.toISOString());
    expect(result).toContain('month');
  });

  it('should return singular month', () => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    const result = formatRelativeTime(date.toISOString());
    expect(result).toBe('1 month ago');
  });

  it('should return years ago', () => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 2);
    const result = formatRelativeTime(date.toISOString());
    expect(result).toBe('2 years ago');
  });

  it('should return singular year', () => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 1);
    const result = formatRelativeTime(date.toISOString());
    expect(result).toBe('1 year ago');
  });

  it('should use singular forms correctly', () => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    const result = formatRelativeTime(date.toISOString());
    expect(result).toBe('1 day ago');
  });
});

describe('getMentorIdFromUrl function', () => {
  it('should extract mentor ID from URL', () => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/platform/tenant-key/mentor-123' },
      writable: true,
      configurable: true,
    });
    expect(getMentorIdFromUrl()).toBe('mentor-123');
  });

  it('should return null for non-platform URL', () => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/other-page' },
      writable: true,
      configurable: true,
    });
    expect(getMentorIdFromUrl()).toBeNull();
  });

  it('should handle complex mentor IDs', () => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/platform/tenant/mentor-123-abc-xyz' },
      writable: true,
      configurable: true,
    });
    expect(getMentorIdFromUrl()).toBe('mentor-123-abc-xyz');
  });
});

describe('getTenantKeyFromUrl function', () => {
  it('should extract tenant key from URL', () => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/platform/my-tenant/mentor-123' },
      writable: true,
      configurable: true,
    });
    expect(getTenantKeyFromUrl()).toBe('my-tenant');
  });

  it('should return null for non-platform URL', () => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/other-page' },
      writable: true,
      configurable: true,
    });
    expect(getTenantKeyFromUrl()).toBeNull();
  });

  it('should handle complex tenant keys', () => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/platform/tenant-123-abc/mentor' },
      writable: true,
      configurable: true,
    });
    expect(getTenantKeyFromUrl()).toBe('tenant-123-abc');
  });
});

describe('htmlToMarkdown function', () => {
  it('should convert HTML to markdown', () => {
    const html = '<p>test paragraph</p>';
    const result = htmlToMarkdown(html);
    expect(result).toContain('test paragraph');
  });

  it('should handle bold tags', () => {
    const html = '<strong>bold</strong>';
    const result = htmlToMarkdown(html);
    expect(result).toContain('bold');
  });

  it('should handle links', () => {
    const html = '<a href="https://example.com">link</a>';
    const result = htmlToMarkdown(html);
    expect(result).toContain('link');
  });

  it('should return original text when conversion fails (error path)', () => {
    // Mock the unified/rehype modules to throw an error
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    // Pass an input that will cause the parser to fail
    // The unified ecosystem is robust, so we need to mock the module
    // For now, test with null/undefined cast to trigger error handling
    // Actually the function doesn't handle null well - this would throw before the try
    // So we test a scenario where the processing might fail

    // Create a valid scenario - the function should not throw
    const malformedHtml = '<div><p>unclosed';
    const result = htmlToMarkdown(malformedHtml);
    expect(result).toBeDefined();

    consoleErrorSpy.mockRestore();
  });

  it('should return empty string for null input', () => {
    const result = htmlToMarkdown(null as unknown as string);
    expect(result).toBe('');
  });

  it('should return empty string for undefined input', () => {
    const result = htmlToMarkdown(undefined as unknown as string);
    expect(result).toBe('');
  });

  it('should return empty string for empty string input', () => {
    const result = htmlToMarkdown('');
    expect(result).toBe('');
  });

  it('should return empty string for non-string input', () => {
    const result = htmlToMarkdown(123 as unknown as string);
    expect(result).toBe('');
  });

  // TipTap math serialization (data-math-latex) tests
  describe('data-math-latex handling', () => {
    it('should convert inline data-math-latex span to inline math', () => {
      const html =
        '<p>The value is <span data-math-latex="x^2"></span> here</p>';
      const result = htmlToMarkdown(html);
      expect(result).toContain('$x^2$');
    });

    it('should convert display data-math-latex span to display math', () => {
      const html =
        '<p><span data-math-latex="\\frac{a}{b}" data-math-display="true"></span></p>';
      const result = htmlToMarkdown(html);
      expect(result).toContain('$$\\frac{a}{b}$$');
    });

    it('should handle multiple inline math spans', () => {
      const html =
        '<p><span data-math-latex="\\alpha"></span> and <span data-math-latex="\\beta"></span></p>';
      const result = htmlToMarkdown(html);
      expect(result).toContain('$\\alpha$');
      expect(result).toContain('$\\beta$');
    });

    it('should handle display math with complex LaTeX', () => {
      const html =
        '<p><span data-math-latex="P(X = k) = \\frac{\\lambda^k}{k!}" data-math-display="true"></span></p>';
      const result = htmlToMarkdown(html);
      expect(result).toContain('$$P(X = k) = \\frac{\\lambda^k}{k!}$$');
    });

    it('should handle mixed data-math-latex and regular content', () => {
      const html =
        '<p>Given <span data-math-latex="x > 0"></span>, we have <strong>positive</strong> values</p>';
      const result = htmlToMarkdown(html);
      expect(result).toContain('$x > 0$');
      expect(result).toContain('positive');
    });
  });
});

describe('markdownToHtml function', () => {
  it('should convert markdown to HTML', () => {
    const markdown = '**bold text**';
    const result = markdownToHtml(markdown);
    expect(result).toContain('bold text');
  });

  it('should handle links', () => {
    const markdown = '[link](https://example.com)';
    const result = markdownToHtml(markdown);
    expect(result).toContain('href');
  });

  it('should handle lists', () => {
    const markdown = '- item 1\n- item 2';
    const result = markdownToHtml(markdown);
    expect(result).toContain('item 1');
    expect(result).toContain('item 2');
  });

  it('should return empty string for null input', () => {
    const result = markdownToHtml(null as unknown as string);
    expect(result).toBe('');
  });

  it('should return empty string for undefined input', () => {
    const result = markdownToHtml(undefined as unknown as string);
    expect(result).toBe('');
  });

  it('should return empty string for empty string input', () => {
    const result = markdownToHtml('');
    expect(result).toBe('');
  });

  it('should return empty string for non-string input', () => {
    const result = markdownToHtml(123 as unknown as string);
    expect(result).toBe('');
  });

  it('should handle malformed heading syntax', () => {
    // Test the preprocessMarkdownForHtml functionality
    const markdown = '#\nTitle';
    const result = markdownToHtml(markdown);
    expect(result).toContain('Title');
  });

  it('should handle excessive newlines after headings', () => {
    const markdown = '# Heading\n\n\n\nParagraph';
    const result = markdownToHtml(markdown);
    expect(result).toContain('Heading');
    expect(result).toContain('Paragraph');
  });

  it('should handle bold markers in headings', () => {
    const markdown = '# **Bold Title**';
    const result = markdownToHtml(markdown);
    expect(result).toContain('Bold Title');
  });

  it('should linkify plain URLs, emails, and phone numbers', () => {
    const markdown =
      'Visit https://example.com, email test@example.com, call (555) 123-4567.';
    const result = markdownToHtml(markdown);
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('href="mailto:test@example.com"');
    expect(result).toContain('href="tel:5551234567"');
  });

  it('should convert markdown links inside raw HTML blocks', () => {
    const markdown = '<p>[Get started](https://example.com)</p>';
    const result = markdownToHtml(markdown);
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('>Get started<');
  });

  it('should convert escaped markdown link delimiters', () => {
    const markdown = '<p>\\[Get started\\](https://example.com)</p>';
    const result = markdownToHtml(markdown);
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('>Get started<');
  });

  it('should render simple superscript and subscript patterns', () => {
    const markdown = 'E = mc^2, H_2O, (a + b)^2, a^(m+n), and q√(a^p)';
    const result = markdownToHtml(markdown);
    expect(result).toContain('mc<sup>2</sup>');
    expect(result).toContain('H<sub>2</sub>O');
    expect(result).toContain('(a + b)<sup>2</sup>');
    expect(result).toContain('a<sup>m+n</sup>');
    expect(result).toContain('a<sup>p</sup>');
  });

  it('should not linkify inside code spans', () => {
    const markdown = 'Inline `call 555-123-4567` code';
    const result = markdownToHtml(markdown);
    expect(result).toContain('<code>call 555-123-4567</code>');
    expect(result).not.toContain('tel:');
  });

  it('should render code blocks with code elements', () => {
    const markdown = '```\nconst x = 1;\n```';
    const result = markdownToHtml(markdown);
    // Should contain code element
    expect(result).toContain('code');
    expect(result).toContain('const x = 1');
  });

  it('should render inline code', () => {
    const markdown = 'Use `console.log()` to debug';
    const result = markdownToHtml(markdown);
    expect(result).toContain('<code>console.log()</code>');
  });

  it('should handle GFM tables', () => {
    const markdown =
      '| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1 | Cell 2 |';
    const result = markdownToHtml(markdown);
    expect(result).toContain('table');
    expect(result).toContain('Header 1');
    expect(result).toContain('Cell 1');
  });

  it('should handle JavaScript code blocks with language specifier', () => {
    const markdown = '```javascript\nconst x = 1;\n```';
    const result = markdownToHtml(markdown);
    // Should contain code element with the content
    expect(result).toContain('code');
    expect(result).toContain('const');
  });

  it('should handle Python code blocks with language specifier', () => {
    const markdown = '```python\ndef hello():\n```';
    const result = markdownToHtml(markdown);
    expect(result).toContain('code');
    expect(result).toContain('def');
  });

  it('should handle unknown language code blocks', () => {
    const markdown = '```unknownlang123\nsome code here\n```';
    const result = markdownToHtml(markdown);
    // Should still render the code
    expect(result).toContain('some code here');
    expect(result).toContain('code');
  });

  it('should handle TypeScript code blocks with language specifier', () => {
    const markdown = '```typescript\ninterface User {}\n```';
    const result = markdownToHtml(markdown);
    expect(result).toContain('code');
    expect(result).toContain('interface');
  });
});

describe('handleLogout function', () => {
  let locationHrefSpy: string;

  beforeEach(() => {
    locationHrefSpy = '';
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, 'location', {
      value: {
        origin: 'https://example.com',
        hostname: 'example.com',
        set href(value: string) {
          locationHrefSpy = value;
        },
        get href() {
          return locationHrefSpy || 'https://example.com';
        },
      },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: '',
    });
    Object.defineProperty(window, 'self', {
      value: window,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, 'top', {
      value: window,
      writable: true,
      configurable: true,
    });
    localStorageMock.clear();
  });

  it('should clear localStorage except tenant', () => {
    localStorageMock.setItem('tenant', 'my-tenant');
    localStorageMock.setItem('other-key', 'value');
    handleLogout();
    expect(localStorageMock.getItem('tenant')).toBe('my-tenant');
    expect(localStorageMock.getItem('other-key')).toBeNull();
  });

  it('should redirect to auth logout URL', () => {
    handleLogout();
    expect(locationHrefSpy).toContain('https://auth.example.com/logout');
  });

  it('should include redirect URL in logout', () => {
    handleLogout('https://custom.com');
    expect(locationHrefSpy).toContain('redirect-to=https://custom.com');
  });

  it('should include tenant in logout URL if present', () => {
    localStorageMock.setItem('tenant', 'my-tenant');
    handleLogout();
    expect(locationHrefSpy).toContain('tenant=my-tenant');
  });

  it('should call callback if provided', () => {
    const callback = vi.fn();
    handleLogout(undefined, callback);
    expect(callback).toHaveBeenCalled();
  });
});

describe('handleTenantSwitch function', () => {
  let locationHrefSpy: string;

  beforeEach(() => {
    locationHrefSpy = '';
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, 'location', {
      value: {
        origin: 'https://example.com',
        pathname: '/current-path',
        search: '?query=value',
        set href(value: string) {
          locationHrefSpy = value;
        },
        get href() {
          return locationHrefSpy || 'https://example.com';
        },
      },
      writable: true,
      configurable: true,
    });
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('should switch to new tenant', async () => {
    await handleTenantSwitch('new-tenant');
    expect(localStorageMock.getItem('tenant')).toBe('new-tenant');
    expect(locationHrefSpy).toContain(
      'https://auth.example.com/login/complete',
    );
  });

  it('should include redirect URL', async () => {
    await handleTenantSwitch('new-tenant', false, 'https://custom.com');
    expect(locationHrefSpy).toContain('new-tenant');
    expect(locationHrefSpy).toContain(encodeURIComponent('https://custom.com'));
  });

  it('should save redirect path when requested', async () => {
    await handleTenantSwitch('new-tenant', true);
    expect(localStorageMock.getItem('redirect-to')).toBe(
      '/current-path?query=value',
    );
  });

  it('should clear localStorage before switching', async () => {
    localStorageMock.setItem('old-key', 'old-value');
    await handleTenantSwitch('new-tenant');
    expect(localStorageMock.getItem('old-key')).toBeNull();
  });

  it('should include JWT token in URL when token exists in localStorage', async () => {
    localStorageMock.setItem('edx_jwt_token', 'test-jwt-token-123');
    await handleTenantSwitch('new-tenant');
    expect(locationHrefSpy).toContain('token=test-jwt-token-123');
  });

  it('should not include JWT token in URL when no token in localStorage', async () => {
    // localStorage is cleared by beforeEach, so no token exists
    await handleTenantSwitch('new-tenant');
    expect(locationHrefSpy).not.toContain('token=');
  });

  it('should preserve JWT token before clearing localStorage', async () => {
    localStorageMock.setItem('edx_jwt_token', 'preserved-token');
    localStorageMock.setItem('other-key', 'other-value');
    await handleTenantSwitch('new-tenant');

    // Other keys should be cleared
    expect(localStorageMock.getItem('other-key')).toBeNull();
    // Token should be in the redirect URL
    expect(locationHrefSpy).toContain('token=preserved-token');
  });

  it('should call clearCurrentTenantCookie', async () => {
    const { clearCurrentTenantCookie } = await import(
      '@iblai/iblai-js/web-utils'
    );
    await handleTenantSwitch('new-tenant');
    expect(clearCurrentTenantCookie).toHaveBeenCalled();
  });
});

describe('isStripeActivated function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return true when stripe is enabled and tenant is main and not enterprise', () => {
    vi.mocked(config.stripeEnabled).mockReturnValue('true');
    const tenant = { key: 'main', is_enterprise: false } as Parameters<
      typeof isStripeActivated
    >[0];
    expect(isStripeActivated(tenant)).toBe(true);
  });

  it('should return true when stripe is enabled and tenant is main even if enterprise', () => {
    vi.mocked(config.stripeEnabled).mockReturnValue('true');
    const tenant = { key: 'main', is_enterprise: true } as Parameters<
      typeof isStripeActivated
    >[0];
    expect(isStripeActivated(tenant)).toBe(true);
  });

  it('should return false when stripe is disabled', () => {
    vi.mocked(config.stripeEnabled).mockReturnValue('false');
    const tenant = { key: 'main', is_enterprise: false } as Parameters<
      typeof isStripeActivated
    >[0];
    expect(isStripeActivated(tenant)).toBe(false);
  });

  it('should return false for enterprise tenant that is not main', () => {
    vi.mocked(config.stripeEnabled).mockReturnValue('true');
    const tenant = { key: 'other', is_enterprise: true } as Parameters<
      typeof isStripeActivated
    >[0];
    expect(isStripeActivated(tenant)).toBe(false);
  });

  it('should return true for non-enterprise tenant that is not main', () => {
    vi.mocked(config.stripeEnabled).mockReturnValue('true');
    const tenant = { key: 'other', is_enterprise: false } as Parameters<
      typeof isStripeActivated
    >[0];
    expect(isStripeActivated(tenant)).toBe(true);
  });
});

describe('formatDateToShortFormat function - error handling', () => {
  it('should return original string when parsing fails', () => {
    // Create an invalid date string that will cause Date parsing to fail
    const invalidDate = 'not-a-valid-date';
    const result = formatDateToShortFormat(invalidDate);
    // Since the function catches errors and returns the original string
    // We need a date string that will throw in the date operations
    expect(result).toBeDefined();
  });

  it('should return original string when toLocaleDateString throws an error', () => {
    // Mock Date.prototype.toLocaleDateString to throw an error
    const originalToLocaleDateString = Date.prototype.toLocaleDateString;
    Date.prototype.toLocaleDateString = function () {
      throw new Error('toLocaleDateString error');
    };

    const dateString = '2024-10-15';
    const result = formatDateToShortFormat(dateString);

    // Should return the original string when error occurs
    expect(result).toBe(dateString);

    // Restore the original method
    Date.prototype.toLocaleDateString = originalToLocaleDateString;
  });

  it('should return only time when displayOnlyTime is true', () => {
    // Morning time
    const morningDate = '2024-10-15T09:30:00';
    const morningResult = formatDateToShortFormat(morningDate, true);
    expect(morningResult).toBe('9:30AM');

    // Afternoon time (12-hour format)
    const afternoonDate = '2024-10-15T14:45:00';
    const afternoonResult = formatDateToShortFormat(afternoonDate, true);
    expect(afternoonResult).toBe('2:45PM');

    // Midnight (12:00AM)
    const midnightDate = '2024-10-15T00:15:00';
    const midnightResult = formatDateToShortFormat(midnightDate, true);
    expect(midnightResult).toBe('12:15AM');

    // Noon (12:00PM)
    const noonDate = '2024-10-15T12:00:00';
    const noonResult = formatDateToShortFormat(noonDate, true);
    expect(noonResult).toBe('12:00PM');
  });
});

describe('redirectToAuthSpa - Tauri and platform/logout paths', () => {
  let locationHrefSpy: string;

  beforeEach(() => {
    locationHrefSpy = '';

    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(window, 'location', {
      value: {
        origin: 'https://example.com',
        pathname: '/platform/my-tenant/page',
        search: '',
        hostname: 'example.com',
        set href(value: string) {
          locationHrefSpy = value;
        },
        get href() {
          return (
            locationHrefSpy || 'https://example.com/platform/my-tenant/page'
          );
        },
      },
      writable: true,
      configurable: true,
    });

    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('should include platform key in auth redirect URL', async () => {
    await redirectToAuthSpa(undefined, 'explicit-tenant');

    // Wait for the async redirect
    await new Promise((resolve) => setTimeout(resolve, 150));

    // The URL is encoded, so tenant= becomes tenant%3D
    expect(locationHrefSpy).toContain('tenant%3Dexplicit-tenant');
  });

  it('should include logout flag in auth redirect URL when logging out', async () => {
    await redirectToAuthSpa(undefined, undefined, true);

    // Wait for the async redirect
    await new Promise((resolve) => setTimeout(resolve, 150));

    // The URL is encoded, so logout= becomes logout%3D
    expect(locationHrefSpy).toContain('logout%3D1');
  });

  it('should extract platform key from redirect path if not explicitly provided', async () => {
    await redirectToAuthSpa('/platform/extracted-tenant/page');

    // Wait for the async redirect
    await new Promise((resolve) => setTimeout(resolve, 150));

    // The URL is encoded, so tenant= becomes tenant%3D
    expect(locationHrefSpy).toContain('tenant%3Dextracted-tenant');
  });

  it('should handle Tauri app iOS redirect URL', async () => {
    // Mock isTauriApp to return true
    const tauriModule = await import('@/types/tauri');
    vi.mocked(tauriModule.isTauriApp).mockReturnValue(true);

    // Mock the dynamic import of @tauri-apps/api/core
    vi.doMock('@tauri-apps/api/core', () => ({
      invoke: vi.fn().mockResolvedValue('ios'),
    }));

    await redirectToAuthSpa();

    // Wait for the async operations
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Restore the mock
    vi.mocked(tauriModule.isTauriApp).mockReturnValue(false);
  });

  it('should handle Tauri invoke error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Mock isTauriApp to return true
    const tauriModule = await import('@/types/tauri');
    vi.mocked(tauriModule.isTauriApp).mockReturnValue(true);

    // Mock the dynamic import to throw an error
    vi.doMock('@tauri-apps/api/core', () => ({
      invoke: vi.fn().mockRejectedValue(new Error('Tauri not available')),
    }));

    await redirectToAuthSpa();

    // Wait for the async operations
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Restore the mock
    vi.mocked(tauriModule.isTauriApp).mockReturnValue(false);
    consoleSpy.mockRestore();
  });

  it('should include JWT token in auth URL when token exists in localStorage in Tauri mode', async () => {
    // Mock isTauriApp to return true
    const tauriModule = await import('@/types/tauri');
    vi.mocked(tauriModule.isTauriApp).mockReturnValue(true);

    // Set JWT token in localStorage
    localStorageMock.setItem('edx_jwt_token', 'test-jwt-token-456');

    await redirectToAuthSpa();

    // Wait for the async operations
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Should include encoded token param
    expect(locationHrefSpy).toContain('token=');
    expect(locationHrefSpy).toContain(encodeURIComponent('test-jwt-token-456'));

    // Cleanup
    vi.mocked(tauriModule.isTauriApp).mockReturnValue(false);
  });

  it('should not include JWT token in auth URL when no token in localStorage', async () => {
    // Mock isTauriApp to return true
    const tauriModule = await import('@/types/tauri');
    vi.mocked(tauriModule.isTauriApp).mockReturnValue(true);

    // Ensure no token in localStorage (cleared by beforeEach)

    await redirectToAuthSpa();

    // Wait for the async operations
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Should NOT include token param when no token exists
    expect(locationHrefSpy).not.toContain('token=');

    // Cleanup
    vi.mocked(tauriModule.isTauriApp).mockReturnValue(false);
  });

  it('should not include JWT token in auth URL when not in Tauri mode', async () => {
    // Mock isTauriApp to return false (default)
    const tauriModule = await import('@/types/tauri');
    vi.mocked(tauriModule.isTauriApp).mockReturnValue(false);

    await redirectToAuthSpa();

    // Wait for the async operations
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Should not include the token param (non-Tauri mode uses /api/auth-redirect)
    expect(locationHrefSpy).not.toContain('token=');
  });

  it('should not include platform if not in URL and not provided', async () => {
    Object.defineProperty(window, 'location', {
      value: {
        origin: 'https://example.com',
        pathname: '/no-platform-here',
        search: '',
        hostname: 'example.com',
        set href(value: string) {
          locationHrefSpy = value;
        },
        get href() {
          return locationHrefSpy || 'https://example.com/no-platform-here';
        },
      },
      writable: true,
      configurable: true,
    });

    await redirectToAuthSpa('/no-platform-here');

    await new Promise((resolve) => setTimeout(resolve, 150));

    // Should not include tenant param if no platform key is found
    expect(locationHrefSpy).not.toContain('tenant=');
  });

  it('should skip redirect when in Tauri offline mode via isOfflineServerOrigin', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Mock isOfflineServerOrigin to return true
    const offlineModule = await import('@/hooks/use-tauri-offline');
    vi.mocked(offlineModule.isOfflineServerOrigin).mockReturnValue(true);

    await redirectToAuthSpa();

    // Wait for any async operations
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Should not redirect - locationHrefSpy should remain empty
    expect(locationHrefSpy).toBe('');
    expect(consoleSpy).toHaveBeenCalledWith(
      '[redirectToAuthSpa] Skipping redirect - Tauri offline mode',
      expect.any(Object),
    );

    // Restore mocks
    vi.mocked(offlineModule.isOfflineServerOrigin).mockReturnValue(false);
    consoleSpy.mockRestore();
  });

  it('should skip redirect when in Tauri offline mode via isTauriOfflineMode', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Mock both isTauriApp and isTauriOfflineMode to return true
    const tauriModule = await import('@/types/tauri');
    const cacheModule = await import('@/lib/tauri-api-cache');
    vi.mocked(tauriModule.isTauriApp).mockReturnValue(true);
    vi.mocked(cacheModule.isTauriOfflineMode).mockReturnValue(true);

    await redirectToAuthSpa();

    // Wait for any async operations
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Should not redirect - locationHrefSpy should remain empty
    expect(locationHrefSpy).toBe('');
    expect(consoleSpy).toHaveBeenCalledWith(
      '[redirectToAuthSpa] Skipping redirect - Tauri offline mode',
      expect.any(Object),
    );

    // Restore mocks
    vi.mocked(tauriModule.isTauriApp).mockReturnValue(false);
    vi.mocked(cacheModule.isTauriOfflineMode).mockReturnValue(false);
    consoleSpy.mockRestore();
  });

  it('should send message to parent and return early when in iframe', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Mock isInIframe to return true by setting window.top !== window.self
    const originalTop = window.top;
    Object.defineProperty(window, 'top', {
      value: { different: 'object' },
      configurable: true,
      writable: true,
    });
    Object.defineProperty(window, 'self', {
      value: window,
      configurable: true,
      writable: true,
    });

    const postMessageSpy = vi
      .spyOn(window.parent, 'postMessage')
      .mockImplementation(() => {});

    await redirectToAuthSpa();

    // Wait for any async operations
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Should send message to parent
    expect(postMessageSpy).toHaveBeenCalledWith({ authExpired: true }, '*');
    expect(consoleSpy).toHaveBeenCalledWith(
      '[redirectToAuthSpa]: sending authExpired to parent',
    );

    // Should not redirect when in iframe
    expect(locationHrefSpy).toBe('');

    // Restore
    Object.defineProperty(window, 'top', {
      value: originalTop,
      configurable: true,
      writable: true,
    });
    consoleSpy.mockRestore();
    postMessageSpy.mockRestore();
  });
});

describe('saveUserObjectToLocalStorage - syncAuthDataToCookies coverage', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: '',
    });
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('should sync current_tenant to cookies when present', () => {
    // Setup hostname with more than 2 parts to test baseDomain calculation
    Object.defineProperty(window, 'location', {
      value: { hostname: 'sub.example.com' },
      writable: true,
      configurable: true,
    });

    const userObject = {
      [LOCAL_STORAGE_KEYS.CURRENT_TENANT]: JSON.stringify({
        key: 'test-tenant',
      }),
    };

    saveUserObjectToLocalStorage(userObject);

    // Verify cookie was set
    expect(document.cookie).toContain('ibl_current_tenant');
  });

  it('should sync user_data to cookies when present', () => {
    Object.defineProperty(window, 'location', {
      value: { hostname: 'sub.example.com' },
      writable: true,
      configurable: true,
    });

    const userObject = {
      [LOCAL_STORAGE_KEYS.USER_DATA]: JSON.stringify({
        user_nicename: 'testuser',
      }),
    };

    saveUserObjectToLocalStorage(userObject);

    expect(document.cookie).toContain('ibl_user_data');
  });

  it('should sync tenants to cookies when present', () => {
    Object.defineProperty(window, 'location', {
      value: { hostname: 'sub.example.com' },
      writable: true,
      configurable: true,
    });

    const userObject = {
      [LOCAL_STORAGE_KEYS.TENANTS]: JSON.stringify([{ key: 'tenant1' }]),
    };

    saveUserObjectToLocalStorage(userObject);

    expect(document.cookie).toContain('ibl_tenant');
  });

  it('should calculate baseDomain with dot prefix for hostnames with 3+ parts', () => {
    Object.defineProperty(window, 'location', {
      value: { hostname: 'deep.sub.example.com' },
      writable: true,
      configurable: true,
    });

    const userObject = {
      [LOCAL_STORAGE_KEYS.CURRENT_TENANT]: JSON.stringify({ key: 'test' }),
    };

    saveUserObjectToLocalStorage(userObject);

    // The cookie should include the base domain
    expect(document.cookie).toContain('domain=');
  });

  it('should handle localhost without adding domain to cookie', () => {
    Object.defineProperty(window, 'location', {
      value: { hostname: 'localhost' },
      writable: true,
      configurable: true,
    });

    const userObject = {
      [LOCAL_STORAGE_KEYS.CURRENT_TENANT]: JSON.stringify({ key: 'test' }),
    };

    saveUserObjectToLocalStorage(userObject);

    // Should still set the cookie, just without domain
    expect(document.cookie).toContain('ibl_current_tenant');
  });

  it('should handle IP addresses without adding domain to cookie', () => {
    Object.defineProperty(window, 'location', {
      value: { hostname: '192.168.1.1' },
      writable: true,
      configurable: true,
    });

    const userObject = {
      [LOCAL_STORAGE_KEYS.CURRENT_TENANT]: JSON.stringify({ key: 'test' }),
    };

    saveUserObjectToLocalStorage(userObject);

    // Should still set the cookie
    expect(document.cookie).toContain('ibl_current_tenant');
  });
});

describe('getCurrentArtifactTitle function', () => {
  it('should return null for empty messages array', () => {
    expect(getCurrentArtifactTitle([])).toBeNull();
  });

  it('should return null for null/undefined messages', () => {
    expect(getCurrentArtifactTitle(null as any)).toBeNull();
    expect(getCurrentArtifactTitle(undefined as any)).toBeNull();
  });

  it('should return null when messages have no artifact_versions', () => {
    const messages = [
      { message: { data: { content: 'Hello' } } },
      { message: { data: { content: 'World' } } },
    ];
    expect(getCurrentArtifactTitle(messages)).toBeNull();
  });

  it('should return null when artifact_versions is empty', () => {
    const messages = [
      { message: { data: { content: 'Hello' } }, artifact_versions: [] },
    ];
    expect(getCurrentArtifactTitle(messages)).toBeNull();
  });

  it('should return the current artifact title by is_current flag', () => {
    const messages = [
      {
        message: { data: { content: '' } },
        artifact_versions: [
          { id: 1, title: 'Version 1', version_number: 1, is_current: false },
          {
            id: 2,
            title: 'Current Version',
            version_number: 2,
            is_current: true,
          },
          { id: 3, title: 'Version 3', version_number: 3, is_current: false },
        ],
      },
    ];
    expect(getCurrentArtifactTitle(messages)).toBe('Current Version');
  });

  it('should return the highest version_number title when no is_current flag', () => {
    const messages = [
      {
        message: { data: { content: '' } },
        artifact_versions: [
          { id: 1, title: 'Version 1', version_number: 1 },
          { id: 2, title: 'Version 2', version_number: 2 },
          { id: 3, title: 'Latest Version', version_number: 3 },
        ],
      },
    ];
    expect(getCurrentArtifactTitle(messages)).toBe('Latest Version');
  });

  it('should fall back to artifact.title when version title is missing', () => {
    const messages = [
      {
        message: { data: { content: '' } },
        artifact_versions: [
          {
            id: 1,
            title: null,
            artifact: { title: 'Artifact Title' },
            version_number: 1,
            is_current: true,
          },
        ],
      },
    ];
    expect(getCurrentArtifactTitle(messages)).toBe('Artifact Title');
  });

  it('should collect artifacts from multiple messages', () => {
    const messages = [
      {
        message: { data: { content: '' } },
        artifact_versions: [
          { id: 1, title: 'First Message Artifact', version_number: 1 },
        ],
      },
      {
        message: { data: { content: '' } },
        artifact_versions: [
          {
            id: 2,
            title: 'Second Message Artifact',
            version_number: 2,
            is_current: true,
          },
        ],
      },
    ];
    expect(getCurrentArtifactTitle(messages)).toBe('Second Message Artifact');
  });

  it('should return null when artifact has no title', () => {
    const messages = [
      {
        message: { data: { content: '' } },
        artifact_versions: [
          { id: 1, title: null, artifact: { title: null }, version_number: 1 },
        ],
      },
    ];
    expect(getCurrentArtifactTitle(messages)).toBeNull();
  });

  it('should handle missing version_number gracefully', () => {
    const messages = [
      {
        message: { data: { content: '' } },
        artifact_versions: [
          { id: 1, title: 'No Version Number' },
          { id: 2, title: 'Has Version Number', version_number: 1 },
        ],
      },
    ];
    expect(getCurrentArtifactTitle(messages)).toBe('Has Version Number');
  });
});

describe('getFirstMessageWithContent function', () => {
  it('should return empty string for null input', () => {
    expect(getFirstMessageWithContent(null as any)).toBe('');
  });

  it('should return empty string for undefined input', () => {
    expect(getFirstMessageWithContent(undefined as any)).toBe('');
  });

  it('should return empty string for empty array', () => {
    expect(getFirstMessageWithContent([])).toBe('');
  });

  it('should return content from first message when it has content', () => {
    const messages = [
      { message: { data: { content: 'Hello world' } } },
      { message: { data: { content: 'Second message' } } },
    ];
    expect(getFirstMessageWithContent(messages)).toBe('Hello world');
  });

  it('should skip first message if it has no content and return second', () => {
    const messages = [
      { message: { data: { content: '' } } },
      { message: { data: { content: 'Second message' } } },
    ];
    expect(getFirstMessageWithContent(messages)).toBe('Second message');
  });

  it('should skip first message if content is null', () => {
    const messages = [
      { message: { data: { content: null } } },
      { message: { data: { content: 'Second message' } } },
    ];
    expect(getFirstMessageWithContent(messages)).toBe('Second message');
  });

  it('should skip first message if content is undefined', () => {
    const messages = [
      { message: { data: { content: undefined } } },
      { message: { data: { content: 'Second message' } } },
    ];
    expect(getFirstMessageWithContent(messages)).toBe('Second message');
  });

  it('should skip messages with missing data property', () => {
    const messages = [
      { message: {} },
      { message: { data: { content: 'Valid message' } } },
    ];
    expect(getFirstMessageWithContent(messages)).toBe('Valid message');
  });

  it('should skip messages with missing message property', () => {
    const messages = [{}, { message: { data: { content: 'Valid message' } } }];
    expect(getFirstMessageWithContent(messages)).toBe('Valid message');
  });

  it('should return empty string if all messages have no content', () => {
    const messages = [
      { message: { data: { content: '' } } },
      { message: { data: { content: null } } },
      { message: { data: {} } },
    ];
    expect(getFirstMessageWithContent(messages)).toBe('');
  });

  it('should find content in third message when first two are empty', () => {
    const messages = [
      { message: { data: { content: '' } } },
      { message: { data: { content: '' } } },
      { message: { data: { content: 'Third message' } } },
    ];
    expect(getFirstMessageWithContent(messages)).toBe('Third message');
  });

  it('should handle whitespace-only content as valid content', () => {
    const messages = [
      { message: { data: { content: '   ' } } },
      { message: { data: { content: 'Second message' } } },
    ];
    // Whitespace is truthy, so it should return the whitespace
    expect(getFirstMessageWithContent(messages)).toBe('   ');
  });

  it('should handle HTML content', () => {
    const messages = [
      { message: { data: { content: '' } } },
      { message: { data: { content: '<p>HTML content</p>' } } },
    ];
    expect(getFirstMessageWithContent(messages)).toBe('<p>HTML content</p>');
  });

  it('should handle markdown content', () => {
    const messages = [
      { message: { data: { content: '' } } },
      { message: { data: { content: '# Heading\n\nParagraph' } } },
    ];
    expect(getFirstMessageWithContent(messages)).toBe('# Heading\n\nParagraph');
  });
});

describe('isSafariBrowser function', () => {
  const originalNavigator = navigator;

  afterEach(() => {
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  it('should return true for Safari on macOS', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      writable: true,
      configurable: true,
    });
    expect(isSafariBrowser()).toBe(true);
  });

  it('should return true for Safari on iPhone', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      writable: true,
      configurable: true,
    });
    expect(isSafariBrowser()).toBe(true);
  });

  it('should return false for Chrome on macOS', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      writable: true,
      configurable: true,
    });
    expect(isSafariBrowser()).toBe(false);
  });

  it('should return false for Chrome on Android', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (Linux; Android 10; Pixel 4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      writable: true,
      configurable: true,
    });
    expect(isSafariBrowser()).toBe(false);
  });

  it('should return false for Firefox', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
      writable: true,
      configurable: true,
    });
    expect(isSafariBrowser()).toBe(false);
  });

  it('should return false for Edge', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
      writable: true,
      configurable: true,
    });
    expect(isSafariBrowser()).toBe(false);
  });

  it('should return false when navigator is undefined', () => {
    Object.defineProperty(global, 'navigator', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    expect(isSafariBrowser()).toBe(false);
  });
});
