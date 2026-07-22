import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

// Mock all dependencies
vi.mock('react-responsive', () => ({
  useMediaQuery: vi.fn(() => false),
}));

vi.mock('@iblai/iblai-js/web-utils', () => ({
  chatActions: {
    setShouldStartNewChat: vi.fn(),
    updateToken: vi.fn(),
  },
  selectSessionId: vi.fn(),
  useTenantMetadata: vi.fn(() => ({ metadata: {} })),
}));

vi.mock('@/components/error-boundary', () => ({
  default: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/document-sidebar', () => ({
  DocumentSidebar: () => <div data-testid="document-sidebar" />,
}));

vi.mock('@/components/chat', () => ({
  Chat: () => <div data-testid="chat" />,
}));

vi.mock('@/lib/hooks', () => ({
  useAppDispatch: () => vi.fn(),
  useAppSelector: () => 'session-123',
}));

vi.mock('@/hooks/use-is-preview-mode', () => ({
  useIsPreviewMode: () => false,
}));

vi.mock('@/hooks/use-chat-mode', () => ({
  useChatMode: () => 'chat',
}));

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetMentorPublicSettingsQuery: vi.fn(() => ({ data: null })),
  useLazyGetShareableLinkPublicQuery: vi.fn(() => [vi.fn(), { data: null }]),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ tenantKey: 'test-tenant', mentorId: 'test-mentor' }),
  useSearchParams: () => ({ get: () => null }),
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => 'testuser',
  useUserTenants: () => ({ userTenants: [] }),
}));

vi.mock('@/lib/utils', () => ({
  isLoggedIn: () => true,
}));

vi.mock('@/lib/constants', () => ({
  ANONYMOUS_USERNAME: 'anonymous',
}));

vi.mock('@/hooks/use-tauri-offline', () => ({
  useTauriOffline: vi.fn(),
  isTauriOfflineMode: () => false,
  isOfflineServerOrigin: () => false,
}));

vi.mock('@/types/tauri', () => ({
  isTauriApp: () => false,
}));

// The server page wrapper pulls in the SEO layer; stub it so importing the
// route module (for the `dynamic` export) doesn't require server APIs.
vi.mock('@/lib/seo-mentor', () => ({
  buildMentorMetadata: vi.fn(),
  mentorJsonLd: vi.fn(async () => null),
}));

vi.mock('@/components/seo/json-ld', () => ({
  JsonLd: () => null,
}));

const PageModule = await import('../page');
const MentorPageContent = (await import('../mentor-page-content')).default;

describe('main chat page', () => {
  it('should export dynamic config', () => {
    expect(PageModule.dynamic).toBe('force-dynamic');
  });

  it('renders the Chat UI', () => {
    const { getByTestId } = render(<MentorPageContent />);
    expect(getByTestId('chat')).toBeInTheDocument();
  });
});
