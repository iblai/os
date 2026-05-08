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
  useGetClawMentorConfigQuery: () => ({
    data: null,
    isError: false,
    isLoading: false,
  }),
  useUpdateClawMentorConfigMutation: () => [
    () => Promise.resolve({}),
    { isLoading: false },
  ],
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

const PageModule = await import('../page');
const Page = PageModule.default;

describe('main chat page', () => {
  it('should export dynamic config', () => {
    expect(PageModule.dynamic).toBe('force-dynamic');
  });

  it('should render Chat component', () => {
    const { getByTestId } = render(<Page />);
    expect(getByTestId('chat')).toBeInTheDocument();
  });
});
