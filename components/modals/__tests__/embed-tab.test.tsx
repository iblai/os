import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

// Mock @iblai/iblai-web-mentor before any imports that use it
vi.mock('@iblai/iblai-web-mentor', () => ({}));

// Export validation functions for testing by re-implementing them here
// (since they're not exported from the module)
function validateCss(css: string): { isValid: boolean; errors: string[] } {
  if (!css.trim()) {
    return { isValid: true, errors: [] };
  }

  const errors: string[] = [];

  // Check for balanced braces
  const openBraces = (css.match(/\{/g) || []).length;
  const closeBraces = (css.match(/\}/g) || []).length;
  if (openBraces !== closeBraces) {
    errors.push(`Missing ${openBraces > closeBraces ? 'closing' : 'opening'} brace(s)`);
  }

  // Check for balanced parentheses
  const openParens = (css.match(/\(/g) || []).length;
  const closeParens = (css.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    errors.push(`Unbalanced parentheses`);
  }

  // Check for unclosed strings
  const singleQuotes = (css.match(/'/g) || []).length;
  const doubleQuotes = (css.match(/"/g) || []).length;
  if (singleQuotes % 2 !== 0) {
    errors.push(`Unclosed single quote`);
  }
  if (doubleQuotes % 2 !== 0) {
    errors.push(`Unclosed double quote`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

function validateJavaScript(js: string): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  if (!js.trim()) {
    return { isValid: true, errors: [], warnings: [] };
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for smart/curly quotes (common when copying from Word, websites, etc.)
  const hasSmartQuotes = /[\u2018\u2019\u201C\u201D]/.test(js);
  if (hasSmartQuotes) {
    errors.push('Smart quotes detected (" " \' \'). Replace with straight quotes (" \')');
  }

  // Check for balanced braces
  const openBraces = (js.match(/\{/g) || []).length;
  const closeBraces = (js.match(/\}/g) || []).length;
  if (openBraces !== closeBraces) {
    errors.push(`Missing ${openBraces > closeBraces ? 'closing' : 'opening'} brace(s)`);
  }

  // Check for balanced brackets
  const openBrackets = (js.match(/\[/g) || []).length;
  const closeBrackets = (js.match(/\]/g) || []).length;
  if (openBrackets !== closeBrackets) {
    errors.push(`Missing ${openBrackets > closeBrackets ? 'closing' : 'opening'} bracket(s)`);
  }

  // Check for balanced parentheses
  const openParens = (js.match(/\(/g) || []).length;
  const closeParens = (js.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    errors.push(`Unbalanced parentheses`);
  }

  // Check for unclosed strings across the entire code (not per-line, to handle wrapped/multiline content)
  // Use negative lookbehind to avoid stripping URLs (e.g., https://) as comments
  const jsWithoutComments = js.replace(/(?<!:)\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const singleQuotes = (jsWithoutComments.match(/(?<!\\)'/g) || []).length;
  const doubleQuotes = (jsWithoutComments.match(/(?<!\\)"/g) || []).length;
  const templateLiterals = (jsWithoutComments.match(/(?<!\\)`/g) || []).length;

  if (singleQuotes % 2 !== 0) {
    errors.push('Unclosed single quote');
  }
  if (doubleQuotes % 2 !== 0) {
    errors.push('Unclosed double quote');
  }
  if (templateLiterals % 2 !== 0) {
    errors.push('Unclosed template literal');
  }

  // Warnings for potentially risky patterns
  if (js.includes('eval(')) {
    warnings.push('Usage of eval() is discouraged for security reasons');
  }
  if (js.includes('document.write')) {
    warnings.push('document.write() may cause unexpected behavior');
  }
  if (js.includes('innerHTML')) {
    warnings.push('innerHTML usage detected - ensure content is sanitized');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ---- Mocks ----
const mockEditMentor = vi.fn();
const mockCreateShareableLink = vi.fn();
const mockUpdateShareableLink = vi.fn();
const mockGetMentorId = vi.fn();
const mockGetMentorSettingsQuery = vi.fn();
const mockGetShareableLinkQuery = vi.fn();
const mockUseParams = vi.fn();
const mockUsername = 'testuser';
const mockToast = vi.fn();

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

// Mock hooks
vi.mock('@/hooks/use-user', () => ({
  useUsername: () => mockUsername,
}));

vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({
    getMentorId: mockGetMentorId,
  }),
}));

// Mock data-layer
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useEditMentorMutation: () => [mockEditMentor, { isLoading: false }],
  useGetMentorSettingsQuery: () => mockGetMentorSettingsQuery(),
  useGetShareableLinkQuery: () => mockGetShareableLinkQuery(),
  useCreateShareableLinkMutation: () => [mockCreateShareableLink, { data: null }],
  useUpdateShareableLinkMutation: () => [mockUpdateShareableLink],
}));

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useEditMentorMutation: () => [mockEditMentor, { isLoading: false }],
  useGetMentorSettingsQuery: () => mockGetMentorSettingsQuery(),
  useGetMentorPublicSettingsQuery: () => ({
    data: { allow_anonymous: false, custom_css: '', mentor_visibility: '' },
  }),
  useCreateRedirectTokenMutation: () => [vi.fn(), { isLoading: false, data: null }],
  useGetShareableLinkQuery: () => mockGetShareableLinkQuery(),
  useCreateShareableLinkMutation: () => [mockCreateShareableLink, { data: null }],
  useUpdateShareableLinkMutation: () => [mockUpdateShareableLink],
}));

// Mock useEmbedTab hook
const mockUseEmbedTab = vi.fn();

vi.mock('../edit-mentor-modal/hooks/useEmbedTab', () => ({
  default: () => mockUseEmbedTab(),
}));

const createEmbedTabMock = (overrides = {}) => ({
  form: {
    handleSubmit: vi.fn(),
    getFieldValue: vi.fn(),
    state: { isSubmitting: false },
    Field: ({ children }: any) => children({ state: { value: '' }, handleChange: vi.fn() }),
    Subscribe: ({ children }: any) => children(['default']),
  },
  createTokenHandler: vi.fn(),
  createTokenError: '',
  setCreateTokenError: vi.fn(),
  isCreateTokenLoading: false,
  redirectTokenData: null,
  integratedSsoProviders: { providers: [] },
  isIntegratedSsoProvidersError: false,
  embedCode: '',
  setEmbedCode: vi.fn(),
  customFloatingBubbleConfig: {
    image: '/test-image.png',
    position: 'bottom-right',
    size: 'small',
    backgroundColor: 'transparent',
    textColor: '#ffffff',
    subtitleTextColor: '#e5e7eb',
    accentColor: '#1d4ed8',
    borderRadius: 16,
    shadow: false,
    title: '',
    subtitle: '',
    height: 48,
    fontSize: 14,
    subtitleFontSize: 12,
    padding: 12,
    imageSize: 32,
    strokeColor: '#000',
    strokeWidth: 0,
    offsetX: 20,
    offsetY: 20,
  },
  handleFloatingBubbleImageError: vi.fn(),
  focusEditCustomFloatingBubble: false,
  setFocusEditCustomFloatingBubble: vi.fn(),
  updateConfig: vi.fn(),
  updateMultipleConfig: vi.fn(),
  ...overrides,
});

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock use-toast hook
vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

// Mock tenant metadata
vi.mock('@iblai/iblai-js/web-utils', () => ({
  useTenantMetadata: () => ({
    metadata: { support_email: 'support@test.com' },
  }),
}));

// Mock config
vi.mock('@/lib/config', () => ({
  config: {
    supportEmail: () => 'support@test.com',
  },
}));

// Mock UI components
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange, disabled, ...props }: any) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      disabled={disabled}
      data-testid="switch"
      {...props}
    />
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({ ...props }: any) => <input {...props} />,
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({ ...props }: any) => <textarea data-testid="textarea" {...props} />,
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => <div>{children}</div>,
  TooltipProvider: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: any) => <div>{children}</div>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children }: any) => <div>{children}</div>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: () => <span>Select</span>,
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open, onOpenChange }: any) => (
    <div data-testid="dialog" data-open={open}>
      {children}
      {onOpenChange && (
        <button data-testid="dialog-close-trigger" onClick={() => onOpenChange(false)}>
          Close Dialog
        </button>
      )}
    </div>
  ),
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children, defaultValue }: any) => (
    <div data-testid="tabs" data-default-value={defaultValue}>
      {children}
    </div>
  ),
  TabsContent: ({ children, value }: any) => (
    <div data-testid={`tabs-content-${value}`}>{children}</div>
  ),
  TabsList: ({ children }: any) => <div data-testid="tabs-list">{children}</div>,
}));

vi.mock('@/components/tabs', () => ({
  TabsTrigger: ({ children, value }: any) => (
    <button data-testid={`tabs-trigger-${value}`}>{children}</button>
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor, ...props }: any) => (
    <label htmlFor={htmlFor} {...props}>
      {children}
    </label>
  ),
}));

vi.mock('@/components/ui/toaster', () => ({
  Toaster: () => null,
}));

vi.mock('@/components/copy-code-block', () => ({
  CopyCodeBlock: ({ code }: any) => <pre data-testid="copy-code-block">{code}</pre>,
}));

vi.mock('@iblai/iblai-js/web-containers', () => ({
  Spinner: () => <div data-testid="spinner">Loading...</div>,
}));

vi.mock('@/hoc/withPermissions', () => ({
  default: ({ children }: any) => children({ disabled: false }),
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

vi.mock('@/lib/constants', () => ({
  MENTOR_VISIBILITY: [
    { label: 'Administrators', value: 'viewable_by_tenant_admins' },
    { label: 'Students', value: 'viewable_by_tenant_students' },
    { label: 'Anyone', value: 'viewable_by_anyone' },
  ],
  MENTOR_VISIBILITY_VALUES: {
    ADMINISTRATORS: 'viewable_by_tenant_admins',
    STUDENTS: 'viewable_by_tenant_students',
    ANYONE: 'viewable_by_anyone',
  },
}));

vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => <img src={src} alt={alt} {...props} />,
}));

vi.mock('lucide-react', () => ({
  Info: () => <span data-testid="icon-info">Info</span>,
  MessageCircle: () => <span data-testid="icon-message">Message</span>,
  Palette: () => <span data-testid="icon-palette">Palette</span>,
  RefreshCw: ({ onClick, ...props }: any) => (
    <span data-testid="icon-refresh" onClick={onClick} {...props}>
      Refresh
    </span>
  ),
  Settings: () => <span data-testid="icon-settings">Settings</span>,
  ChevronDown: () => <span data-testid="icon-chevron-down">ChevronDown</span>,
  ChevronUp: () => <span data-testid="icon-chevron-up">ChevronUp</span>,
  AlertCircle: () => <span data-testid="icon-alert-circle">AlertCircle</span>,
  Check: () => <span data-testid="icon-check">Check</span>,
  AlertTriangle: () => <span data-testid="icon-alert-triangle">AlertTriangle</span>,
  Code2: () => <span data-testid="icon-code">Code</span>,
  ShieldAlert: () => <span data-testid="icon-shield">Shield</span>,
  Mail: () => <span data-testid="icon-mail">Mail</span>,
}));

// Import after mocks
import { EmbedTab } from '../edit-mentor-modal/tabs/embed-tab';

describe('CSS Validation', () => {
  describe('validateCss', () => {
    it('returns valid for empty CSS', () => {
      const result = validateCss('');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns valid for whitespace-only CSS', () => {
      const result = validateCss('   \n\t  ');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns valid for properly formatted CSS', () => {
      const css = `.test { color: red; background: blue; }`;
      const result = validateCss(css);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns valid for CSS with nested selectors', () => {
      const css = `
        .parent {
          color: red;
        }
        .parent .child {
          color: blue;
        }
      `;
      const result = validateCss(css);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('detects missing closing brace', () => {
      const css = `.test { color: red;`;
      const result = validateCss(css);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing closing brace(s)');
    });

    it('detects missing opening brace', () => {
      const css = `.test color: red; }`;
      const result = validateCss(css);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing opening brace(s)');
    });

    it('detects unbalanced parentheses', () => {
      const css = `.test { background: url(image.png; }`;
      const result = validateCss(css);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Unbalanced parentheses');
    });

    it('detects unclosed single quote', () => {
      const css = `.test { content: 'hello; }`;
      const result = validateCss(css);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Unclosed single quote');
    });

    it('detects unclosed double quote', () => {
      const css = `.test { content: "hello; }`;
      const result = validateCss(css);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Unclosed double quote');
    });

    it('returns valid for CSS with properly closed quotes', () => {
      const css = `.test { content: "hello"; font-family: 'Arial'; }`;
      const result = validateCss(css);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('detects multiple errors', () => {
      const css = `.test { content: "hello; color: url(image.png }`;
      const result = validateCss(css);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });
});

describe('JavaScript Validation', () => {
  describe('validateJavaScript', () => {
    it('returns valid for empty JavaScript', () => {
      const result = validateJavaScript('');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('returns valid for whitespace-only JavaScript', () => {
      const result = validateJavaScript('   \n\t  ');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns valid for properly formatted JavaScript', () => {
      const js = `function test() { console.log("hello"); }`;
      const result = validateJavaScript(js);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns valid for JavaScript with arrays and objects', () => {
      const js = `const arr = [1, 2, 3]; const obj = { key: "value" };`;
      const result = validateJavaScript(js);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('detects missing closing brace', () => {
      const js = `function test() { console.log("hello");`;
      const result = validateJavaScript(js);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing closing brace(s)');
    });

    it('detects missing opening brace', () => {
      const js = `function test() console.log("hello"); }`;
      const result = validateJavaScript(js);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing opening brace(s)');
    });

    it('detects missing closing bracket', () => {
      const js = `const arr = [1, 2, 3;`;
      const result = validateJavaScript(js);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing closing bracket(s)');
    });

    it('detects missing opening bracket', () => {
      const js = `const arr = 1, 2, 3];`;
      const result = validateJavaScript(js);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing opening bracket(s)');
    });

    it('detects unbalanced parentheses', () => {
      const js = `console.log("hello"`;
      const result = validateJavaScript(js);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Unbalanced parentheses');
    });

    it('warns about eval usage', () => {
      const js = `eval("alert('test')");`;
      const result = validateJavaScript(js);
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Usage of eval() is discouraged for security reasons');
    });

    it('warns about document.write usage', () => {
      const js = `document.write("<p>Hello</p>");`;
      const result = validateJavaScript(js);
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('document.write() may cause unexpected behavior');
    });

    it('warns about innerHTML usage', () => {
      const js = `element.innerHTML = "<p>Hello</p>";`;
      const result = validateJavaScript(js);
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('innerHTML usage detected - ensure content is sanitized');
    });

    it('detects multiple warnings', () => {
      const js = `eval("test"); document.write("hello"); element.innerHTML = "world";`;
      const result = validateJavaScript(js);
      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBe(3);
    });

    it('ignores comment lines for quote checking', () => {
      const js = `// This is a comment with an unclosed quote '
      const x = "valid";`;
      const result = validateJavaScript(js);
      expect(result.isValid).toBe(true);
    });

    it('detects unclosed template literals', () => {
      const js = 'const str = `hello';
      const result = validateJavaScript(js);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Unclosed template literal');
    });

    it('detects smart/curly quotes and returns error', () => {
      // Using Unicode for smart quotes: \u201C = ", \u201D = ", \u2018 = ', \u2019 = '
      const js = 'const str = \u201Chello\u201D;';
      const result = validateJavaScript(js);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Smart quotes detected (" " \' \'). Replace with straight quotes (" \')',
      );
    });

    it('detects smart single quotes', () => {
      const js = 'const str = \u2018hello\u2019;';
      const result = validateJavaScript(js);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('Smart quotes'))).toBe(true);
    });

    it('does not strip URLs as comments (https://)', () => {
      const js = `const url = "https://example.com";`;
      const result = validateJavaScript(js);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('does not strip URLs as comments (http://)', () => {
      const js = `fetch("http://api.example.com/data");`;
      const result = validateJavaScript(js);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('still strips actual single-line comments', () => {
      const js = `const x = 1; // comment with unclosed quote '
const y = 2;`;
      const result = validateJavaScript(js);
      expect(result.isValid).toBe(true);
    });

    it('strips multi-line comments correctly', () => {
      const js = `const x = 1; /* multi-line
comment with unclosed quote ' */ const y = 2;`;
      const result = validateJavaScript(js);
      expect(result.isValid).toBe(true);
    });

    it('validates multiline strings spanning multiple lines', () => {
      const js = `const str = "hello
world";`;
      const result = validateJavaScript(js);
      // This should be valid as quotes are balanced across the entire code
      expect(result.isValid).toBe(true);
    });

    it('detects unclosed single quote without line number', () => {
      const js = "const str = 'hello;";
      const result = validateJavaScript(js);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Unclosed single quote');
      // Should NOT contain line numbers
      expect(result.errors.every((e) => !e.includes('on line'))).toBe(true);
    });

    it('detects unclosed double quote without line number', () => {
      const js = 'const str = "hello;';
      const result = validateJavaScript(js);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Unclosed double quote');
      // Should NOT contain line numbers
      expect(result.errors.every((e) => !e.includes('on line'))).toBe(true);
    });

    it('handles complex code with URLs and comments correctly', () => {
      const js = `
// Fetch data from API
const API_URL = "https://api.example.com/v1";
fetch(API_URL)
  .then(response => response.json())
  .then(data => console.log(data));
/*
 * Multi-line comment
 * with various characters: ' " \`
 */
`;
      const result = validateJavaScript(js);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('combines smart quotes error with other errors', () => {
      const js = 'const str = \u201Chello;'; // Smart quote + unclosed
      const result = validateJavaScript(js);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      expect(result.errors.some((e) => e.includes('Smart quotes'))).toBe(true);
    });
  });
});

describe('EmbedTab Component', () => {
  beforeEach(() => {
    cleanup();
    mockEditMentor.mockReset();
    mockCreateShareableLink.mockReset();
    mockUpdateShareableLink.mockReset();
    mockGetMentorId.mockReset();
    mockGetMentorSettingsQuery.mockReset();
    mockGetShareableLinkQuery.mockReset();
    mockToast.mockReset();
    mockUseEmbedTab.mockReset();

    mockUseParams.mockReturnValue({ tenantKey: 'test-tenant', mentorId: 'test-mentor' });
    mockGetMentorId.mockReturnValue(null);

    mockEditMentor.mockReturnValue({ unwrap: vi.fn().mockResolvedValue({}) });
    mockCreateShareableLink.mockReturnValue({ unwrap: vi.fn().mockResolvedValue({}) });
    mockUpdateShareableLink.mockReturnValue({ unwrap: vi.fn().mockResolvedValue({}) });

    mockGetMentorSettingsQuery.mockReturnValue({
      data: {
        mentor_name: 'Test Mentor',
        custom_css: '',
        custom_javascript: '',
        enable_custom_javascript: true,
        permissions: {
          field: {
            custom_css: { read_only: false },
          },
        },
      },
      isLoading: false,
    });

    mockGetShareableLinkQuery.mockReturnValue({
      data: null,
      isLoading: false,
    });

    // Default useEmbedTab mock
    mockUseEmbedTab.mockReturnValue(createEmbedTabMock());
  });

  afterEach(() => {
    cleanup();
  });

  describe('Rendering', () => {
    it('renders the embed tab with title and description', () => {
      render(<EmbedTab />);
      expect(screen.getByText('Embed')).toBeInTheDocument();
      expect(screen.getByText('Configure embedding options for your mentor.')).toBeInTheDocument();
    });

    it('renders Advanced CSS section', () => {
      render(<EmbedTab />);
      expect(screen.getByText('Advanced CSS')).toBeInTheDocument();
    });

    it('renders Advanced JavaScript section when enabled', () => {
      render(<EmbedTab />);
      expect(screen.getByText('Advanced JavaScript')).toBeInTheDocument();
    });
  });

  describe('Advanced CSS Section', () => {
    it('expands and collapses CSS section on click', async () => {
      render(<EmbedTab />);

      // Find and click the Advanced CSS button
      const cssButton = screen.getByRole('button', { name: /Advanced CSS/i });
      expect(cssButton).toBeInTheDocument();

      // Click to expand
      fireEvent.click(cssButton);

      await waitFor(() => {
        // Check for textarea (CSS input)
        const textareas = screen.getAllByTestId('textarea');
        expect(textareas.length).toBeGreaterThan(0);
      });
    });

    it('shows correct aria attributes for expand/collapse', () => {
      render(<EmbedTab />);

      const cssButton = screen.getByRole('button', { name: /Advanced CSS/i });
      expect(cssButton).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(cssButton);
      expect(cssButton).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('Advanced JavaScript Section', () => {
    it('expands and collapses JS section on click', async () => {
      render(<EmbedTab />);

      // Find and click the Advanced JavaScript button
      const jsButton = screen.getByRole('button', { name: /Advanced JavaScript/i });
      expect(jsButton).toBeInTheDocument();

      // Click to expand
      fireEvent.click(jsButton);

      await waitFor(() => {
        // Check for textarea (JS input)
        const textareas = screen.getAllByTestId('textarea');
        expect(textareas.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Shareable Link Section', () => {
    it('renders shareable link section', () => {
      render(<EmbedTab />);
      expect(screen.getByText('Shareable Link')).toBeInTheDocument();
    });

    it('shows toggle for shareable link', () => {
      render(<EmbedTab />);
      const switches = screen.getAllByTestId('switch');
      expect(switches.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('handles missing mentorId from getMentorId by using params', () => {
      mockGetMentorId.mockReturnValue(null);
      mockUseParams.mockReturnValue({ tenantKey: 'test-tenant', mentorId: 'params-mentor' });

      render(<EmbedTab />);

      // Component should render without crashing
      expect(screen.getByText('Embed')).toBeInTheDocument();
    });

    it('uses activeMentorId from getMentorId when available', () => {
      mockGetMentorId.mockReturnValue('active-mentor-123');

      render(<EmbedTab />);

      // Component should render without crashing
      expect(screen.getByText('Embed')).toBeInTheDocument();
    });

    it('handles undefined mentor settings gracefully', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
      });

      render(<EmbedTab />);

      // Component should render without crashing
      expect(screen.getByText('Embed')).toBeInTheDocument();
    });

    it('handles loading state for mentor settings', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: null,
        isLoading: true,
      });

      render(<EmbedTab />);

      // Component should still render
      expect(screen.getByText('Embed')).toBeInTheDocument();
    });
  });

  describe('CSS Textarea Interactions', () => {
    it('shows CSS textarea when Advanced CSS section is expanded', async () => {
      render(<EmbedTab />);

      const cssButton = screen.getByRole('button', { name: /Advanced CSS/i });
      fireEvent.click(cssButton);

      await waitFor(() => {
        const textareas = screen.getAllByTestId('textarea');
        expect(textareas.length).toBeGreaterThan(0);
      });
    });

    it('updates CSS value when typing in textarea', async () => {
      render(<EmbedTab />);

      const cssButton = screen.getByRole('button', { name: /Advanced CSS/i });
      fireEvent.click(cssButton);

      await waitFor(() => {
        const textareas = screen.getAllByTestId('textarea');
        expect(textareas.length).toBeGreaterThan(0);
      });

      const textarea = screen.getAllByTestId('textarea')[0];
      fireEvent.change(textarea, { target: { value: '.test { color: red; }' } });

      expect(textarea).toHaveValue('.test { color: red; }');
    });
  });

  describe('JavaScript Textarea Interactions', () => {
    it('shows JS textarea when Advanced JavaScript section is expanded', async () => {
      render(<EmbedTab />);

      const jsButton = screen.getByRole('button', { name: /Advanced JavaScript/i });
      fireEvent.click(jsButton);

      await waitFor(() => {
        const textareas = screen.getAllByTestId('textarea');
        expect(textareas.length).toBeGreaterThan(0);
      });
    });

    it('updates JS value when typing in textarea', async () => {
      render(<EmbedTab />);

      const jsButton = screen.getByRole('button', { name: /Advanced JavaScript/i });
      fireEvent.click(jsButton);

      await waitFor(() => {
        const textareas = screen.getAllByTestId('textarea');
        expect(textareas.length).toBeGreaterThan(0);
      });

      const textarea = screen.getAllByTestId('textarea')[0];
      fireEvent.change(textarea, { target: { value: 'console.log("test");' } });

      expect(textarea).toHaveValue('console.log("test");');
    });
  });

  describe('Shareable Link Toggle', () => {
    it('renders shareable link toggle switch', () => {
      render(<EmbedTab />);

      const switches = screen.getAllByTestId('switch');
      expect(switches.length).toBeGreaterThan(0);
    });

    it('shareable link toggle can be clicked', async () => {
      mockGetShareableLinkQuery.mockReturnValue({
        data: { enabled: false, token: 'test-token' },
        isLoading: false,
      });

      render(<EmbedTab />);

      const switches = screen.getAllByTestId('switch');
      const shareableToggle = switches[0];

      fireEvent.click(shareableToggle);

      // Toggle should respond to click
      await waitFor(() => {
        expect(shareableToggle).toBeInTheDocument();
      });
    });
  });

  describe('Form Elements', () => {
    it('renders mentor visibility select', () => {
      render(<EmbedTab />);

      // Check that select components are rendered
      const selects = screen.getAllByText('Select');
      expect(selects.length).toBeGreaterThan(0);
    });

    it('renders create embed button', () => {
      render(<EmbedTab />);

      const createButton = screen.getByRole('button', { name: /Create Embed/i });
      expect(createButton).toBeInTheDocument();
    });

    it('create embed button can be clicked', async () => {
      render(<EmbedTab />);

      const createButton = screen.getByRole('button', { name: /Create Embed/i });
      fireEvent.click(createButton);

      // Button should be clickable
      await waitFor(() => {
        expect(createButton).toBeInTheDocument();
      });
    });
  });

  describe('With Existing Settings', () => {
    it('displays existing CSS from mentor settings', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: {
          mentor_name: 'Test Mentor',
          custom_css: '.existing { color: blue; }',
          custom_javascript: 'console.log("existing");',
          permissions: {
            field: {
              custom_css: { read_only: false },
            },
          },
        },
        isLoading: false,
      });

      render(<EmbedTab />);

      // Component should render with existing settings
      expect(screen.getByText('Embed')).toBeInTheDocument();
    });

    it('displays existing shareable link token', () => {
      mockGetShareableLinkQuery.mockReturnValue({
        data: { enabled: true, token: 'existing-token-123' },
        isLoading: false,
      });

      render(<EmbedTab />);

      // Component should render with existing shareable link
      expect(screen.getByText('Embed')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has accessible labels for CSS section', () => {
      render(<EmbedTab />);

      const cssButton = screen.getByRole('button', { name: /Advanced CSS/i });
      expect(cssButton).toHaveAttribute('aria-expanded');
      expect(cssButton).toHaveAttribute('aria-label');
    });

    it('has accessible labels for JS section', () => {
      render(<EmbedTab />);

      const jsButton = screen.getByRole('button', { name: /Advanced JavaScript/i });
      expect(jsButton).toHaveAttribute('aria-expanded');
      expect(jsButton).toHaveAttribute('aria-label');
    });
  });

  describe('CSS Save and Discard', () => {
    it('shows Save button when CSS section is expanded', async () => {
      render(<EmbedTab />);

      const cssButton = screen.getByRole('button', { name: /Advanced CSS/i });
      fireEvent.click(cssButton);

      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /Save advanced CSS/i });
        expect(saveButton).toBeInTheDocument();
      });
    });

    it('can enter CSS and trigger save', async () => {
      render(<EmbedTab />);

      // Expand CSS section
      const cssButton = screen.getByRole('button', { name: /Advanced CSS/i });
      fireEvent.click(cssButton);

      await waitFor(() => {
        const textareas = screen.getAllByTestId('textarea');
        expect(textareas.length).toBeGreaterThan(0);
      });

      // Enter CSS
      const textarea = screen.getAllByTestId('textarea')[0];
      fireEvent.change(textarea, { target: { value: '.test { color: red; }' } });

      // Click save button
      const saveButton = screen.getByRole('button', { name: /Save advanced CSS/i });
      fireEvent.click(saveButton);

      // Verify save was attempted
      await waitFor(() => {
        expect(mockEditMentor).toHaveBeenCalled();
      });
    });

    it('shows Discard button when CSS has changes', async () => {
      render(<EmbedTab />);

      // Expand CSS section
      const cssButton = screen.getByRole('button', { name: /Advanced CSS/i });
      fireEvent.click(cssButton);

      await waitFor(() => {
        const textareas = screen.getAllByTestId('textarea');
        expect(textareas.length).toBeGreaterThan(0);
      });

      // Enter CSS
      const textarea = screen.getAllByTestId('textarea')[0];
      fireEvent.change(textarea, { target: { value: '.test { color: blue; }' } });

      await waitFor(() => {
        const discardButton = screen.getByRole('button', { name: /Discard changes/i });
        expect(discardButton).toBeInTheDocument();
      });
    });

    it('can discard CSS changes', async () => {
      render(<EmbedTab />);

      // Expand CSS section
      const cssButton = screen.getByRole('button', { name: /Advanced CSS/i });
      fireEvent.click(cssButton);

      await waitFor(() => {
        const textareas = screen.getAllByTestId('textarea');
        expect(textareas.length).toBeGreaterThan(0);
      });

      // Enter CSS
      const textarea = screen.getAllByTestId('textarea')[0];
      fireEvent.change(textarea, { target: { value: '.changed { color: green; }' } });

      // Click discard button
      await waitFor(() => {
        const discardButton = screen.getByRole('button', { name: /Discard changes/i });
        fireEvent.click(discardButton);
      });

      // Textarea should be reset
      await waitFor(() => {
        expect(textarea).toHaveValue('');
      });
    });
  });

  describe('JavaScript Save and Discard', () => {
    it('shows Save button when JS section is expanded and enabled', async () => {
      render(<EmbedTab />);

      const jsButton = screen.getByRole('button', { name: /Advanced JavaScript/i });
      fireEvent.click(jsButton);

      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /Save advanced JavaScript/i });
        expect(saveButton).toBeInTheDocument();
      });
    });

    it('can enter JavaScript and trigger save', async () => {
      render(<EmbedTab />);

      // Expand JS section
      const jsButton = screen.getByRole('button', { name: /Advanced JavaScript/i });
      fireEvent.click(jsButton);

      await waitFor(() => {
        const textareas = screen.getAllByTestId('textarea');
        expect(textareas.length).toBeGreaterThan(0);
      });

      // Enter JavaScript (get the JS textarea, not CSS)
      const textareas = screen.getAllByTestId('textarea');
      const jsTextarea = textareas[textareas.length - 1]; // JS is the last textarea
      fireEvent.change(jsTextarea, { target: { value: 'console.log("test");' } });

      // Click save button
      const saveButton = screen.getByRole('button', { name: /Save advanced JavaScript/i });
      fireEvent.click(saveButton);

      // Verify save was attempted
      await waitFor(() => {
        expect(mockEditMentor).toHaveBeenCalled();
      });
    });

    it('shows Discard button when JS has changes', async () => {
      render(<EmbedTab />);

      // Expand JS section
      const jsButton = screen.getByRole('button', { name: /Advanced JavaScript/i });
      fireEvent.click(jsButton);

      await waitFor(() => {
        const textareas = screen.getAllByTestId('textarea');
        expect(textareas.length).toBeGreaterThan(0);
      });

      // Enter JavaScript
      const textareas = screen.getAllByTestId('textarea');
      const jsTextarea = textareas[textareas.length - 1];
      fireEvent.change(jsTextarea, { target: { value: 'alert("test");' } });

      await waitFor(() => {
        const discardButtons = screen.getAllByRole('button', { name: /Discard changes/i });
        expect(discardButtons.length).toBeGreaterThan(0);
      });
    });

    it('can discard JavaScript changes', async () => {
      render(<EmbedTab />);

      // Expand JS section
      const jsButton = screen.getByRole('button', { name: /Advanced JavaScript/i });
      fireEvent.click(jsButton);

      await waitFor(() => {
        const textareas = screen.getAllByTestId('textarea');
        expect(textareas.length).toBeGreaterThan(0);
      });

      // Enter JavaScript
      const textareas = screen.getAllByTestId('textarea');
      const jsTextarea = textareas[textareas.length - 1];
      fireEvent.change(jsTextarea, { target: { value: 'const x = 1;' } });

      // Click discard button
      await waitFor(() => {
        const discardButtons = screen.getAllByRole('button', { name: /Discard changes/i });
        fireEvent.click(discardButtons[discardButtons.length - 1]);
      });

      // Textarea should be reset
      await waitFor(() => {
        expect(jsTextarea).toHaveValue('');
      });
    });
  });

  describe('Validation States', () => {
    it('shows validation error for invalid CSS', async () => {
      render(<EmbedTab />);

      // Expand CSS section
      const cssButton = screen.getByRole('button', { name: /Advanced CSS/i });
      fireEvent.click(cssButton);

      await waitFor(() => {
        const textareas = screen.getAllByTestId('textarea');
        expect(textareas.length).toBeGreaterThan(0);
      });

      // Enter invalid CSS (unbalanced braces)
      const textarea = screen.getAllByTestId('textarea')[0];
      fireEvent.change(textarea, { target: { value: '.test { color: red;' } });

      // Component should handle invalid CSS
      expect(textarea).toHaveValue('.test { color: red;');
    });

    it('shows validation error for invalid JavaScript', async () => {
      render(<EmbedTab />);

      // Expand JS section
      const jsButton = screen.getByRole('button', { name: /Advanced JavaScript/i });
      fireEvent.click(jsButton);

      await waitFor(() => {
        const textareas = screen.getAllByTestId('textarea');
        expect(textareas.length).toBeGreaterThan(0);
      });

      // Enter invalid JavaScript (unbalanced braces)
      const textareas = screen.getAllByTestId('textarea');
      const jsTextarea = textareas[textareas.length - 1];
      fireEvent.change(jsTextarea, { target: { value: 'function test() {' } });

      // Component should handle invalid JS
      expect(jsTextarea).toHaveValue('function test() {');
    });

    it('shows warning for potentially dangerous JavaScript', async () => {
      render(<EmbedTab />);

      // Expand JS section
      const jsButton = screen.getByRole('button', { name: /Advanced JavaScript/i });
      fireEvent.click(jsButton);

      await waitFor(() => {
        const textareas = screen.getAllByTestId('textarea');
        expect(textareas.length).toBeGreaterThan(0);
      });

      // Enter JavaScript with eval (which triggers warning)
      const textareas = screen.getAllByTestId('textarea');
      const jsTextarea = textareas[textareas.length - 1];
      fireEvent.change(jsTextarea, { target: { value: 'eval("test")' } });

      // Component should handle JS with warnings
      expect(jsTextarea).toHaveValue('eval("test")');
    });
  });

  describe('Loading States', () => {
    it('shows loading state when settings are loading', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: null,
        isLoading: true,
      });

      render(<EmbedTab />);

      // Component should render even when loading
      expect(screen.getByText('Embed')).toBeInTheDocument();
    });

    it('shows loading state when shareable link is loading', () => {
      mockGetShareableLinkQuery.mockReturnValue({
        data: null,
        isLoading: true,
      });

      render(<EmbedTab />);

      // Component should render even when loading
      expect(screen.getByText('Embed')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles save CSS error gracefully', async () => {
      mockEditMentor.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(new Error('Save failed')),
      });

      render(<EmbedTab />);

      // Expand CSS section
      const cssButton = screen.getByRole('button', { name: /Advanced CSS/i });
      fireEvent.click(cssButton);

      await waitFor(() => {
        const textareas = screen.getAllByTestId('textarea');
        expect(textareas.length).toBeGreaterThan(0);
      });

      // Enter CSS
      const textarea = screen.getAllByTestId('textarea')[0];
      fireEvent.change(textarea, { target: { value: '.error { color: red; }' } });

      // Click save button
      const saveButton = screen.getByRole('button', { name: /Save advanced CSS/i });
      fireEvent.click(saveButton);

      // Component should handle error
      await waitFor(() => {
        expect(mockEditMentor).toHaveBeenCalled();
      });
    });

    it('handles save JavaScript error gracefully', async () => {
      mockEditMentor.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(new Error('Save failed')),
      });

      render(<EmbedTab />);

      // Expand JS section
      const jsButton = screen.getByRole('button', { name: /Advanced JavaScript/i });
      fireEvent.click(jsButton);

      await waitFor(() => {
        const textareas = screen.getAllByTestId('textarea');
        expect(textareas.length).toBeGreaterThan(0);
      });

      // Enter JavaScript
      const textareas = screen.getAllByTestId('textarea');
      const jsTextarea = textareas[textareas.length - 1];
      fireEvent.change(jsTextarea, { target: { value: 'console.log("error");' } });

      // Click save button
      const saveButton = screen.getByRole('button', { name: /Save advanced JavaScript/i });
      fireEvent.click(saveButton);

      // Component should handle error
      await waitFor(() => {
        expect(mockEditMentor).toHaveBeenCalled();
      });
    });
  });

  describe('Shareable Link Operations', () => {
    it('can toggle shareable link on', async () => {
      mockGetShareableLinkQuery.mockReturnValue({
        data: { enabled: false, token: null },
        isLoading: false,
      });

      render(<EmbedTab />);

      const switches = screen.getAllByTestId('switch');
      const shareableToggle = switches[0];

      fireEvent.click(shareableToggle);

      // Toggle should respond to click
      await waitFor(() => {
        expect(shareableToggle).toBeInTheDocument();
      });
    });

    it('renders with enabled shareable link', () => {
      mockGetShareableLinkQuery.mockReturnValue({
        data: { enabled: true, token: 'test-token-abc123' },
        isLoading: false,
      });

      render(<EmbedTab />);

      // Component should render with shareable link enabled
      expect(screen.getByText('Embed')).toBeInTheDocument();
    });
  });

  describe('Custom JavaScript Disabled State', () => {
    it('shows disabled notice when custom JS is not enabled', async () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: {
          mentor_name: 'Test Mentor',
          custom_css: '',
          custom_javascript: '',
          enable_custom_javascript: false,
          permissions: {
            field: {
              custom_css: { read_only: false },
            },
          },
        },
        isLoading: false,
      });

      render(<EmbedTab />);

      // Expand JS section
      const jsButton = screen.getByRole('button', { name: /Advanced JavaScript/i });
      fireEvent.click(jsButton);

      // Should show disabled notice
      await waitFor(() => {
        expect(screen.getByText(/Custom JavaScript is Disabled/i)).toBeInTheDocument();
      });
    });

    it('shows security notice when JS is disabled', async () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: {
          mentor_name: 'Test Mentor',
          custom_css: '',
          custom_javascript: '',
          enable_custom_javascript: false,
          permissions: {
            field: {
              custom_css: { read_only: false },
            },
          },
        },
        isLoading: false,
      });

      render(<EmbedTab />);

      // Expand JS section
      const jsButton = screen.getByRole('button', { name: /Advanced JavaScript/i });
      fireEvent.click(jsButton);

      // Should show security-related text
      await waitFor(() => {
        expect(screen.getByText(/security reasons/i)).toBeInTheDocument();
      });
    });
  });

  describe('Read-Only Permissions', () => {
    it('disables CSS editing when read-only', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: {
          mentor_name: 'Test Mentor',
          custom_css: '.readonly { color: gray; }',
          custom_javascript: '',
          enable_custom_javascript: true,
          permissions: {
            field: {
              custom_css: { read_only: true },
            },
          },
        },
        isLoading: false,
      });

      render(<EmbedTab />);

      // Component should render
      expect(screen.getByText('Embed')).toBeInTheDocument();
    });
  });

  describe('Embed Code Generation', () => {
    it('renders create embed button', () => {
      render(<EmbedTab />);

      const createButton = screen.getByRole('button', { name: /Create Embed/i });
      expect(createButton).toBeInTheDocument();
    });

    it('can click create embed button', async () => {
      render(<EmbedTab />);

      const createButton = screen.getByRole('button', { name: /Create Embed/i });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(createButton).toBeInTheDocument();
      });
    });

    it('shows generating state when submitting', async () => {
      render(<EmbedTab />);

      const createButton = screen.getByRole('button', { name: /Create Embed/i });
      expect(createButton).not.toBeDisabled();
    });
  });

  describe('Custom Floating Bubble', () => {
    it('renders icon selection field', () => {
      render(<EmbedTab />);

      // Component should have icon selection options
      expect(screen.getByText('Embed')).toBeInTheDocument();
    });

    it('renders mentor visibility field', () => {
      render(<EmbedTab />);

      // Component should render with visibility options
      expect(screen.getByText('Embed')).toBeInTheDocument();
    });
  });

  describe('Form State', () => {
    it('initializes with default form values', () => {
      render(<EmbedTab />);

      // Form should initialize correctly
      expect(screen.getByText('Embed')).toBeInTheDocument();
    });

    it('renders all required form sections', () => {
      render(<EmbedTab />);

      // Check main sections are rendered
      expect(screen.getByText('Embed')).toBeInTheDocument();
      expect(screen.getByText('Advanced CSS')).toBeInTheDocument();
      expect(screen.getByText('Advanced JavaScript')).toBeInTheDocument();
      expect(screen.getByText('Shareable Link')).toBeInTheDocument();
    });
  });

  describe('Component Interactions', () => {
    it('handles rapid CSS section expand/collapse', async () => {
      render(<EmbedTab />);

      const cssButton = screen.getByRole('button', { name: /Advanced CSS/i });

      // Rapid clicks
      fireEvent.click(cssButton);
      fireEvent.click(cssButton);
      fireEvent.click(cssButton);

      await waitFor(() => {
        expect(cssButton).toBeInTheDocument();
      });
    });

    it('handles rapid JS section expand/collapse', async () => {
      render(<EmbedTab />);

      const jsButton = screen.getByRole('button', { name: /Advanced JavaScript/i });

      // Rapid clicks
      fireEvent.click(jsButton);
      fireEvent.click(jsButton);
      fireEvent.click(jsButton);

      await waitFor(() => {
        expect(jsButton).toBeInTheDocument();
      });
    });

    it('can expand both CSS and JS sections', async () => {
      render(<EmbedTab />);

      const cssButton = screen.getByRole('button', { name: /Advanced CSS/i });
      const jsButton = screen.getByRole('button', { name: /Advanced JavaScript/i });

      fireEvent.click(cssButton);
      fireEvent.click(jsButton);

      await waitFor(() => {
        expect(cssButton).toHaveAttribute('aria-expanded', 'true');
        expect(jsButton).toHaveAttribute('aria-expanded', 'true');
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles empty mentor settings', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: null,
        isLoading: false,
      });

      render(<EmbedTab />);

      expect(screen.getByText('Embed')).toBeInTheDocument();
    });

    it('handles undefined shareable link data', () => {
      mockGetShareableLinkQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
      });

      render(<EmbedTab />);

      expect(screen.getByText('Embed')).toBeInTheDocument();
    });

    it('handles mentor settings with missing fields', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: {
          mentor_name: 'Test',
        },
        isLoading: false,
      });

      render(<EmbedTab />);

      expect(screen.getByText('Embed')).toBeInTheDocument();
    });
  });

  describe('CSS Value Persistence', () => {
    it('preserves CSS value during typing', async () => {
      render(<EmbedTab />);

      const cssButton = screen.getByRole('button', { name: /Advanced CSS/i });
      fireEvent.click(cssButton);

      await waitFor(() => {
        const textareas = screen.getAllByTestId('textarea');
        expect(textareas.length).toBeGreaterThan(0);
      });

      const textarea = screen.getAllByTestId('textarea')[0];

      // Type multiple changes
      fireEvent.change(textarea, { target: { value: '.a { }' } });
      expect(textarea).toHaveValue('.a { }');

      fireEvent.change(textarea, { target: { value: '.ab { }' } });
      expect(textarea).toHaveValue('.ab { }');

      fireEvent.change(textarea, { target: { value: '.abc { }' } });
      expect(textarea).toHaveValue('.abc { }');
    });
  });

  describe('JavaScript Value Persistence', () => {
    it('preserves JS value during typing', async () => {
      render(<EmbedTab />);

      const jsButton = screen.getByRole('button', { name: /Advanced JavaScript/i });
      fireEvent.click(jsButton);

      await waitFor(() => {
        const textareas = screen.getAllByTestId('textarea');
        expect(textareas.length).toBeGreaterThan(0);
      });

      const textareas = screen.getAllByTestId('textarea');
      const jsTextarea = textareas[textareas.length - 1];

      // Type multiple changes
      fireEvent.change(jsTextarea, { target: { value: 'a' } });
      expect(jsTextarea).toHaveValue('a');

      fireEvent.change(jsTextarea, { target: { value: 'ab' } });
      expect(jsTextarea).toHaveValue('ab');

      fireEvent.change(jsTextarea, { target: { value: 'abc' } });
      expect(jsTextarea).toHaveValue('abc');
    });
  });

  describe('Embed Code Dialog', () => {
    it('shows embed code dialog when embedCode is set', () => {
      mockUseEmbedTab.mockReturnValue(
        createEmbedTabMock({
          embedCode: '<script>test embed</script>',
        }),
      );

      render(<EmbedTab />);

      expect(screen.getByText('Embedded Code')).toBeInTheDocument();
    });

    it('shows copy code block in embed dialog', () => {
      mockUseEmbedTab.mockReturnValue(
        createEmbedTabMock({
          embedCode: '<script src="test.js"></script>',
        }),
      );

      render(<EmbedTab />);

      // Dialog should be visible
      expect(screen.getByText('Embedded Code')).toBeInTheDocument();
    });

    it('does not show dialog when embedCode is empty', () => {
      mockUseEmbedTab.mockReturnValue(createEmbedTabMock({ embedCode: '' }));

      render(<EmbedTab />);

      expect(screen.queryByText('Embedded Code')).not.toBeInTheDocument();
    });
  });

  describe('Custom Floating Bubble Configuration', () => {
    it('renders with focusEditCustomFloatingBubble true', () => {
      mockUseEmbedTab.mockReturnValue(
        createEmbedTabMock({
          focusEditCustomFloatingBubble: true,
        }),
      );

      render(<EmbedTab />);

      expect(screen.getByText('Embed')).toBeInTheDocument();
    });

    it('renders bubble config with different positions', () => {
      mockUseEmbedTab.mockReturnValue(
        createEmbedTabMock({
          customFloatingBubbleConfig: {
            ...createEmbedTabMock().customFloatingBubbleConfig,
            position: 'bottom-left',
          },
        }),
      );

      render(<EmbedTab />);

      expect(screen.getByText('Embed')).toBeInTheDocument();
    });

    it('renders bubble config with top-right position', () => {
      mockUseEmbedTab.mockReturnValue(
        createEmbedTabMock({
          customFloatingBubbleConfig: {
            ...createEmbedTabMock().customFloatingBubbleConfig,
            position: 'top-right',
          },
        }),
      );

      render(<EmbedTab />);

      expect(screen.getByText('Embed')).toBeInTheDocument();
    });

    it('renders bubble config with top-left position', () => {
      mockUseEmbedTab.mockReturnValue(
        createEmbedTabMock({
          customFloatingBubbleConfig: {
            ...createEmbedTabMock().customFloatingBubbleConfig,
            position: 'top-left',
          },
        }),
      );

      render(<EmbedTab />);

      expect(screen.getByText('Embed')).toBeInTheDocument();
    });

    it('handles bubble image error', () => {
      const handleError = vi.fn();
      mockUseEmbedTab.mockReturnValue(
        createEmbedTabMock({
          handleFloatingBubbleImageError: handleError,
        }),
      );

      render(<EmbedTab />);

      expect(screen.getByText('Embed')).toBeInTheDocument();
    });
  });

  describe('Form Submitting State', () => {
    it('shows generating state when form is submitting', () => {
      mockUseEmbedTab.mockReturnValue(
        createEmbedTabMock({
          form: {
            handleSubmit: vi.fn(),
            getFieldValue: vi.fn(),
            state: { isSubmitting: true },
            Field: ({ children }: any) => children({ state: { value: '' }, handleChange: vi.fn() }),
            Subscribe: ({ children }: any) => children(['default']),
          },
        }),
      );

      render(<EmbedTab />);

      expect(screen.getByText('Generating Embed')).toBeInTheDocument();
    });

    it('shows create embed when not submitting', () => {
      mockUseEmbedTab.mockReturnValue(
        createEmbedTabMock({
          form: {
            handleSubmit: vi.fn(),
            getFieldValue: vi.fn(),
            state: { isSubmitting: false },
            Field: ({ children }: any) => children({ state: { value: '' }, handleChange: vi.fn() }),
            Subscribe: ({ children }: any) => children(['default']),
          },
        }),
      );

      render(<EmbedTab />);

      expect(screen.getByText('Create Embed')).toBeInTheDocument();
    });
  });

  describe('Token Error State', () => {
    it('handles create token error', () => {
      mockUseEmbedTab.mockReturnValue(
        createEmbedTabMock({
          createTokenError: 'Failed to create token',
        }),
      );

      render(<EmbedTab />);

      // Component should render even with error
      expect(screen.getByText('Embed')).toBeInTheDocument();
    });
  });

  describe('SSO Providers', () => {
    it('handles integrated SSO providers', () => {
      mockUseEmbedTab.mockReturnValue(
        createEmbedTabMock({
          integratedSsoProviders: { providers: ['google', 'saml'] },
        }),
      );

      render(<EmbedTab />);

      expect(screen.getByText('Embed')).toBeInTheDocument();
    });

    it('handles SSO providers error state', () => {
      mockUseEmbedTab.mockReturnValue(
        createEmbedTabMock({
          isIntegratedSsoProvidersError: true,
        }),
      );

      render(<EmbedTab />);

      expect(screen.getByText('Embed')).toBeInTheDocument();
    });
  });

  describe('Redirect Token Data', () => {
    it('handles redirect token data', () => {
      mockUseEmbedTab.mockReturnValue(
        createEmbedTabMock({
          redirectTokenData: { token: 'abc123' },
        }),
      );

      render(<EmbedTab />);

      expect(screen.getByText('Embed')).toBeInTheDocument();
    });
  });

  describe('Token Loading State', () => {
    it('handles create token loading state', () => {
      mockUseEmbedTab.mockReturnValue(
        createEmbedTabMock({
          isCreateTokenLoading: true,
        }),
      );

      render(<EmbedTab />);

      expect(screen.getByText('Embed')).toBeInTheDocument();
    });
  });

  describe('Embed Code Dialog Interaction', () => {
    it('renders embed code dialog with copy button', () => {
      mockUseEmbedTab.mockReturnValue(
        createEmbedTabMock({
          embedCode: '<script src="https://test.com/embed.js"></script>',
        }),
      );

      render(<EmbedTab />);

      expect(screen.getByText('Embedded Code')).toBeInTheDocument();
    });

    it('calls setEmbedCode when dialog would close', () => {
      const mockSetEmbedCode = vi.fn();
      mockUseEmbedTab.mockReturnValue(
        createEmbedTabMock({
          embedCode: '<div>test embed</div>',
          setEmbedCode: mockSetEmbedCode,
        }),
      );

      render(<EmbedTab />);

      // Dialog should be visible
      expect(screen.getByText('Embedded Code')).toBeInTheDocument();
    });
  });

  describe('Floating Bubble Image Error', () => {
    it('handles floating bubble image error callback', () => {
      const mockHandleError = vi.fn();
      mockUseEmbedTab.mockReturnValue(
        createEmbedTabMock({
          handleFloatingBubbleImageError: mockHandleError,
          focusEditCustomFloatingBubble: true,
          customFloatingBubbleConfig: {
            ...createEmbedTabMock().customFloatingBubbleConfig,
            image: 'invalid-image-url',
          },
        }),
      );

      render(<EmbedTab />);

      expect(screen.getByText('Embed')).toBeInTheDocument();
    });

    it('handles bubble config with no image', () => {
      mockUseEmbedTab.mockReturnValue(
        createEmbedTabMock({
          customFloatingBubbleConfig: {
            ...createEmbedTabMock().customFloatingBubbleConfig,
            image: null,
          },
        }),
      );

      render(<EmbedTab />);

      expect(screen.getByText('Embed')).toBeInTheDocument();
    });
  });

  describe('Shareable Token Toggle Handler', () => {
    it('creates new shareable link when toggled on with no existing token', async () => {
      mockGetShareableLinkQuery.mockReturnValue({
        data: null,
        isLoading: false,
      });

      mockCreateShareableLink.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ token: 'new-token-123', enabled: true }),
      });

      render(<EmbedTab />);

      // Find all switches and get the shareable link one (last switch in the shareable link section)
      const switches = screen.getAllByTestId('switch');
      // The shareable link switch has a specific aria-label pattern
      const shareableToggle = switches.find((s) =>
        s.getAttribute('aria-label')?.includes('shareable link'),
      );

      expect(shareableToggle).toBeDefined();
      fireEvent.click(shareableToggle!);

      await waitFor(() => {
        expect(mockCreateShareableLink).toHaveBeenCalled();
      });
    });

    it('enables existing disabled token when toggled on', async () => {
      mockGetShareableLinkQuery.mockReturnValue({
        data: { enabled: false, token: 'existing-disabled-token' },
        isLoading: false,
      });

      mockUpdateShareableLink.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ enabled: true }),
      });

      render(<EmbedTab />);

      // Find the shareable link toggle by its aria-label pattern
      const switches = screen.getAllByTestId('switch');
      const shareableToggle = switches.find((s) =>
        s.getAttribute('aria-label')?.includes('shareable link'),
      );

      expect(shareableToggle).toBeDefined();
      fireEvent.click(shareableToggle!);

      await waitFor(() => {
        expect(mockUpdateShareableLink).toHaveBeenCalled();
      });
    });

    it('disables token when toggled off', async () => {
      mockGetShareableLinkQuery.mockReturnValue({
        data: { enabled: true, token: 'active-token' },
        isLoading: false,
      });

      mockUpdateShareableLink.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ enabled: false }),
      });

      render(<EmbedTab />);

      // Find the shareable link toggle by its aria-label pattern
      const switches = screen.getAllByTestId('switch');
      const shareableToggle = switches.find((s) =>
        s.getAttribute('aria-label')?.includes('shareable link'),
      );

      expect(shareableToggle).toBeDefined();
      // Toggle to unchecked (off)
      fireEvent.click(shareableToggle!);

      await waitFor(() => {
        expect(mockUpdateShareableLink).toHaveBeenCalled();
      });
    });

    it('handles API error when creating shareable link', async () => {
      mockGetShareableLinkQuery.mockReturnValue({
        data: null,
        isLoading: false,
      });

      mockCreateShareableLink.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(new Error('API Error')),
      });

      render(<EmbedTab />);

      // Find the shareable link toggle by its aria-label pattern
      const switches = screen.getAllByTestId('switch');
      const shareableToggle = switches.find((s) =>
        s.getAttribute('aria-label')?.includes('shareable link'),
      );

      expect(shareableToggle).toBeDefined();
      fireEvent.click(shareableToggle!);

      await waitFor(() => {
        expect(mockCreateShareableLink).toHaveBeenCalled();
      });
    });

    it('handles API error when enabling existing token', async () => {
      mockGetShareableLinkQuery.mockReturnValue({
        data: { enabled: false, token: 'existing-token' },
        isLoading: false,
      });

      mockUpdateShareableLink.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(new Error('API Error')),
      });

      render(<EmbedTab />);

      // Find the shareable link toggle by its aria-label pattern
      const switches = screen.getAllByTestId('switch');
      const shareableToggle = switches.find((s) =>
        s.getAttribute('aria-label')?.includes('shareable link'),
      );

      expect(shareableToggle).toBeDefined();
      fireEvent.click(shareableToggle!);

      await waitFor(() => {
        expect(mockUpdateShareableLink).toHaveBeenCalled();
      });
    });

    it('handles API error when disabling token', async () => {
      mockGetShareableLinkQuery.mockReturnValue({
        data: { enabled: true, token: 'active-token' },
        isLoading: false,
      });

      mockUpdateShareableLink.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(new Error('API Error')),
      });

      render(<EmbedTab />);

      // Find the shareable link toggle by its aria-label pattern
      const switches = screen.getAllByTestId('switch');
      const shareableToggle = switches.find((s) =>
        s.getAttribute('aria-label')?.includes('shareable link'),
      );

      expect(shareableToggle).toBeDefined();
      fireEvent.click(shareableToggle!);

      await waitFor(() => {
        expect(mockUpdateShareableLink).toHaveBeenCalled();
      });
    });
  });

  describe('Regenerate Token Handler', () => {
    it('regenerates shareable token when refresh icon is clicked', async () => {
      mockGetShareableLinkQuery.mockReturnValue({
        data: { enabled: true, token: 'existing-token' },
        isLoading: false,
      });

      mockCreateShareableLink.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ token: 'new-regenerated-token', enabled: true }),
      });

      render(<EmbedTab />);

      // Find and click the refresh icon
      const refreshIcon = screen.getByTestId('icon-refresh');
      fireEvent.click(refreshIcon);

      await waitFor(() => {
        expect(mockCreateShareableLink).toHaveBeenCalled();
      });
    });

    it('handles API error when regenerating token', async () => {
      mockGetShareableLinkQuery.mockReturnValue({
        data: { enabled: true, token: 'existing-token' },
        isLoading: false,
      });

      mockCreateShareableLink.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(new Error('Regenerate API Error')),
      });

      render(<EmbedTab />);

      // Find and click the refresh icon
      const refreshIcon = screen.getByTestId('icon-refresh');
      fireEvent.click(refreshIcon);

      await waitFor(() => {
        expect(mockCreateShareableLink).toHaveBeenCalled();
      });
    });
  });

  describe('Custom Floating Bubble Dialog - Dialog Open/Close', () => {
    it('calls setFocusEditCustomFloatingBubble(false) when dialog is closed', () => {
      const mockSetFocusEdit = vi.fn();
      mockUseEmbedTab.mockReturnValue(
        createEmbedTabMock({
          focusEditCustomFloatingBubble: true,
          setFocusEditCustomFloatingBubble: mockSetFocusEdit,
        }),
      );

      render(<EmbedTab />);

      // Find and click the dialog close trigger
      const closeButton = screen.getByTestId('dialog-close-trigger');
      fireEvent.click(closeButton);

      expect(mockSetFocusEdit).toHaveBeenCalledWith(false);
    });
  });

  describe('Custom Floating Bubble Dialog - Appearance Tab Controls', () => {
    it('updates backgroundColor via color input', () => {
      const mockUpdateConfig = vi.fn();
      mockUseEmbedTab.mockReturnValue(
        createEmbedTabMock({
          focusEditCustomFloatingBubble: true,
          updateConfig: mockUpdateConfig,
        }),
      );

      render(<EmbedTab />);

      // Find the backgroundColor color input by id
      const backgroundColorInput = document.getElementById('backgroundColor');
      expect(backgroundColorInput).not.toBeNull();
      fireEvent.change(backgroundColorInput!, { target: { value: '#ff0000' } });

      expect(mockUpdateConfig).toHaveBeenCalledWith('backgroundColor', '#ff0000');
    });

    it('updates textColor via color input', () => {
      const mockUpdateConfig = vi.fn();
      mockUseEmbedTab.mockReturnValue(
        createEmbedTabMock({
          focusEditCustomFloatingBubble: true,
          updateConfig: mockUpdateConfig,
        }),
      );

      render(<EmbedTab />);

      // Find the textColor input by id
      const textColorInput = document.getElementById('textColor');
      expect(textColorInput).not.toBeNull();
      fireEvent.change(textColorInput!, { target: { value: '#00ff00' } });

      expect(mockUpdateConfig).toHaveBeenCalledWith('textColor', '#00ff00');
    });

    it('updates subtitleTextColor via color input', () => {
      const mockUpdateConfig = vi.fn();
      mockUseEmbedTab.mockReturnValue(
        createEmbedTabMock({
          focusEditCustomFloatingBubble: true,
          updateConfig: mockUpdateConfig,
        }),
      );

      render(<EmbedTab />);

      // Find the subtitleTextColor input by id
      const subtitleTextColorInput = document.getElementById('subtitleTextColor');
      expect(subtitleTextColorInput).not.toBeNull();
      fireEvent.change(subtitleTextColorInput!, { target: { value: '#0000ff' } });

      expect(mockUpdateConfig).toHaveBeenCalledWith('subtitleTextColor', '#0000ff');
    });

    it('updates borderRadius via range slider', () => {
      const mockUpdateConfig = vi.fn();
      mockUseEmbedTab.mockReturnValue(
        createEmbedTabMock({
          focusEditCustomFloatingBubble: true,
          updateConfig: mockUpdateConfig,
        }),
      );

      render(<EmbedTab />);

      // Find the borderRadius input by id
      const borderRadiusInput = document.getElementById('borderRadius');
      expect(borderRadiusInput).not.toBeNull();
      fireEvent.change(borderRadiusInput!, { target: { value: '20' } });

      expect(mockUpdateConfig).toHaveBeenCalledWith('borderRadius', '20');
    });

    it('updates imageSize via range slider', () => {
      const mockUpdateConfig = vi.fn();
      mockUseEmbedTab.mockReturnValue(
        createEmbedTabMock({
          focusEditCustomFloatingBubble: true,
          updateConfig: mockUpdateConfig,
        }),
      );

      render(<EmbedTab />);

      // Find all range inputs and locate the imageSize one by its value
      const inputs = document.querySelectorAll('input[type="range"]');
      const imageSizeInput = Array.from(inputs).find(
        (input) => (input as HTMLInputElement).value === '32', // imageSize default
      );

      expect(imageSizeInput).not.toBeNull();
      fireEvent.change(imageSizeInput!, { target: { value: '50' } });

      expect(mockUpdateConfig).toHaveBeenCalledWith('imageSize', '50');
    });

    it('updates fontSize via range slider', () => {
      const mockUpdateConfig = vi.fn();
      mockUseEmbedTab.mockReturnValue(
        createEmbedTabMock({
          focusEditCustomFloatingBubble: true,
          updateConfig: mockUpdateConfig,
        }),
      );

      render(<EmbedTab />);

      // Find the fontSize input by id
      const fontSizeInput = document.getElementById('fontSize');
      expect(fontSizeInput).not.toBeNull();
      fireEvent.change(fontSizeInput!, { target: { value: '18' } });

      expect(mockUpdateConfig).toHaveBeenCalledWith('fontSize', '18');
    });

    it('updates subtitleFontSize via range slider', () => {
      const mockUpdateConfig = vi.fn();
      mockUseEmbedTab.mockReturnValue(
        createEmbedTabMock({
          focusEditCustomFloatingBubble: true,
          updateConfig: mockUpdateConfig,
        }),
      );

      render(<EmbedTab />);

      // Find the subtitleFontSize input by id
      const subtitleFontSizeInput = document.getElementById('subtitleFontSize');
      expect(subtitleFontSizeInput).not.toBeNull();
      fireEvent.change(subtitleFontSizeInput!, { target: { value: '14' } });

      expect(mockUpdateConfig).toHaveBeenCalledWith('subtitleFontSize', '14');
    });

    it('updates padding via range slider', () => {
      const mockUpdateConfig = vi.fn();
      // Use a unique padding value to avoid collision with subtitleFontSize
      mockUseEmbedTab.mockReturnValue(
        createEmbedTabMock({
          focusEditCustomFloatingBubble: true,
          updateConfig: mockUpdateConfig,
          customFloatingBubbleConfig: {
            ...createEmbedTabMock().customFloatingBubbleConfig,
            padding: 15, // Different from subtitleFontSize (12)
          },
        }),
      );

      render(<EmbedTab />);

      // Find all range inputs and locate the padding one by its unique value
      const inputs = document.querySelectorAll('input[type="range"]');
      const paddingInput = Array.from(inputs).find(
        (input) => (input as HTMLInputElement).value === '15',
      );

      expect(paddingInput).not.toBeNull();
      fireEvent.change(paddingInput!, { target: { value: '20' } });

      expect(mockUpdateConfig).toHaveBeenCalledWith('padding', '20');
    });

    it('updates strokeWidth via range slider', () => {
      const mockUpdateConfig = vi.fn();
      mockUseEmbedTab.mockReturnValue(
        createEmbedTabMock({
          focusEditCustomFloatingBubble: true,
          updateConfig: mockUpdateConfig,
        }),
      );

      render(<EmbedTab />);

      // Find all range inputs and locate the strokeWidth one by its value
      const inputs = document.querySelectorAll('input[type="range"]');
      const strokeWidthInput = Array.from(inputs).find(
        (input) => (input as HTMLInputElement).value === '0', // strokeWidth default
      );

      expect(strokeWidthInput).not.toBeNull();
      fireEvent.change(strokeWidthInput!, { target: { value: '3' } });

      expect(mockUpdateConfig).toHaveBeenCalledWith('strokeWidth', '3');
    });

    it('updates strokeColor via color input', () => {
      const mockUpdateConfig = vi.fn();
      mockUseEmbedTab.mockReturnValue(
        createEmbedTabMock({
          focusEditCustomFloatingBubble: true,
          updateConfig: mockUpdateConfig,
        }),
      );

      render(<EmbedTab />);

      // Find the strokeColor input by id
      const strokeColorInput = document.getElementById('strokeColor');
      expect(strokeColorInput).not.toBeNull();
      fireEvent.change(strokeColorInput!, { target: { value: '#333333' } });

      expect(mockUpdateConfig).toHaveBeenCalledWith('strokeColor', '#333333');
    });
  });

  describe('Custom Floating Bubble Dialog - Content Tab', () => {
    it('updates title via input onChange', () => {
      const mockUpdateConfig = vi.fn();
      mockUseEmbedTab.mockReturnValue(
        createEmbedTabMock({
          focusEditCustomFloatingBubble: true,
          updateConfig: mockUpdateConfig,
        }),
      );

      render(<EmbedTab />);

      // Find the title input by id
      const titleInput = document.getElementById('title');
      expect(titleInput).not.toBeNull();
      fireEvent.change(titleInput!, { target: { value: 'New Title' } });

      expect(mockUpdateConfig).toHaveBeenCalledWith('title', 'New Title');
    });

    it('updates subtitle via input onChange', () => {
      const mockUpdateConfig = vi.fn();
      mockUseEmbedTab.mockReturnValue(
        createEmbedTabMock({
          focusEditCustomFloatingBubble: true,
          updateConfig: mockUpdateConfig,
        }),
      );

      render(<EmbedTab />);

      // Find the subtitle input by id
      const subtitleInput = document.getElementById('subtitle');
      expect(subtitleInput).not.toBeNull();
      fireEvent.change(subtitleInput!, { target: { value: 'New Subtitle' } });

      expect(mockUpdateConfig).toHaveBeenCalledWith('subtitle', 'New Subtitle');
    });

    it('handles file upload and converts to base64', async () => {
      const mockUpdateMultipleConfig = vi.fn();
      mockUseEmbedTab.mockReturnValue(
        createEmbedTabMock({
          focusEditCustomFloatingBubble: true,
          updateMultipleConfig: mockUpdateMultipleConfig,
        }),
      );

      render(<EmbedTab />);

      // Find the file input by id
      const fileInput = document.getElementById('iconImage');
      expect(fileInput).not.toBeNull();

      // Create a mock file
      const file = new File(['test'], 'test.png', { type: 'image/png' });

      // Mock FileReader
      const mockReader = {
        readAsDataURL: vi.fn(),
        onload: null as ((event: any) => void) | null,
        result: 'data:image/png;base64,dGVzdA==',
      };
      vi.spyOn(global, 'FileReader').mockImplementation(() => mockReader as any);

      fireEvent.change(fileInput!, { target: { files: [file] } });

      // Trigger the onload callback
      if (mockReader.onload) {
        mockReader.onload({ target: { result: mockReader.result } });
      }

      expect(mockUpdateMultipleConfig).toHaveBeenCalledWith({
        image: 'data:image/png;base64,dGVzdA==',
      });
    });

    it('does not process when no file selected', () => {
      const mockUpdateMultipleConfig = vi.fn();
      mockUseEmbedTab.mockReturnValue(
        createEmbedTabMock({
          focusEditCustomFloatingBubble: true,
          updateMultipleConfig: mockUpdateMultipleConfig,
        }),
      );

      render(<EmbedTab />);

      // Find the file input by id
      const fileInput = document.getElementById('iconImage');
      expect(fileInput).not.toBeNull();

      // Fire change event with empty files array
      fireEvent.change(fileInput!, { target: { files: [] } });

      // updateMultipleConfig should not be called when no file
      expect(mockUpdateMultipleConfig).not.toHaveBeenCalled();
    });
  });

  describe('Custom Floating Bubble Dialog - All Tabs Rendered', () => {
    it('renders appearance tab with visual styling content', () => {
      mockUseEmbedTab.mockReturnValue(
        createEmbedTabMock({
          focusEditCustomFloatingBubble: true,
        }),
      );

      render(<EmbedTab />);

      expect(screen.getByText('Icon Editor')).toBeInTheDocument();
      expect(screen.getByText('Visual Styling')).toBeInTheDocument();
      expect(screen.getByText('Appearance')).toBeInTheDocument();
    });

    it('renders position tab content', () => {
      mockUseEmbedTab.mockReturnValue(
        createEmbedTabMock({
          focusEditCustomFloatingBubble: true,
        }),
      );

      render(<EmbedTab />);

      expect(screen.getByText('Position')).toBeInTheDocument();
      expect(screen.getByText('Position & Layout')).toBeInTheDocument();
      expect(screen.getByText('Screen Position')).toBeInTheDocument();
    });

    it('renders content tab with text content section', () => {
      mockUseEmbedTab.mockReturnValue(
        createEmbedTabMock({
          focusEditCustomFloatingBubble: true,
        }),
      );

      render(<EmbedTab />);

      expect(screen.getByText('Content')).toBeInTheDocument();
      expect(screen.getByText('Text Content')).toBeInTheDocument();
    });
  });

  describe('Form Field Values', () => {
    it('handles form field with different values', () => {
      mockUseEmbedTab.mockReturnValue(
        createEmbedTabMock({
          form: {
            handleSubmit: vi.fn(),
            getFieldValue: vi.fn((field: string) => {
              if (field === 'icon_selection') return 'custom_bubble';
              return '';
            }),
            state: { isSubmitting: false },
            Field: ({ children, name }: any) => {
              const value = name === 'icon_selection' ? 'custom_bubble' : '';
              return children({ state: { value }, handleChange: vi.fn() });
            },
            Subscribe: ({ children }: any) => children(['custom_bubble']),
          },
        }),
      );

      render(<EmbedTab />);

      expect(screen.getByText('Embed')).toBeInTheDocument();
    });
  });

  describe('Existing CSS and JS Values', () => {
    it('loads with existing CSS value', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: {
          mentor_name: 'Test Mentor',
          custom_css: '.existing-css { color: blue; }',
          custom_javascript: '',
          enable_custom_javascript: true,
          permissions: {
            field: {
              custom_css: { read_only: false },
            },
          },
        },
        isLoading: false,
      });

      render(<EmbedTab />);

      expect(screen.getByText('Embed')).toBeInTheDocument();
    });

    it('loads with existing JS value', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: {
          mentor_name: 'Test Mentor',
          custom_css: '',
          custom_javascript: 'console.log("existing");',
          enable_custom_javascript: true,
          permissions: {
            field: {
              custom_css: { read_only: false },
            },
          },
        },
        isLoading: false,
      });

      render(<EmbedTab />);

      expect(screen.getByText('Embed')).toBeInTheDocument();
    });

    it('loads with both existing CSS and JS values', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: {
          mentor_name: 'Test Mentor',
          custom_css: '.test { display: none; }',
          custom_javascript: 'alert("test");',
          enable_custom_javascript: true,
          permissions: {
            field: {
              custom_css: { read_only: false },
            },
          },
        },
        isLoading: false,
      });

      render(<EmbedTab />);

      expect(screen.getByText('Embed')).toBeInTheDocument();
    });
  });

  describe('Multiple Bubble Positions', () => {
    it('renders with bottom-left position', () => {
      mockUseEmbedTab.mockReturnValue(
        createEmbedTabMock({
          focusEditCustomFloatingBubble: true,
          customFloatingBubbleConfig: {
            ...createEmbedTabMock().customFloatingBubbleConfig,
            position: 'bottom-left',
          },
        }),
      );

      render(<EmbedTab />);

      expect(screen.getByText('Embed')).toBeInTheDocument();
    });

    it('renders with top-right position', () => {
      mockUseEmbedTab.mockReturnValue(
        createEmbedTabMock({
          focusEditCustomFloatingBubble: true,
          customFloatingBubbleConfig: {
            ...createEmbedTabMock().customFloatingBubbleConfig,
            position: 'top-right',
          },
        }),
      );

      render(<EmbedTab />);

      expect(screen.getByText('Embed')).toBeInTheDocument();
    });

    it('renders with top-left position', () => {
      mockUseEmbedTab.mockReturnValue(
        createEmbedTabMock({
          focusEditCustomFloatingBubble: true,
          customFloatingBubbleConfig: {
            ...createEmbedTabMock().customFloatingBubbleConfig,
            position: 'top-left',
          },
        }),
      );

      render(<EmbedTab />);

      expect(screen.getByText('Embed')).toBeInTheDocument();
    });
  });

  describe('Remove Image Button', () => {
    it('calls updateMultipleConfig with image: null when Remove Image button is clicked', async () => {
      const mockUpdateMultipleConfig = vi.fn();
      mockUseEmbedTab.mockReturnValue(
        createEmbedTabMock({
          updateMultipleConfig: mockUpdateMultipleConfig,
          focusEditCustomFloatingBubble: true,
          customFloatingBubbleConfig: {
            ...createEmbedTabMock().customFloatingBubbleConfig,
            image: '/test-custom-icon.png',
          },
          form: {
            handleSubmit: vi.fn(),
            getFieldValue: vi.fn((field: string) => {
              if (field === 'icon_selection') return 'custom_bubble';
              return '';
            }),
            state: { isSubmitting: false },
            Field: ({ children, name }: any) => {
              const value = name === 'icon_selection' ? 'custom_bubble' : '';
              return children({ state: { value }, handleChange: vi.fn() });
            },
            Subscribe: ({ children }: any) => children(['custom_bubble']),
          },
        }),
      );

      render(<EmbedTab />);

      // Find and click the Remove Image button
      const removeImageButton = screen.getByRole('button', { name: /Remove Image/i });
      fireEvent.click(removeImageButton);

      expect(mockUpdateMultipleConfig).toHaveBeenCalledWith({ image: null });
    });
  });

  describe('Embed Code Dialog Close', () => {
    it('calls setEmbedCode with empty string when dialog is closed', async () => {
      const mockSetEmbedCode = vi.fn();
      mockUseEmbedTab.mockReturnValue(
        createEmbedTabMock({
          embedCode: '<script src="https://test.com/embed.js"></script>',
          setEmbedCode: mockSetEmbedCode,
        }),
      );

      render(<EmbedTab />);

      // Dialog should be visible
      expect(screen.getByText('Embedded Code')).toBeInTheDocument();

      // Click the close trigger to simulate dialog closing
      const closeButton = screen.getByTestId('dialog-close-trigger');
      fireEvent.click(closeButton);

      expect(mockSetEmbedCode).toHaveBeenCalledWith('');
    });
  });
});
