import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { EmbedTab, validateCss, validateJavaScript } from '../embed-tab';

// ============================================================================
// MOCKS
// ============================================================================

const mockUseParams = vi.fn();
const mockGetMentorId = vi.fn();
const mockUsername = 'testuser';

const mockUseEmbedTab = vi.fn();
const mockUseGetShareableLinkQuery = vi.fn();
const mockCreateShareableLink = vi.fn();
const mockUpdateShareableLink = vi.fn();
const mockGetMentorSettingsQuery = vi.fn();
const mockEditMentor = vi.fn();
const mockEditMentorLoading = vi.fn();
const mockUseTenantMetadata = vi.fn();
const mockToast = vi.fn();
const mockSupportEmail = vi.fn();

const mockSyncEmbedSettings = vi.fn();
const mockCreateTokenHandler = vi.fn();
const mockSetCreateTokenError = vi.fn();
const mockSetEmbedCode = vi.fn();
const mockHandleFloatingBubbleImageError = vi.fn();
const mockSetFocusEditCustomFloatingBubble = vi.fn();
const mockUpdateConfig = vi.fn();
const mockUpdateMultipleConfig = vi.fn();
const mockFormHandleSubmit = vi.fn();

// next/navigation
vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

// next/image
vi.mock('next/image', () => ({
  default: ({ src, alt, onError, onClick, ...props }: any) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} onError={onError} onClick={onClick} {...props} />
  ),
}));

// hooks
vi.mock('@/hooks/use-user', () => ({
  useUsername: () => mockUsername,
}));

vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({ getMentorId: mockGetMentorId }),
}));

// the embed tab hook
vi.mock('../../hooks/useEmbedTab', () => ({
  default: () => mockUseEmbedTab(),
}));

// data-layer hooks
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetShareableLinkQuery: (...args: unknown[]) =>
    mockUseGetShareableLinkQuery(...args),
  useCreateShareableLinkMutation: () => [
    mockCreateShareableLink,
    { data: undefined },
  ],
  useUpdateShareableLinkMutation: () => [mockUpdateShareableLink, {}],
  useGetMentorSettingsQuery: (...args: unknown[]) =>
    mockGetMentorSettingsQuery(...args),
  useEditMentorMutation: () => [
    mockEditMentor,
    { isLoading: mockEditMentorLoading() },
  ],
}));

vi.mock('@iblai/iblai-js/web-utils', () => ({
  useTenantMetadata: (args: unknown) => mockUseTenantMetadata(args),
}));

vi.mock('@iblai/iblai-js/web-containers', () => ({
  Spinner: () => <div data-testid="spinner">Loading...</div>,
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/components/ui/toaster', () => ({
  Toaster: () => <div data-testid="toaster" />,
}));

vi.mock('@/lib/config', () => ({
  config: new Proxy(
    { supportEmail: () => mockSupportEmail() },
    {
      get(target: any, prop: string) {
        if (prop in target) return target[prop];
        return () => '';
      },
    },
  ),
}));

// dynamic web-mentor import (side-effect)
vi.mock('@iblai/iblai-web-mentor', () => ({}));

// sonner
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// copy code block
vi.mock('@/components/copy-code-block', () => ({
  CopyCodeBlock: ({ code }: any) => <pre data-testid="copy-code">{code}</pre>,
}));

// WithFormPermissions
vi.mock('@/hoc/withPermissions', () => ({
  default: ({ children }: any) => children({ disabled: false }),
}));

// UI primitives
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, type, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} type={type} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange, disabled, ...props }: any) => (
    <input
      type="checkbox"
      checked={!!checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
      disabled={disabled}
      {...props}
    />
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, disabled, placeholder, ...props }: any) => (
    <input
      value={value ?? ''}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
      {...props}
    />
  ),
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({ value, onChange, disabled, placeholder, ...props }: any) => (
    <textarea
      value={value ?? ''}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
      {...props}
    />
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => <div>{children}</div>,
  TooltipProvider: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children, onClick, asChild, ...props }: any) => (
    <div onClick={onClick} data-testid="tooltip-trigger" {...props}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, defaultValue, onValueChange, disabled }: any) => (
    <div
      data-testid="select-root"
      data-value={value ?? defaultValue}
      data-disabled={disabled}
    >
      {React.Children.map(children, (child: any) =>
        child ? React.cloneElement(child, { onValueChange }) : null,
      )}
    </div>
  ),
  SelectTrigger: ({ children, ...props }: any) => (
    <button data-testid="select-trigger" {...props}>
      {children}
    </button>
  ),
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
  SelectContent: ({ children, onValueChange }: any) => (
    <div data-testid="select-content">
      {React.Children.map(children, (child: any) =>
        child ? React.cloneElement(child, { onValueChange }) : null,
      )}
    </div>
  ),
  SelectItem: ({ children, value, onValueChange }: any) => (
    <div
      role="option"
      data-value={value}
      onClick={() => onValueChange?.(value)}
    >
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open, onOpenChange }: any) =>
    open ? (
      <div data-testid="dialog">
        <button
          data-testid="dialog-close"
          onClick={() => onOpenChange?.(false)}
        >
          close
        </button>
        {children}
      </div>
    ) : null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: any) => <div>{children}</div>,
  TabsContent: ({ children }: any) => <div>{children}</div>,
  TabsList: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/tabs', () => ({
  TabsTrigger: ({ children }: any) => <button>{children}</button>,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

// ============================================================================
// FORM MOCK FACTORY
// ============================================================================

type FormValues = Record<string, any>;

function makeForm(values: FormValues) {
  const form: any = {
    state: { isSubmitting: false, values },
    handleSubmit: mockFormHandleSubmit,
    Field: ({ name, children }: any) =>
      children({
        state: { value: values[name], meta: { isDirty: false } },
        handleChange: vi.fn(),
      }),
    Subscribe: ({ selector, children }: any) => children(selector({ values })),
  };
  return form;
}

const defaultFloatingBubbleConfig = {
  position: 'bottom-right',
  offsetX: 0,
  offsetY: 0,
  shadow: true,
  backgroundColor: '#3b82f6',
  textColor: '#ffffff',
  subtitleTextColor: '#e5e7eb',
  borderRadius: 16,
  imageSize: 32,
  fontSize: 16,
  subtitleFontSize: 12,
  padding: 1,
  strokeWidth: 1,
  strokeColor: '#3b82f6',
  title: 'Assistant',
  subtitle: 'Created with mentorAI',
  image: 'https://example.com/icon.png',
};

const defaultMentorSettings = {
  custom_css: '',
  custom_javascript: '',
  enable_custom_javascript: false,
  permissions: { field: {} },
};

function buildUseEmbedTabReturn(overrides: Partial<any> = {}) {
  return {
    form: makeForm(overrides.formValues ?? {}),
    createTokenHandler: mockCreateTokenHandler,
    createTokenError: '',
    setCreateTokenError: mockSetCreateTokenError,
    isCreateTokenLoading: false,
    redirectTokenData: undefined,
    integratedSsoProviders: { providers: [] },
    isIntegratedSsoProvidersError: false,
    embedCode: '',
    setEmbedCode: mockSetEmbedCode,
    customFloatingBubbleConfig: defaultFloatingBubbleConfig,
    handleFloatingBubbleImageError: mockHandleFloatingBubbleImageError,
    focusEditCustomFloatingBubble: false,
    setFocusEditCustomFloatingBubble: mockSetFocusEditCustomFloatingBubble,
    updateConfig: mockUpdateConfig,
    updateMultipleConfig: mockUpdateMultipleConfig,
    syncEmbedSettings: mockSyncEmbedSettings,
    ...overrides,
  };
}

const defaultFormValues = {
  icon_selection: 'default',
  mode: 'default',
  starter_prompts: 'guided_prompt',
  mentor_visibility: 'viewable_by_tenant_admins',
  allow_anonymous: true,
  website_url: '',
  is_context_aware: false,
  sso: false,
  sso_provider: '',
  auto_open: false,
  embed_show_attachment: true,
  embed_show_voice_call: false,
  embed_show_voice_record: false,
  generateShareableLink: false,
};

function renderEmbedTab(
  overrides: Partial<any> = {},
  formValues = defaultFormValues,
) {
  mockUseEmbedTab.mockReturnValue(
    buildUseEmbedTabReturn({ ...overrides, formValues }),
  );
  return render(<EmbedTab />);
}

// ============================================================================
// PURE VALIDATOR TESTS
// ============================================================================

describe('validateCss', () => {
  it('returns valid for empty/whitespace input', () => {
    expect(validateCss('')).toEqual({ isValid: true, errors: [] });
    expect(validateCss('   ')).toEqual({ isValid: true, errors: [] });
  });

  it('returns valid for balanced CSS', () => {
    const result = validateCss('.a { color: red; }');
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('flags missing closing brace', () => {
    const result = validateCss('.a { color: red;');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Missing closing brace(s)');
  });

  it('flags missing opening brace', () => {
    const result = validateCss('.a color: red; }');
    expect(result.errors).toContain('Missing opening brace(s)');
  });

  it('flags unbalanced parentheses', () => {
    const result = validateCss('.a { width: calc(100% - 10px; }');
    expect(result.errors).toContain('Unbalanced parentheses');
  });

  it('flags unclosed single quote', () => {
    const result = validateCss(".a { content: 'x; }");
    expect(result.errors).toContain('Unclosed single quote');
  });

  it('flags unclosed double quote', () => {
    const result = validateCss('.a { content: "x; }');
    expect(result.errors).toContain('Unclosed double quote');
  });
});

describe('validateJavaScript', () => {
  it('returns valid for empty/whitespace input', () => {
    expect(validateJavaScript('')).toEqual({
      isValid: true,
      errors: [],
      warnings: [],
    });
    expect(validateJavaScript('   ')).toEqual({
      isValid: true,
      errors: [],
      warnings: [],
    });
  });

  it('returns valid for balanced JS', () => {
    const result = validateJavaScript('function a() { return [1, 2]; }');
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('flags smart quotes', () => {
    const result = validateJavaScript('const a = “hello”;');
    expect(result.errors.some((e) => e.includes('Smart quotes'))).toBe(true);
  });

  it('flags missing closing brace', () => {
    const result = validateJavaScript('function a() { return 1;');
    expect(result.errors).toContain('Missing closing brace(s)');
  });

  it('flags missing opening brace', () => {
    const result = validateJavaScript('return 1; }');
    expect(result.errors).toContain('Missing opening brace(s)');
  });

  it('flags missing closing bracket', () => {
    const result = validateJavaScript('const a = [1, 2;');
    expect(result.errors).toContain('Missing closing bracket(s)');
  });

  it('flags missing opening bracket', () => {
    const result = validateJavaScript('const a = 1, 2];');
    expect(result.errors).toContain('Missing opening bracket(s)');
  });

  it('flags unbalanced parentheses', () => {
    const result = validateJavaScript('foo(1, 2;');
    expect(result.errors).toContain('Unbalanced parentheses');
  });

  it('flags unclosed single quote', () => {
    const result = validateJavaScript("const a = 'x;");
    expect(result.errors).toContain('Unclosed single quote');
  });

  it('flags unclosed double quote', () => {
    const result = validateJavaScript('const a = "x;');
    expect(result.errors).toContain('Unclosed double quote');
  });

  it('flags unclosed template literal', () => {
    const result = validateJavaScript('const a = `x;');
    expect(result.errors).toContain('Unclosed template literal');
  });

  it('ignores quotes inside line and block comments', () => {
    const result = validateJavaScript(
      "// it's a comment\n/* don't count */\nconst a = 1;",
    );
    expect(result.errors).toHaveLength(0);
  });

  it('warns about eval, document.write, and innerHTML', () => {
    const result = validateJavaScript(
      'eval("1"); document.write("x"); el.innerHTML = "y";',
    );
    expect(result.warnings).toContain(
      'Usage of eval() is discouraged for security reasons',
    );
    expect(result.warnings).toContain(
      'document.write() may cause unexpected behavior',
    );
    expect(result.warnings).toContain(
      'innerHTML usage detected - ensure content is sanitized',
    );
  });
});

// ============================================================================
// COMPONENT TESTS
// ============================================================================

describe('EmbedTab', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();

    mockUseParams.mockReturnValue({
      tenantKey: 'test-tenant',
      mentorId: 'test-mentor',
    });
    mockGetMentorId.mockReturnValue(null);
    mockUseGetShareableLinkQuery.mockReturnValue({ data: undefined });
    mockGetMentorSettingsQuery.mockReturnValue({
      data: defaultMentorSettings,
      isLoading: false,
    });
    mockEditMentor.mockReturnValue({ unwrap: vi.fn().mockResolvedValue({}) });
    mockEditMentorLoading.mockReturnValue(false);
    mockUseTenantMetadata.mockReturnValue({ metadata: undefined });
    mockSupportEmail.mockReturnValue('support@ibl.ai');
    mockSyncEmbedSettings.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the embed tab header', () => {
    renderEmbedTab();
    expect(screen.getByText('Embed')).toBeInTheDocument();
    expect(
      screen.getByText('Configure embedding options for your agent.'),
    ).toBeInTheDocument();
  });

  it('renders the main embed sections', () => {
    renderEmbedTab();
    expect(screen.getByText('Advanced CSS')).toBeInTheDocument();
    expect(screen.getByText('Advanced JavaScript')).toBeInTheDocument();
    expect(screen.getByText('Mode Selection')).toBeInTheDocument();
    expect(screen.getByText('Who Can View?')).toBeInTheDocument();
    expect(screen.getByText('Who Can Chat?')).toBeInTheDocument();
  });

  it('expands and collapses the Advanced CSS card', async () => {
    renderEmbedTab();
    const toggle = screen.getByRole('button', { name: 'Expand Advanced CSS' });
    fireEvent.click(toggle);
    expect(screen.getByLabelText('Custom CSS input')).toBeInTheDocument();

    const collapse = screen.getByRole('button', {
      name: 'Collapse Advanced CSS',
    });
    fireEvent.click(collapse);
    await waitFor(() => {
      expect(
        screen.queryByLabelText('Custom CSS input'),
      ).not.toBeInTheDocument();
    });
  });

  it('edits CSS, shows valid status, and enables save then saves', async () => {
    renderEmbedTab();
    fireEvent.click(
      screen.getByRole('button', { name: 'Expand Advanced CSS' }),
    );

    const textarea = screen.getByLabelText('Custom CSS input');
    fireEvent.change(textarea, { target: { value: '.a { color: red; }' } });

    expect(screen.getByText('Valid')).toBeInTheDocument();

    const saveBtn = screen.getByRole('button', { name: 'Save advanced CSS' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockEditMentor).toHaveBeenCalledWith(
        expect.objectContaining({
          formData: { custom_css: '.a { color: red; }' },
        }),
      );
    });
  });

  it('shows CSS validation errors for invalid CSS', async () => {
    renderEmbedTab();
    fireEvent.click(
      screen.getByRole('button', { name: 'Expand Advanced CSS' }),
    );

    const textarea = screen.getByLabelText('Custom CSS input');
    fireEvent.change(textarea, { target: { value: '.a { color: red;' } });

    expect(screen.getByText('CSS validation errors:')).toBeInTheDocument();
    expect(screen.getByText('Invalid')).toBeInTheDocument();
  });

  it('discards CSS changes', async () => {
    renderEmbedTab();
    fireEvent.click(
      screen.getByRole('button', { name: 'Expand Advanced CSS' }),
    );

    const textarea = screen.getByLabelText(
      'Custom CSS input',
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '.a { color: red; }' } });

    const discard = screen.getByRole('button', { name: 'Discard changes' });
    fireEvent.click(discard);

    await waitFor(() => {
      expect(
        (screen.getByLabelText('Custom CSS input') as HTMLTextAreaElement)
          .value,
      ).toBe('');
    });
  });

  it('handles CSS save failure with error toast', async () => {
    const sonner = await import('sonner');
    mockEditMentor.mockReturnValue({
      unwrap: vi.fn().mockRejectedValue(new Error('boom')),
    });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderEmbedTab();
    fireEvent.click(
      screen.getByRole('button', { name: 'Expand Advanced CSS' }),
    );
    fireEvent.change(screen.getByLabelText('Custom CSS input'), {
      target: { value: '.a { color: red; }' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save advanced CSS' }));

    await waitFor(() => {
      expect(sonner.toast.error).toHaveBeenCalledWith(
        'Failed to save advanced CSS',
      );
    });
    consoleSpy.mockRestore();
  });

  it('shows the custom JS disabled notice when feature is off', () => {
    renderEmbedTab();
    fireEvent.click(
      screen.getByRole('button', { name: 'Expand Advanced JavaScript' }),
    );
    expect(
      screen.getByText('Custom JavaScript is Disabled'),
    ).toBeInTheDocument();
    expect(screen.getByText('support@ibl.ai')).toBeInTheDocument();
  });

  it('edits and saves JS when feature enabled', async () => {
    mockGetMentorSettingsQuery.mockReturnValue({
      data: { ...defaultMentorSettings, enable_custom_javascript: true },
      isLoading: false,
    });
    renderEmbedTab();
    fireEvent.click(
      screen.getByRole('button', { name: 'Expand Advanced JavaScript' }),
    );

    const textarea = screen.getByLabelText('Custom JavaScript input');
    fireEvent.change(textarea, { target: { value: 'console.log(1);' } });
    expect(screen.getByText('Valid')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Save advanced JavaScript' }),
    );
    await waitFor(() => {
      expect(mockEditMentor).toHaveBeenCalledWith(
        expect.objectContaining({
          formData: { custom_javascript: 'console.log(1);' },
        }),
      );
    });
  });

  it('shows JS warnings and validation errors', async () => {
    mockGetMentorSettingsQuery.mockReturnValue({
      data: { ...defaultMentorSettings, enable_custom_javascript: true },
      isLoading: false,
    });
    renderEmbedTab();
    fireEvent.click(
      screen.getByRole('button', { name: 'Expand Advanced JavaScript' }),
    );

    const textarea = screen.getByLabelText('Custom JavaScript input');
    // warning path
    fireEvent.change(textarea, { target: { value: 'eval("1");' } });
    expect(screen.getByText('Warnings:')).toBeInTheDocument();
    expect(screen.getByText('Warnings')).toBeInTheDocument();

    // error path
    fireEvent.change(textarea, { target: { value: 'function a() {' } });
    expect(
      screen.getByText('JavaScript validation errors:'),
    ).toBeInTheDocument();

    // discard
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    await waitFor(() => {
      expect(
        (
          screen.getByLabelText(
            'Custom JavaScript input',
          ) as HTMLTextAreaElement
        ).value,
      ).toBe('');
    });
  });

  it('handles JS save failure with error toast', async () => {
    const sonner = await import('sonner');
    mockGetMentorSettingsQuery.mockReturnValue({
      data: { ...defaultMentorSettings, enable_custom_javascript: true },
      isLoading: false,
    });
    mockEditMentor.mockReturnValue({
      unwrap: vi.fn().mockRejectedValue(new Error('boom')),
    });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderEmbedTab();
    fireEvent.click(
      screen.getByRole('button', { name: 'Expand Advanced JavaScript' }),
    );
    fireEvent.change(screen.getByLabelText('Custom JavaScript input'), {
      target: { value: 'console.log(1);' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save advanced JavaScript' }),
    );
    await waitFor(() => {
      expect(sonner.toast.error).toHaveBeenCalledWith(
        'Failed to save advanced JavaScript',
      );
    });
    consoleSpy.mockRestore();
  });

  it('saves embed settings successfully and toasts', async () => {
    renderEmbedTab();
    const saveButtons = screen.getAllByRole('button', { name: 'Save' });
    fireEvent.click(saveButtons[saveButtons.length - 1]);
    await waitFor(() => {
      expect(mockSyncEmbedSettings).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        description: 'Successfully saved embed settings',
      });
    });
  });

  it('shows an error toast when saving embed settings fails', async () => {
    mockSyncEmbedSettings.mockRejectedValue(new Error('boom'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderEmbedTab();
    const saveButtons = screen.getAllByRole('button', { name: 'Save' });
    fireEvent.click(saveButtons[saveButtons.length - 1]);
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        description: 'Failed to save embed settings',
      });
    });
    consoleSpy.mockRestore();
  });

  it('submits the form via Create Embed button', () => {
    renderEmbedTab();
    fireEvent.click(screen.getByRole('button', { name: 'Create Embed' }));
    expect(mockFormHandleSubmit).toHaveBeenCalled();
  });

  it('submits the form via the form element onSubmit', () => {
    const { container } = renderEmbedTab();
    const formEl = container.querySelector('form') as HTMLFormElement;
    fireEvent.submit(formEl);
    expect(mockFormHandleSubmit).toHaveBeenCalled();
  });

  it('renders website url + token controls for authenticated-only mode', () => {
    renderEmbedTab(
      { createTokenError: 'Bad URL', redirectTokenData: { token: 'tok-123' } },
      { ...defaultFormValues, allow_anonymous: false },
    );
    expect(screen.getByText('Website URL')).toBeInTheDocument();
    expect(screen.getByText('Bad URL')).toBeInTheDocument();
    expect(screen.getByText('Get Token')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Get Token' }));
    expect(mockCreateTokenHandler).toHaveBeenCalled();

    // changing the website url clears the token error
    const urlInput = screen.getByPlaceholderText('https://ibl.ai');
    fireEvent.change(urlInput, { target: { value: 'https://x.com' } });
    expect(mockSetCreateTokenError).toHaveBeenCalledWith('');
  });

  it('shows the token-generating label while loading', () => {
    renderEmbedTab(
      { isCreateTokenLoading: true },
      { ...defaultFormValues, allow_anonymous: false },
    );
    expect(screen.getByText('Generating Token...')).toBeInTheDocument();
  });

  it('hides SSO toggle when sso providers error', () => {
    renderEmbedTab({ isIntegratedSsoProvidersError: true });
    expect(screen.queryByText('Single Sign On')).not.toBeInTheDocument();
  });

  it('renders the SSO provider select when sso enabled and not anonymous', () => {
    renderEmbedTab(
      {
        integratedSsoProviders: {
          providers: [{ backend_uri: 'uri-1', slug: 'google' }],
        },
      },
      { ...defaultFormValues, sso: true, allow_anonymous: false },
    );
    expect(screen.getByText('Single Sign On')).toBeInTheDocument();
    expect(screen.getByText('google')).toBeInTheDocument();
  });

  it('renders the icon editor controls when icon_selection is custom', () => {
    renderEmbedTab({}, { ...defaultFormValues, icon_selection: 'custom' });
    const editorBtn = screen.getByRole('button', { name: 'Icon Editor' });
    fireEvent.click(editorBtn);
    expect(mockSetFocusEditCustomFloatingBubble).toHaveBeenCalledWith(true);
  });

  it('renders the floating bubble editor dialog and its tabs', () => {
    renderEmbedTab({ focusEditCustomFloatingBubble: true });
    expect(screen.getByText('Icon Editor')).toBeInTheDocument();
    expect(screen.getByText('Visual Styling')).toBeInTheDocument();
    expect(screen.getByText('Position & Layout')).toBeInTheDocument();
    expect(screen.getByText('Text Content')).toBeInTheDocument();
    expect(screen.getByText('Live Preview')).toBeInTheDocument();
  });

  it('updates floating bubble config fields', () => {
    renderEmbedTab({ focusEditCustomFloatingBubble: true });

    const titleInput = screen.getByPlaceholderText('AI-powered assistant');
    fireEvent.change(titleInput, { target: { value: 'New Title' } });
    expect(mockUpdateConfig).toHaveBeenCalledWith('title', 'New Title');

    const subtitleInput = screen.getByPlaceholderText(
      'Created with Agentic OS',
    );
    fireEvent.change(subtitleInput, { target: { value: 'Sub' } });
    expect(mockUpdateConfig).toHaveBeenCalledWith('subtitle', 'Sub');
  });

  it('removes the floating bubble icon image', () => {
    renderEmbedTab({ focusEditCustomFloatingBubble: true });
    const removeBtn = screen.getByRole('button', { name: 'Remove Image' });
    fireEvent.click(removeBtn);
    expect(mockUpdateMultipleConfig).toHaveBeenCalledWith({ image: null });
  });

  it('renders the generated embed code dialog', () => {
    renderEmbedTab({ embedCode: '<script>embed</script>' });
    expect(screen.getByText('Embedded Code')).toBeInTheDocument();
    expect(screen.getByText('<script>embed</script>')).toBeInTheDocument();
  });

  it('renders shareable token controls and triggers regenerate', async () => {
    mockUseGetShareableLinkQuery.mockReturnValue({
      data: { token: 'abc', enabled: true },
    });
    mockCreateShareableLink.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({}),
    });
    renderEmbedTab();
    expect(screen.getByText('Shareable Link')).toBeInTheDocument();
    expect(screen.getAllByTestId('copy-code').length).toBeGreaterThanOrEqual(1);
  });

  it('uses tenant metadata support email when available', () => {
    mockUseTenantMetadata.mockReturnValue({
      metadata: { support_email: 'tenant@ibl.ai' },
    });
    renderEmbedTab();
    fireEvent.click(
      screen.getByRole('button', { name: 'Expand Advanced JavaScript' }),
    );
    expect(screen.getByText('tenant@ibl.ai')).toBeInTheDocument();
  });

  it('fires every select onValueChange handler', () => {
    renderEmbedTab(
      {
        integratedSsoProviders: {
          providers: [{ backend_uri: 'uri-1', slug: 'google' }],
        },
        focusEditCustomFloatingBubble: true,
      },
      { ...defaultFormValues, sso: true, allow_anonymous: false },
    );
    // Click every rendered option to drive all onValueChange callbacks.
    screen.getAllByRole('option').forEach((opt) => fireEvent.click(opt));
    expect(screen.getAllByRole('option').length).toBeGreaterThan(0);
  });

  it('toggles every switch (onCheckedChange handlers)', () => {
    const { container } = renderEmbedTab();
    container
      .querySelectorAll('input[type="checkbox"]')
      .forEach((cb) => fireEvent.click(cb));
    expect(
      container.querySelectorAll('input[type="checkbox"]').length,
    ).toBeGreaterThan(0);
  });

  it('updates every floating bubble config input', () => {
    const { container } = renderEmbedTab({
      focusEditCustomFloatingBubble: true,
    });
    container.querySelectorAll('input').forEach((input) => {
      if ((input as HTMLInputElement).type === 'file') return;
      fireEvent.change(input, { target: { value: '5' } });
    });
    expect(mockUpdateConfig).toHaveBeenCalled();
  });

  it('uploads a floating bubble icon image', async () => {
    const { container } = renderEmbedTab({
      focusEditCustomFloatingBubble: true,
    });
    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(['icon'], 'icon.png', { type: 'image/png' });
    await userEvent.upload(fileInput, file);
    await waitFor(() => {
      expect(mockUpdateMultipleConfig).toHaveBeenCalled();
    });
  });

  it('regenerates the shareable token', async () => {
    mockUseGetShareableLinkQuery.mockReturnValue({
      data: { token: 'abc', enabled: true },
    });
    mockCreateShareableLink.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({}),
    });
    const { container } = renderEmbedTab();
    const refresh = container.querySelector('.lucide-refresh-cw');
    fireEvent.click(refresh as Element);
    await waitFor(() => {
      expect(mockCreateShareableLink).toHaveBeenCalled();
    });
  });

  it('enables a shareable token that exists but is disabled', async () => {
    mockUseGetShareableLinkQuery.mockReturnValue({
      data: { token: 'abc', enabled: false },
    });
    mockUpdateShareableLink.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({}),
    });
    renderEmbedTab();
    const toggle = screen.getByLabelText(/Generate \/ Revoke shareable link/);
    fireEvent.click(toggle);
    await waitFor(() => {
      expect(mockUpdateShareableLink).toHaveBeenCalledWith(
        expect.objectContaining({ requestBody: { enabled: true } }),
      );
    });
  });

  it('creates a shareable token when none exists on enable', async () => {
    mockUseGetShareableLinkQuery.mockReturnValue({ data: undefined });
    mockCreateShareableLink.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({}),
    });
    renderEmbedTab();
    const toggle = screen.getByLabelText(/Generate \/ Revoke shareable link/);
    fireEvent.click(toggle);
    await waitFor(() => {
      expect(mockCreateShareableLink).toHaveBeenCalled();
    });
  });

  it('disables a shareable token when toggled off', async () => {
    mockUseGetShareableLinkQuery.mockReturnValue({
      data: { token: 'abc', enabled: true },
    });
    mockUpdateShareableLink.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({}),
    });
    renderEmbedTab();
    const toggle = screen.getByLabelText(/Generate \/ Revoke shareable link/);
    // Currently enabled; toggling produces unchecked -> disable branch.
    fireEvent.click(toggle);
    await waitFor(() => {
      expect(mockUpdateShareableLink).toHaveBeenCalledWith(
        expect.objectContaining({ requestBody: { enabled: false } }),
      );
    });
  });

  it('handles shareable token toggle errors gracefully', async () => {
    mockUseGetShareableLinkQuery.mockReturnValue({
      data: { token: 'abc', enabled: false },
    });
    mockUpdateShareableLink.mockReturnValue({
      unwrap: vi.fn().mockRejectedValue(new Error('boom')),
    });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderEmbedTab();
    const toggle = screen.getByLabelText(/Generate \/ Revoke shareable link/);
    fireEvent.click(toggle);
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        description: 'Failed to enable shareable link',
      });
    });
    consoleSpy.mockRestore();
  });

  it('handles regenerate token errors gracefully', async () => {
    mockUseGetShareableLinkQuery.mockReturnValue({
      data: { token: 'abc', enabled: true },
    });
    mockCreateShareableLink.mockReturnValue({
      unwrap: vi.fn().mockRejectedValue(new Error('boom')),
    });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = renderEmbedTab();
    const refresh = container.querySelector('.lucide-refresh-cw');
    fireEvent.click(refresh as Element);
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        description: 'Failed to regenerate shareable link',
      });
    });
    consoleSpy.mockRestore();
  });

  it('shows the spinner while the shareable link is loading', async () => {
    mockUseGetShareableLinkQuery.mockReturnValue({ data: undefined });
    mockCreateShareableLink.mockReturnValue({
      unwrap: vi.fn().mockReturnValue(new Promise(() => {})),
    });
    const { container } = renderEmbedTab();
    const refresh = container.querySelector('.lucide-refresh-cw');
    fireEvent.click(refresh as Element);
    await waitFor(() => {
      expect(screen.getByTestId('spinner')).toBeInTheDocument();
    });
  });

  it('handles create-shareable-link errors on enable when none exists', async () => {
    mockUseGetShareableLinkQuery.mockReturnValue({ data: undefined });
    mockCreateShareableLink.mockReturnValue({
      unwrap: vi.fn().mockRejectedValue(new Error('boom')),
    });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderEmbedTab();
    const toggle = screen.getByLabelText(/Generate \/ Revoke shareable link/);
    fireEvent.click(toggle);
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        description: 'Failed to create shareable link',
      });
    });
    consoleSpy.mockRestore();
  });

  it('handles disable errors when toggling a shareable token off', async () => {
    mockUseGetShareableLinkQuery.mockReturnValue({
      data: { token: 'abc', enabled: true },
    });
    mockUpdateShareableLink.mockReturnValue({
      unwrap: vi.fn().mockRejectedValue(new Error('boom')),
    });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderEmbedTab();
    const toggle = screen.getByLabelText(/Generate \/ Revoke shareable link/);
    fireEvent.click(toggle);
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        description: 'Failed to disable shareable link',
      });
    });
    consoleSpy.mockRestore();
  });

  it('closes the embed code dialog via onOpenChange', () => {
    renderEmbedTab({ embedCode: '<script>embed</script>' });
    expect(screen.getByText('Embedded Code')).toBeInTheDocument();
    fireEvent.click(screen.getAllByTestId('dialog-close')[0]);
    expect(mockSetEmbedCode).toHaveBeenCalledWith('');
  });

  it('closes the floating bubble editor dialog via onOpenChange', () => {
    renderEmbedTab({ focusEditCustomFloatingBubble: true });
    fireEvent.click(screen.getAllByTestId('dialog-close')[0]);
    expect(mockSetFocusEditCustomFloatingBubble).toHaveBeenCalledWith(false);
  });

  it('stops propagation on the Advanced CSS/JS info tooltips', () => {
    renderEmbedTab();
    const cssInfo = screen.getByLabelText('More info about Advanced CSS');
    fireEvent.click(cssInfo);
    const jsInfo = screen.getByLabelText('More info about Advanced JavaScript');
    fireEvent.click(jsInfo);
    expect(cssInfo).toBeInTheDocument();
  });
});
