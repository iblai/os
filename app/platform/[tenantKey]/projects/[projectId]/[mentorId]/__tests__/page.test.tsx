import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockUseParams = vi.fn();
const mockReplace = vi.fn();
let mockTokenParam: string | null = null;
vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => ({
    get: (key: string) => (key === 'token' ? mockTokenParam : null),
  }),
}));

vi.mock('@/components/error-boundary', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('@/components/document-sidebar', () => ({
  DocumentSidebar: () => <div data-testid="document-sidebar" />,
}));

vi.mock('@/components/chat', () => ({
  Chat: () => <div data-testid="chat" />,
}));

vi.mock('@iblai/iblai-js/web-utils', () => ({
  chatActions: {
    setShouldStartNewChat: vi.fn(),
    updateToken: vi.fn(),
    updateTokenEnabled: vi.fn(),
  },
  selectSessionId: vi.fn(),
  useTenantMetadata: () => ({ metadata: {} }),
}));

const mockPublicUnwrap = vi.fn();
const mockGetShareableTokenPublic = vi.fn(() => ({ unwrap: mockPublicUnwrap }));
let mockPublicData: { token: string } | undefined;
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useLazyGetShareableLinkQuery: () => [vi.fn(), { data: undefined }],
  useLazyGetShareableLinkPublicQuery: () => [
    mockGetShareableTokenPublic,
    { data: mockPublicData },
  ],
}));

vi.mock('@/hooks/use-is-preview-mode', () => ({
  useIsPreviewMode: () => false,
}));

vi.mock('@/hooks/use-chat-mode', () => ({
  useChatMode: () => 'default',
}));

vi.mock('@/lib/hooks', () => ({
  useAppDispatch: () => vi.fn(),
  useAppSelector: () => undefined,
}));

let mockIsMobile = false;
vi.mock('react-responsive', () => ({
  useMediaQuery: () => mockIsMobile,
}));

const mockToastError = vi.fn();
vi.mock('sonner', () => ({
  toast: { error: (...args: unknown[]) => mockToastError(...args) },
}));

vi.mock('@/lib/config', () => ({
  config: { supportEmail: () => 'support@test.com' },
}));

vi.mock('../../../[mentorId]/page.css', () => ({}));

const PageModule = await import('../page');
const Page = PageModule.default;

describe('projects [mentorId] page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({
      tenantKey: 'test-tenant',
      mentorId: 'mentor-123',
    });
    mockTokenParam = null;
    mockPublicData = undefined;
    mockIsMobile = false;
  });

  it('should export dynamic config', () => {
    expect(PageModule.dynamic).toBe('force-dynamic');
  });

  it('should export page component', () => {
    expect(Page).toBeDefined();
    expect(typeof Page).toBe('function');
  });

  it('renders the chat when a mentorId is present', () => {
    render(<Page />);
    expect(screen.getByTestId('chat')).toBeInTheDocument();
  });

  it('redirects to projects and renders no chat when mentorId is empty', () => {
    mockUseParams.mockReturnValue({ tenantKey: 'test-tenant', mentorId: '' });
    render(<Page />);
    expect(mockReplace).toHaveBeenCalledWith('/platform/test-tenant/projects');
    expect(screen.queryByTestId('chat')).not.toBeInTheDocument();
  });

  it('does not redirect when mentorId is present', () => {
    render(<Page />);
    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.getByTestId('chat')).toBeInTheDocument();
  });

  it('does not render the document sidebar on mobile', () => {
    mockIsMobile = true;
    render(<Page />);
    expect(screen.getByTestId('chat')).toBeInTheDocument();
    expect(screen.queryByTestId('document-sidebar')).not.toBeInTheDocument();
  });

  it('shows a toast when a shareable token resolves as disabled', async () => {
    mockTokenParam = 'tok-123';
    mockPublicData = { token: 'public-tok' };
    mockPublicUnwrap.mockResolvedValueOnce({ enabled: false });

    render(<Page />);

    await vi.waitFor(() => {
      expect(mockGetShareableTokenPublic).toHaveBeenCalled();
      expect(mockToastError).toHaveBeenCalled();
    });
  });

  it('does not toast when a shareable token resolves as enabled', async () => {
    mockTokenParam = 'tok-456';
    mockPublicUnwrap.mockResolvedValueOnce({ enabled: true });

    render(<Page />);

    await vi.waitFor(() => {
      expect(mockGetShareableTokenPublic).toHaveBeenCalled();
    });
    expect(mockToastError).not.toHaveBeenCalled();
  });
});
