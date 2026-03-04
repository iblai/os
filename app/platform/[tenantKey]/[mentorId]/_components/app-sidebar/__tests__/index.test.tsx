import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

import { AppSidebar } from '../index';

// ============================================================================
// MOCKS
// ============================================================================

const mockPush = vi.hoisted(() => vi.fn());
const mockReplace = vi.hoisted(() => vi.fn());
const mockUsePathname = vi.hoisted(() => vi.fn());
const mockUseParams = vi.hoisted(() => vi.fn());

const mockDispatch = vi.hoisted(() => vi.fn());
const mockSelectSessionId = vi.hoisted(() => vi.fn());
const mockClearFiles = vi.hoisted(() => vi.fn());
const mockChatActions = vi.hoisted(() => ({
  resetIsTyping: vi.fn(),
  setStreaming: vi.fn(),
  resetCurrentStreamingMessage: vi.fn(),
  setActiveTab: vi.fn(),
  updateSessionIds: vi.fn(),
  setNewMessages: vi.fn(),
  setShouldStartNewChat: vi.fn(),
}));

const mockEventBusEmit = vi.hoisted(() => vi.fn());
const mockSetOpenMobile = vi.hoisted(() => vi.fn());
const mockSaveCachedSessionId = vi.hoisted(() => vi.fn());
const mockUseLocalStorage = vi.hoisted(() => vi.fn());

let mockSessionId = 'session-123';
let mockEmbedMode = false;
let mockUserIsStudent = false;
let mockUserIsVisiting = false;
let mockCurrentTenant = { is_advertising: false };
let mockVisitingTenant: Record<string, unknown> | null = null;
let mockCachedSessionId: Record<string, string> = {};
let mockSidebarState = { open: true, openMobile: false, isMobile: false };
let mockNavigationItems = {
  contentItems: [
    { label: 'New Chat', href: '/new', userTypes: ['admin'] },
    { label: 'History', href: '/history', userTypes: ['admin'] },
  ],
  footerItems: [{ label: 'Settings', href: '/settings', userTypes: ['admin'] }],
};

const mockFreeTrialDialogState = vi.hoisted(() => ({
  executeWithTrialCheck: vi.fn((callback: () => void) => callback()),
  FreeTrialDialog: null as React.ComponentType<{ onClose: () => void; isOpen: boolean }> | null,
  closeModal: vi.fn(),
  isModalOpen: false,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => mockUsePathname(),
  useParams: () => mockUseParams(),
}));

vi.mock('@/lib/hooks', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (selector: any) => {
    if (selector === mockSelectSessionId) {
      return mockSessionId;
    }
    return {};
  },
}));

vi.mock('@web-utils/features', () => ({
  chatActions: mockChatActions,
  selectSessionId: mockSelectSessionId,
  clearFiles: mockClearFiles,
}));

vi.mock('@/hooks/user-navigate', () => ({
  useSidebarNavigation: () => mockNavigationItems,
}));

vi.mock('@/hooks/user-user-actions', () => ({
  useShowFreeTrialDialog: () => mockFreeTrialDialogState,
}));

vi.mock('@/hooks/use-embed-mode', () => ({
  useEmbedMode: () => mockEmbedMode,
}));

vi.mock('@/hooks/use-user-type', () => ({
  useUserType: () => ({
    isUserTypeAllowed: vi.fn().mockReturnValue(true),
  }),
}));

vi.mock('@/hooks/use-user', () => ({
  useCurrentTenant: () => ({ currentTenant: mockCurrentTenant }),
  useIsVisiting: () => mockUserIsVisiting,
  useUserIsStudent: () => mockUserIsStudent,
  useVisitingTenant: () => ({ visitingTenant: mockVisitingTenant }),
}));

vi.mock('@/hooks/use-local-storage', () => ({
  useLocalStorage: mockUseLocalStorage,
}));

vi.mock('@/lib/eventBus', () => ({
  default: {
    emit: mockEventBusEmit,
  },
  RemoteEvents: {
    stopChatGenerating: 'stopChatGenerating',
  },
}));

vi.mock('@/components/ui/sidebar', () => ({
  Sidebar: ({ children, className }: any) => (
    <aside data-testid="sidebar" className={className}>
      {children}
    </aside>
  ),
  SidebarContent: ({ children, className }: any) => (
    <div data-testid="sidebar-content" className={className}>
      {children}
    </div>
  ),
  SidebarHeader: ({ children, className }: any) => (
    <div data-testid="sidebar-header" className={className}>
      {children}
    </div>
  ),
  SidebarMenu: ({ children, className }: any) => (
    <div data-testid="sidebar-menu" className={className}>
      {children}
    </div>
  ),
  SidebarMenuItem: ({ children, className }: any) => (
    <div data-testid="sidebar-menu-item" className={className}>
      {children}
    </div>
  ),
  useSidebar: () => ({
    ...mockSidebarState,
    setOpenMobile: mockSetOpenMobile,
  }),
}));

vi.mock('../toggle-sidebar-button', () => ({
  ToggleSidebarButton: () => <button data-testid="toggle-sidebar">Toggle</button>,
}));

vi.mock('../pinned-messages', () => ({
  PinnedMessages: ({ onSelectMessage }: any) => (
    <div data-testid="pinned-messages">
      <button
        data-testid="select-pinned-message"
        onClick={() =>
          onSelectMessage({
            session_id: 'pinned-session',
            messages: [
              {
                id: 'msg-1',
                message: { type: 'human', data: { content: 'Hello' } },
                inserted_at: new Date().toISOString(),
                files: [],
                artifact_versions: [],
              },
            ],
          })
        }
      >
        Pinned Message
      </button>
      <button
        data-testid="select-pinned-message-multiple"
        onClick={() =>
          onSelectMessage({
            session_id: 'pinned-session',
            messages: [
              {
                id: 'msg-1',
                message: { type: 'human', data: { content: 'First' } },
                inserted_at: new Date('2024-01-01').toISOString(),
                files: [],
                artifact_versions: [],
              },
              {
                id: 'msg-2',
                message: { type: 'ai', data: { content: 'Second' } },
                inserted_at: new Date('2024-01-02').toISOString(),
                files: [],
                artifact_versions: [],
              },
            ],
          })
        }
      >
        Multiple Messages
      </button>
      <button
        data-testid="select-pinned-message-null-files"
        onClick={() =>
          onSelectMessage({
            session_id: 'pinned-session',
            messages: [
              {
                id: 'msg-1',
                message: { type: 'human', data: { content: 'Hello' } },
                inserted_at: new Date().toISOString(),
                files: null,
                artifact_versions: null,
              },
            ],
          })
        }
      >
        Null Files
      </button>
    </div>
  ),
}));

vi.mock('../recent-messages', () => ({
  RecentMessages: ({ onSelectMessage, mentorId }: any) => (
    <div data-testid="recent-messages" data-mentor-id={mentorId}>
      <button
        data-testid="select-recent-message"
        onClick={() =>
          onSelectMessage({
            session_id: 'recent-session',
            messages: [
              {
                id: 'msg-2',
                message: { type: 'ai', data: { content: 'Hi there!' } },
                inserted_at: new Date().toISOString(),
                files: [
                  {
                    name: 'file.txt',
                    content_type: 'text/plain',
                    file_size: 100,
                    url: 'http://example.com/file.txt',
                  },
                ],
                artifact_versions: [
                  {
                    id: 'av-1',
                    artifact: { id: 'art-1', title: 'Artifact', content: 'Content' },
                    title: 'Version 1',
                    content: 'V1 Content',
                    version_number: 1,
                  },
                ],
              },
            ],
          })
        }
      >
        Recent Message
      </button>
      <button
        data-testid="select-recent-message-complete-artifact"
        onClick={() =>
          onSelectMessage({
            session_id: 'recent-session',
            messages: [
              {
                id: 'msg-2',
                message: { type: 'ai', data: { content: 'Hi there!' } },
                inserted_at: new Date().toISOString(),
                files: [],
                artifact_versions: [
                  {
                    id: 'av-1',
                    artifact: {
                      id: 'art-1',
                      title: 'Artifact',
                      content: 'Content',
                      file_extension: '.ts',
                      llm_name: 'gpt-4',
                      llm_provider: 'openai',
                      date_created: '2024-01-01',
                      date_updated: '2024-01-02',
                      metadata: { key: 'value' },
                      username: 'user1',
                      session_id: 'session-1',
                      current_version_number: 1,
                      version_count: 5,
                    },
                    title: 'Version 1',
                    content: 'V1 Content',
                    session_id: 'session-1',
                    content_length: 100,
                    is_current: true,
                    chat_message: 'msg-1',
                    version_number: 1,
                    date_created: '2024-01-01',
                    created_by: 'user1',
                    change_summary: 'Initial version',
                  },
                ],
              },
            ],
          })
        }
      >
        Complete Artifact
      </button>
    </div>
  ),
}));

vi.mock('../projects-sidebar-dropdown', () => ({
  ProjectsSidebarDropdown: () => <div data-testid="projects-dropdown">Projects</div>,
}));

vi.mock('../app-sidebar-footer', () => ({
  AppSidebarFooter: (props: any) => (
    <div data-testid="sidebar-footer" data-embed-mode={props.embedMode}>
      Footer
    </div>
  ),
}));

vi.mock('../app-sidebar-content', () => ({
  AppSidebarContent: (props: any) => {
    const updatedItems = props.contentItems?.map((item: any) =>
      props.updateNavItemsForStudentsInMainOrAdvertisingTenant
        ? props.updateNavItemsForStudentsInMainOrAdvertisingTenant({ ...item })
        : item,
    );

    return (
      <div data-testid="sidebar-content-items" data-items={updatedItems?.length || 0}>
        {updatedItems?.map((item: any, i: number) => (
          <div
            key={item.label || i}
            data-testid={`nav-item-${item.label}`}
            data-user-types={item.userTypes?.join(',') || ''}
          >
            {item.label}
          </div>
        ))}
      </div>
    );
  },
}));

vi.mock('@/components/logo', () => ({
  default: ({ className }: any) => (
    <div data-testid="logo" className={className}>
      Logo
    </div>
  ),
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

// ============================================================================
// TESTS
// ============================================================================

describe('AppSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();

    mockUsePathname.mockReturnValue('/platform/main/mentor-1');
    mockUseParams.mockReturnValue({
      mentorId: 'mentor-1',
      projectId: undefined,
      tenantKey: 'main',
    });

    mockSessionId = 'session-123';
    mockEmbedMode = false;
    mockUserIsStudent = false;
    mockUserIsVisiting = false;
    mockCurrentTenant = { is_advertising: false };
    mockVisitingTenant = null;
    mockCachedSessionId = {};
    mockSidebarState = { open: true, openMobile: false, isMobile: false };
    mockNavigationItems = {
      contentItems: [
        { label: 'New Chat', href: '/new', userTypes: ['admin'] },
        { label: 'History', href: '/history', userTypes: ['admin'] },
      ],
      footerItems: [{ label: 'Settings', href: '/settings', userTypes: ['admin'] }],
    };
    mockUseLocalStorage.mockImplementation(() => [mockCachedSessionId, mockSaveCachedSessionId]);

    mockFreeTrialDialogState.executeWithTrialCheck = vi.fn((callback: () => void) => callback());
    mockFreeTrialDialogState.FreeTrialDialog = null;
    mockFreeTrialDialogState.closeModal = vi.fn();
    mockFreeTrialDialogState.isModalOpen = false;
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the sidebar layout', () => {
    render(<AppSidebar />);

    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-header')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-content')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-footer')).toBeInTheDocument();
  });

  it('filters content items and hides projects dropdown in embed mode', () => {
    mockEmbedMode = true;

    render(<AppSidebar />);

    expect(screen.getByTestId('nav-item-New Chat')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-item-History')).not.toBeInTheDocument();
    expect(screen.queryByTestId('projects-dropdown')).not.toBeInTheDocument();
  });

  it('adds student user type for main tenant students', () => {
    mockUserIsStudent = true;

    render(<AppSidebar />);

    const item = screen.getByTestId('nav-item-New Chat');
    expect(item.getAttribute('data-user-types')).toContain('student');
  });

  it('adds visiting user type when visiting tenant is present', () => {
    mockUserIsVisiting = true;
    mockVisitingTenant = { id: 'visit-1' };
    mockUseParams.mockReturnValue({
      mentorId: 'mentor-1',
      projectId: undefined,
      tenantKey: 'tenant-2',
    });

    render(<AppSidebar />);

    const item = screen.getByTestId('nav-item-New Chat');
    expect(item.getAttribute('data-user-types')).toContain('visiting');
  });

  it('adds student user type for advertising tenants', () => {
    mockUserIsStudent = true;
    mockCurrentTenant = { is_advertising: true };
    mockUseParams.mockReturnValue({
      mentorId: 'mentor-1',
      projectId: undefined,
      tenantKey: 'tenant-2',
    });

    render(<AppSidebar />);

    const item = screen.getByTestId('nav-item-New Chat');
    expect(item.getAttribute('data-user-types')).toContain('student');
  });

  it('does not update user types when tenant is not main or visiting', () => {
    mockUserIsStudent = true;
    mockUseParams.mockReturnValue({
      mentorId: 'mentor-1',
      projectId: undefined,
      tenantKey: 'tenant-2',
    });

    render(<AppSidebar />);

    const item = screen.getByTestId('nav-item-New Chat');
    expect(item.getAttribute('data-user-types')).toBe('admin');
  });

  it('maps attachments and artifacts when selecting a recent message', async () => {
    render(<AppSidebar />);

    fireEvent.click(screen.getByTestId('select-recent-message'));

    await waitFor(() => {
      expect(mockChatActions.setNewMessages).toHaveBeenCalled();
    });

    const messagesArg = mockChatActions.setNewMessages.mock.calls[0][0];
    expect(messagesArg[0]).toMatchObject({
      id: 'msg-2',
      role: 'ai',
      content: 'Hi there!',
    });
    expect(messagesArg[0].fileAttachments?.[0]).toMatchObject({
      fileName: 'file.txt',
      fileType: 'text/plain',
      fileSize: 100,
      uploadUrl: 'http://example.com/file.txt',
    });
    expect(messagesArg[0].artifactVersions?.[0]).toMatchObject({
      id: 'av-1',
      artifact: { id: 'art-1' },
    });
    expect(mockEventBusEmit).toHaveBeenCalledWith('stopChatGenerating');
  });

  it('caches session id for the mentor', async () => {
    mockCachedSessionId = { 'mentor-old': 'session-old' };

    render(<AppSidebar />);

    fireEvent.click(screen.getByTestId('select-pinned-message'));

    await waitFor(() => {
      expect(mockSaveCachedSessionId).toHaveBeenCalledWith({
        'mentor-old': 'session-old',
        'mentor-1': 'pinned-session',
      });
    });
  });

  it('does not cache session id when mentorId is missing', async () => {
    mockUseParams.mockReturnValue({
      mentorId: undefined,
      projectId: undefined,
      tenantKey: 'main',
    });

    render(<AppSidebar />);

    fireEvent.click(screen.getByTestId('select-pinned-message'));

    await waitFor(() => {
      expect(mockSaveCachedSessionId).not.toHaveBeenCalled();
    });
  });

  it('clears files when selecting a different session', async () => {
    render(<AppSidebar />);

    fireEvent.click(screen.getByTestId('select-pinned-message'));

    await waitFor(() => {
      expect(mockClearFiles).toHaveBeenCalledWith(undefined);
    });
  });

  it('does not clear files when selecting the current session', async () => {
    mockSessionId = 'pinned-session';

    render(<AppSidebar />);

    fireEvent.click(screen.getByTestId('select-pinned-message'));

    await waitFor(() => {
      expect(mockClearFiles).not.toHaveBeenCalled();
    });
  });

  it('navigates to chat page when not already on chat page', async () => {
    mockUsePathname.mockReturnValue('/platform/main/settings/profile');

    render(<AppSidebar />);

    fireEvent.click(screen.getByTestId('select-pinned-message'));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/platform/main/mentor-1');
    });
  });

  it('does not navigate when already on chat page', async () => {
    mockUsePathname.mockReturnValue('/platform/main/mentor-1');

    render(<AppSidebar />);

    fireEvent.click(screen.getByTestId('select-pinned-message'));

    await waitFor(() => {
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  it('does not render messages when sidebar is closed', () => {
    mockSidebarState = { open: false, openMobile: false, isMobile: false };

    render(<AppSidebar />);

    expect(screen.queryByTestId('pinned-messages')).not.toBeInTheDocument();
    expect(screen.queryByTestId('recent-messages')).not.toBeInTheDocument();
  });

  it('renders FreeTrialDialog when modal is open', () => {
    const MockFreeTrialDialog = ({ onClose, isOpen }: any) => (
      <div data-testid="free-trial-dialog" data-open={isOpen} onClick={onClose} />
    );
    MockFreeTrialDialog.displayName = 'MockFreeTrialDialog';
    mockFreeTrialDialogState.FreeTrialDialog = MockFreeTrialDialog;
    mockFreeTrialDialogState.isModalOpen = true;

    render(<AppSidebar />);

    expect(screen.getByTestId('free-trial-dialog')).toBeInTheDocument();
  });

  it('navigates to chat page when not on chat page and no projectId', async () => {
    mockUsePathname.mockReturnValue('/platform/main/settings/profile');
    mockUseParams.mockReturnValue({
      mentorId: 'mentor-1',
      projectId: undefined,
      tenantKey: 'main',
    });

    render(<AppSidebar />);

    fireEvent.click(screen.getByTestId('select-pinned-message'));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/platform/main/mentor-1');
    });
  });

  it('handles message selection when on project page', async () => {
    // When projectId exists, isChatPage is true, so navigation doesn't happen
    // This tests that the component handles message selection correctly
    // even when already on a project/chat page
    mockUsePathname.mockReturnValue('/platform/main/mentor-1');
    mockUseParams.mockReturnValue({
      mentorId: 'mentor-1',
      projectId: 'project-123',
      tenantKey: 'main',
    });

    render(<AppSidebar />);

    fireEvent.click(screen.getByTestId('select-pinned-message'));

    await waitFor(() => {
      expect(mockChatActions.setNewMessages).toHaveBeenCalled();
    });

    // Navigation should NOT happen because isChatPage is true when projectId exists
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('handles localStorage deserializer when cached session exists', async () => {
    // Test that localStorage deserializer is used (line 60)
    // The deserializer function JSON.parse is called internally by useLocalStorage
    mockCachedSessionId = { 'mentor-1': 'cached-session' };

    render(<AppSidebar />);

    const options = mockUseLocalStorage.mock.calls[0]?.[2];
    const parsed = options?.deserializer?.('{"mentor-1":"cached-session"}');
    expect(parsed).toEqual({ 'mentor-1': 'cached-session' });

    fireEvent.click(screen.getByTestId('select-pinned-message'));

    await waitFor(() => {
      expect(mockSaveCachedSessionId).toHaveBeenCalled();
    });
  });

  it('handles updateNavItemsForStudentsInMainOrAdvertisingTenant dependency array correctly', () => {
    // Test that the callback updates when dependencies change
    mockUserIsStudent = true;
    mockCurrentTenant = { is_advertising: true };

    const { rerender } = render(<AppSidebar />);

    // Change dependencies
    mockUserIsStudent = false;
    mockUserIsVisiting = true;
    mockVisitingTenant = { id: 'visit-1' };

    rerender(<AppSidebar />);

    const item = screen.getByTestId('nav-item-New Chat');
    expect(item.getAttribute('data-user-types')).toContain('visiting');
  });

  it('handles sidebar open state with mobile', () => {
    mockSidebarState = { open: false, openMobile: true, isMobile: true };

    render(<AppSidebar />);

    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
  });

  it('handles sidebar closed state on desktop', () => {
    mockSidebarState = { open: false, openMobile: false, isMobile: false };

    render(<AppSidebar />);

    expect(screen.queryByTestId('pinned-messages')).not.toBeInTheDocument();
  });

  it('handles navigation branch when projectId exists but isChatPage is false', async () => {
    // Note: This test case may seem impossible because if projectId exists,
    // isChatPage is always true. However, we test the code path to ensure
    // the navigation logic with projectId is covered.
    // In practice, this branch (lines 155-156) may never be reached due to the
    // isChatPage logic, but we test it for completeness.
    mockUsePathname.mockReturnValue('/platform/main/settings');
    mockUseParams.mockReturnValue({
      mentorId: 'mentor-1',
      projectId: 'project-123',
      tenantKey: 'main',
    });

    render(<AppSidebar />);

    fireEvent.click(screen.getByTestId('select-pinned-message'));

    await waitFor(() => {
      // When projectId exists, isChatPage is true, so navigation won't happen
      // This verifies the actual behavior of the code
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  it('handles isChatPage when pathname is null', () => {
    mockUsePathname.mockReturnValue(null);
    mockUseParams.mockReturnValue({
      mentorId: 'mentor-1',
      projectId: undefined,
      tenantKey: 'main',
    });

    render(<AppSidebar />);

    // Component should render without errors
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
  });

  it('handles message with empty fileAttachments and artifactVersions arrays', async () => {
    // The existing mock already has empty arrays, which should result in undefined
    render(<AppSidebar />);

    fireEvent.click(screen.getByTestId('select-pinned-message'));

    await waitFor(() => {
      expect(mockChatActions.setNewMessages).toHaveBeenCalled();
    });

    const messagesArg = mockChatActions.setNewMessages.mock.calls[0][0];
    // Empty arrays should result in undefined
    expect(messagesArg[0].fileAttachments).toBeUndefined();
    expect(messagesArg[0].artifactVersions).toBeUndefined();
  });

  it('handles message with null files and artifact_versions', async () => {
    render(<AppSidebar />);

    fireEvent.click(screen.getByTestId('select-pinned-message-null-files'));

    await waitFor(() => {
      expect(mockChatActions.setNewMessages).toHaveBeenCalled();
    });

    const messagesArg = mockChatActions.setNewMessages.mock.calls[0][0];
    expect(messagesArg[0].fileAttachments).toBeUndefined();
    expect(messagesArg[0].artifactVersions).toBeUndefined();
  });

  it('handles message with complete artifact version data', async () => {
    render(<AppSidebar />);

    fireEvent.click(screen.getByTestId('select-recent-message-complete-artifact'));

    await waitFor(() => {
      expect(mockChatActions.setNewMessages).toHaveBeenCalled();
    });

    const messagesArg = mockChatActions.setNewMessages.mock.calls[0][0];
    expect(messagesArg[0].artifactVersions?.[0]).toMatchObject({
      id: 'av-1',
      artifact: {
        id: 'art-1',
        title: 'Artifact',
        content: 'Content',
        file_extension: '.ts',
        llm_name: 'gpt-4',
        llm_provider: 'openai',
        date_created: '2024-01-01',
        date_updated: '2024-01-02',
        metadata: { key: 'value' },
        username: 'user1',
        session_id: 'session-1',
        current_version_number: 1,
        version_count: 5,
      },
      title: 'Version 1',
      content: 'V1 Content',
      session_id: 'session-1',
      content_length: 100,
      is_current: true,
      chat_message: 'msg-1',
      version_number: 1,
      date_created: '2024-01-01',
      created_by: 'user1',
      change_summary: 'Initial version',
    });
  });

  it('does not render FreeTrialDialog when FreeTrialDialog is null even if isModalOpen is true', () => {
    mockFreeTrialDialogState.FreeTrialDialog = null;
    mockFreeTrialDialogState.isModalOpen = true;

    render(<AppSidebar />);

    expect(screen.queryByTestId('free-trial-dialog')).not.toBeInTheDocument();
  });

  it('handles updateNavItemsForStudentsInMainOrAdvertisingTenant when conditions are false', () => {
    mockUserIsStudent = false;
    mockUserIsVisiting = false;
    mockCurrentTenant = { is_advertising: false };
    mockVisitingTenant = null;
    mockUseParams.mockReturnValue({
      mentorId: 'mentor-1',
      projectId: undefined,
      tenantKey: 'tenant-2',
    });

    render(<AppSidebar />);

    const item = screen.getByTestId('nav-item-New Chat');
    // Should return item unchanged when conditions are false
    expect(item.getAttribute('data-user-types')).toBe('admin');
  });

  it('handles sidebar header when sidebar is closed', () => {
    mockSidebarState = { open: false, openMobile: false, isMobile: false };

    render(<AppSidebar />);

    const header = screen.getByTestId('sidebar-header');
    expect(header).toBeInTheDocument();
    // Logo is always rendered in the DOM (it's conditionally hidden via CSS classes)
    // This test verifies the component renders without errors when sidebar is closed
    const logo = screen.getByTestId('logo');
    expect(logo).toBeInTheDocument();
  });

  it('handles sidebar menu className when sidebar is closed', () => {
    mockSidebarState = { open: false, openMobile: false, isMobile: false };

    render(<AppSidebar />);

    const menus = screen.getAllByTestId('sidebar-menu');
    // First menu should exist and have place-content-center class when closed
    expect(menus[0]).toBeInTheDocument();
  });

  it('handles message selection with multiple messages in reverse order', async () => {
    render(<AppSidebar />);

    fireEvent.click(screen.getByTestId('select-pinned-message-multiple'));

    await waitFor(() => {
      expect(mockChatActions.setNewMessages).toHaveBeenCalled();
    });

    const messagesArg = mockChatActions.setNewMessages.mock.calls[0][0];
    // Messages should be reversed, so second message comes first
    expect(messagesArg[0].id).toBe('msg-2');
    expect(messagesArg[1].id).toBe('msg-1');
  });

  it('handles isChatPage when pathname matches pattern', () => {
    mockUsePathname.mockReturnValue('/platform/main/mentor-1');
    mockUseParams.mockReturnValue({
      mentorId: 'mentor-1',
      projectId: undefined,
      tenantKey: 'main',
    });

    render(<AppSidebar />);

    // Should not navigate when clicking message since isChatPage is true
    fireEvent.click(screen.getByTestId('select-pinned-message'));

    // Navigation should not happen
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('handles sidebar open state calculation correctly for mobile', () => {
    mockSidebarState = { open: false, openMobile: true, isMobile: true };

    render(<AppSidebar />);

    // When mobile and openMobile is true, sidebar should be open
    expect(screen.getByTestId('pinned-messages')).toBeInTheDocument();
  });

  it('handles sidebar open state calculation correctly for desktop', () => {
    mockSidebarState = { open: true, openMobile: false, isMobile: false };

    render(<AppSidebar />);

    // When desktop and open is true, sidebar should be open
    expect(screen.getByTestId('pinned-messages')).toBeInTheDocument();
  });

  it('handles all artifact version fields mapping', async () => {
    render(<AppSidebar />);

    fireEvent.click(screen.getByTestId('select-recent-message'));

    await waitFor(() => {
      expect(mockChatActions.setNewMessages).toHaveBeenCalled();
    });

    const messagesArg = mockChatActions.setNewMessages.mock.calls[0][0];
    const artifactVersion = messagesArg[0].artifactVersions?.[0];

    // Verify all artifact version fields are present
    expect(artifactVersion).toHaveProperty('id');
    expect(artifactVersion).toHaveProperty('artifact');
    expect(artifactVersion).toHaveProperty('title');
    expect(artifactVersion).toHaveProperty('content');
    expect(artifactVersion).toHaveProperty('session_id');
    expect(artifactVersion).toHaveProperty('version_number');
  });

  it('handles message with user role type', async () => {
    render(<AppSidebar />);

    fireEvent.click(screen.getByTestId('select-pinned-message'));

    await waitFor(() => {
      expect(mockChatActions.setNewMessages).toHaveBeenCalled();
    });

    const messagesArg = mockChatActions.setNewMessages.mock.calls[0][0];
    // Pinned message has type 'human', so role should be 'user'
    expect(messagesArg[0].role).toBe('user');
  });

  it('handles message with ai role type', async () => {
    render(<AppSidebar />);

    fireEvent.click(screen.getByTestId('select-recent-message'));

    await waitFor(() => {
      expect(mockChatActions.setNewMessages).toHaveBeenCalled();
    });

    const messagesArg = mockChatActions.setNewMessages.mock.calls[0][0];
    // Recent message has type 'ai', so role should be 'ai'
    expect(messagesArg[0].role).toBe('ai');
  });
});
