import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { WelcomeChatNew } from '../welcome-chat-new';
import { Project } from '@iblai/iblai-js/data-layer';
import { chatInputSliceReducer } from '@/features/chat-input/api-slice';
import subscriptionSlice from '@/features/subscription/subscription-slice';
import topBannerSlice from '@/features/top-banner/top-banner-slice';

// Mock dependencies - hoist variables used in vi.mock factories
const {
  mockUseEmbedMode,
  mockUseAxdToken,
  mockUseParams,
  mockUseGetUserProjectDetailsQuery,
  mockUseWelcome,
  mockConfig,
} = vi.hoisted(() => ({
  mockUseEmbedMode: vi.fn(),
  mockUseAxdToken: vi.fn(),
  mockUseParams: vi.fn(),
  mockUseGetUserProjectDetailsQuery: vi.fn(),
  mockUseWelcome: vi.fn(),
  mockConfig: {
    mainTenantKey: vi.fn(),
    showAppBanner: vi.fn(),
    baseWsUrl: vi.fn(),
    iblTemplateMentor: vi.fn(() => 'default-mentor'),
  },
}));

vi.mock('@/hooks/use-embed-mode', () => ({
  useEmbedMode: () => mockUseEmbedMode(),
}));

vi.mock('@/hooks/use-tokens', () => ({
  useAxdToken: () => mockUseAxdToken()?.axdToken,
}));

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
  usePathname: vi.fn(() => '/platform/test-tenant/mentor-123'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  })),
}));

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetUserProjectDetailsQuery: (args: any, options: any) =>
    mockUseGetUserProjectDetailsQuery(args, options),
  projectsApiSlice: {
    reducerPath: 'projectsCustomApiSlice',
    reducer: (state = {}, _action: any) => state,
    middleware: vi.fn(),
  },
}));

vi.mock('@/hooks/use-welcome-message', () => ({
  default: (args: any) => mockUseWelcome(args),
}));

vi.mock('@/lib/config', () => ({
  config: mockConfig,
}));

vi.mock('@/components/welcome-chat', () => ({
  WelcomeChat: ({ onPromptSelect, mentorName, profileImage, sessionId }: any) => (
    <div data-testid="welcome-chat">
      <div data-testid="mentor-name">{mentorName}</div>
      <div data-testid="profile-image">{profileImage}</div>
      <div data-testid="session-id">{sessionId}</div>
      <button onClick={() => onPromptSelect('test prompt')} data-testid="prompt-select">
        Select Prompt
      </button>
    </div>
  ),
}));

vi.mock('@/components/projects/project-landing-page', () => ({
  ProjectLandingPage: (props: any) => (
    <div data-testid="project-landing-page">
      <div data-testid="project-name">{props.project?.name}</div>
      <div data-testid="session-id">{props.sessionId}</div>
    </div>
  ),
}));

vi.mock('@/components/welcome-chat/app-sync-banner', () => ({
  AppSyncBanner: () => <div data-testid="app-sync-banner">App Sync Banner</div>,
}));

vi.mock('@/components/welcome-chat/explore-mentors', () => ({
  ExploreMentors: () => <div data-testid="explore-mentors">Explore Mentors</div>,
}));

vi.mock('@/components/welcome-chat/conversation-starters', () => ({
  ConversationStarters: ({ onTemplateSelect, enabledGuidedPrompts, sessionId }: any) => (
    <div data-testid="conversation-starters">
      <button onClick={() => onTemplateSelect('template 1')} data-testid="template-select">
        Select Template
      </button>
      <div data-testid="guided-prompts">{enabledGuidedPrompts ? 'enabled' : 'disabled'}</div>
      <div data-testid="conversation-session-id">{sessionId}</div>
    </div>
  ),
}));

vi.mock('@/components/chat-input-form', () => ({
  ChatInputForm: (props: any) => (
    <div data-testid="chat-input-form">
      <input data-testid="chat-input" placeholder="Type a message..." />
      <button onClick={() => props.onSubmit('test message')} data-testid="submit-button">
        Submit
      </button>
      <div data-testid="chat-session-id">{props.sessionId}</div>
      <div data-testid="chat-username">{props.username}</div>
    </div>
  ),
}));

vi.mock('@/components/markdown', () => ({
  default: ({ children, className }: { children: string; className?: string }) => (
    <div data-testid="markdown-content" className={className}>
      {children}
    </div>
  ),
}));

vi.mock('@iblai/iblai-js/web-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@iblai/iblai-js/web-utils')>();
  return {
    ...actual,
    useSubscriptionHandlerV2: vi.fn(() => ({
      handleSubscriptionCheck: vi.fn(),
      bannerButtonTriggerCallback: vi.fn(),
      CREDIT_INTERVAL_CHECK_COUNTER: 1000,
    })),
  };
});

// Redux store setup for tests
const defaultChatSliceState = {
  showingSharedChat: false,
  activeTab: 'default',
  chats: {
    default: [],
  },
};

const createMockStore = (preloadedState = {}) =>
  configureStore({
    reducer: {
      chatInput: chatInputSliceReducer,
      files: (state = { attachedFiles: [] }) => state,
      chatSliceShared: (state = defaultChatSliceState) => state,
      subscription: subscriptionSlice.reducer,
      topBanner: topBannerSlice.reducer,
    },
    preloadedState: {
      chatInput: { textareaInput: '' },
      files: { attachedFiles: [] },
      chatSliceShared: defaultChatSliceState,
      subscription: {
        openPricingModal: false,
        freeTrialUsageOptions: {
          count: 0,
          limitReached: false,
          message: '',
        },
        pricingModalData: {
          referenceId: '',
          customerEmail: '',
          publishableKey: '',
          pricingTableId: '',
        },
        subscriptionStatus: {
          creditExhausted: false,
          userCapability: 'FREE_TRIAL' as any,
          callToAction: 'PRICING_MODAL' as any,
        },
        error402Detected: '',
      },
      topBanner: {
        topBannerOptions: {
          bannerText: '',
          loading: false,
          enabled: false,
          parentContainerSelector: '',
        },
      },
      ...preloadedState,
    },
  });

const renderWithRedux = (component: React.ReactElement, preloadedState = {}) => {
  return render(<Provider store={createMockStore(preloadedState)}>{component}</Provider>);
};

describe('WelcomeChatNew', () => {
  const mockOnSubmit = vi.fn();
  const mockOnScreenSharingClick = vi.fn();
  const mockOnPhoneCallClick = vi.fn();
  const mockStopGenerating = vi.fn();
  const mockSetMessage = vi.fn();
  const mockUpdateSessionTools = vi.fn().mockResolvedValue(undefined);
  const mockSetSessionTools = vi.fn().mockResolvedValue(undefined);

  const defaultProps = {
    mentorName: 'Test Mentor',
    sessionId: 'session-123',
    enabledGuidedPrompts: true,
    onSubmit: mockOnSubmit,
    onScreenSharingClick: mockOnScreenSharingClick,
    isScreenSharingModalOpen: false,
    onPhoneCallClick: mockOnPhoneCallClick,
    stopGenerating: mockStopGenerating,
    tenantKey: 'test-tenant',
    username: 'test-user',
    enableWebBrowsing: true,
    setMessage: mockSetMessage,
    isStreaming: false,
    enableSafetyDisclaimer: false,
    isPreviewMode: false,
    updateSessionTools: mockUpdateSessionTools,
    setSessionTools: mockSetSessionTools,
    activeTools: [],
    screenSharing: true,
    deepResearch: true,
    imageGeneration: true,
    codeInterpreter: true,
    mentorUniqueId: 'mentor-123',
    profileImage: 'https://example.com/image.jpg',
    promptsIsEnabled: true,
    googleSlidesIsEnabled: true,
    googleDocumentIsEnabled: true,
    artifactsEnabled: false,
    studyMode: false,
  };

  const defaultProject: Project = {
    id: 1,
    name: 'Test Project',
    description: 'Test Description',
    shared: false,
    owner: 1,
    owner_username: 'testuser',
    platform: 1,
    platform_key: 'test-platform',
    platform_name: 'Test Platform',
    mentor_count: 2,
    is_personal: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    mentors: [],
    instructions: 'Test instructions',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseEmbedMode.mockReturnValue(false);
    mockUseAxdToken.mockReturnValue({ axdToken: 'test-token' });
    mockUseParams.mockReturnValue({ projectId: undefined });
    mockUseGetUserProjectDetailsQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: undefined,
    });
    mockUseWelcome.mockReturnValue({ welcomeMessage: 'Welcome message' });
    mockConfig.mainTenantKey.mockReturnValue('main');
    mockConfig.showAppBanner.mockReturnValue('true');
    mockConfig.baseWsUrl.mockReturnValue('wss://example.com');
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('embed mode', () => {
    it('should render WelcomeChat component when embedMode is true', () => {
      mockUseEmbedMode.mockReturnValue(true);

      renderWithRedux(<WelcomeChatNew {...defaultProps} />);

      expect(screen.getByTestId('welcome-chat')).toBeInTheDocument();
      expect(screen.getByTestId('mentor-name')).toHaveTextContent('Test Mentor');
      expect(screen.queryByTestId('project-landing-page')).not.toBeInTheDocument();
    });

    it('should pass correct props to WelcomeChat in embed mode', () => {
      mockUseEmbedMode.mockReturnValue(true);

      renderWithRedux(
        <WelcomeChatNew {...defaultProps} isNewSession={false} aiWelcomeMessage="Custom welcome" />,
      );

      expect(screen.getByTestId('welcome-chat')).toBeInTheDocument();
      expect(screen.getByTestId('session-id')).toHaveTextContent('session-123');
    });

    it('should handle prompt selection in embed mode', () => {
      mockUseEmbedMode.mockReturnValue(true);

      renderWithRedux(<WelcomeChatNew {...defaultProps} />);

      const promptButton = screen.getByTestId('prompt-select');
      promptButton.click();

      expect(mockOnSubmit).toHaveBeenCalledWith('test prompt');
    });
  });

  describe('project mode', () => {
    it('should render ProjectLandingPage when projectId exists and project data is available', () => {
      mockUseParams.mockReturnValue({ projectId: '1' });
      mockUseGetUserProjectDetailsQuery.mockReturnValue({
        data: defaultProject,
        isLoading: false,
        error: undefined,
      });

      renderWithRedux(<WelcomeChatNew {...defaultProps} />);

      expect(screen.getByTestId('project-landing-page')).toBeInTheDocument();
      expect(screen.getByTestId('project-name')).toHaveTextContent('Test Project');
      expect(screen.queryByTestId('welcome-chat')).not.toBeInTheDocument();
    });

    it('should return null when projectId exists but project data is not available', () => {
      mockUseParams.mockReturnValue({ projectId: '1' });
      mockUseGetUserProjectDetailsQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: undefined,
      });

      const { container } = renderWithRedux(<WelcomeChatNew {...defaultProps} />);

      expect(container.firstChild).toBeNull();
    });

    it('should skip query when username is missing', () => {
      mockUseParams.mockReturnValue({ projectId: '1' });

      renderWithRedux(<WelcomeChatNew {...defaultProps} username={undefined as any} />);

      expect(mockUseGetUserProjectDetailsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantKey: 'test-tenant',
          username: undefined,
          id: 1,
        }),
        expect.objectContaining({
          skip: true,
        }),
      );
    });

    it('should skip query when tenantKey is missing', () => {
      mockUseParams.mockReturnValue({ projectId: '1' });

      renderWithRedux(<WelcomeChatNew {...defaultProps} tenantKey={undefined as any} />);

      expect(mockUseGetUserProjectDetailsQuery).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          skip: true,
        }),
      );
    });

    it('should skip query when projectId is missing', () => {
      mockUseParams.mockReturnValue({ projectId: undefined });

      renderWithRedux(<WelcomeChatNew {...defaultProps} />);

      expect(mockUseGetUserProjectDetailsQuery).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          skip: true,
        }),
      );
    });

    it('should parse projectId as integer', () => {
      mockUseParams.mockReturnValue({ projectId: '123' });
      mockUseGetUserProjectDetailsQuery.mockReturnValue({
        data: defaultProject,
        isLoading: false,
        error: undefined,
      });

      renderWithRedux(<WelcomeChatNew {...defaultProps} />);

      expect(mockUseGetUserProjectDetailsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 123,
        }),
        expect.any(Object),
      );
    });

    it('should handle invalid projectId string', () => {
      mockUseParams.mockReturnValue({ projectId: 'invalid' });
      mockUseGetUserProjectDetailsQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: undefined,
      });

      renderWithRedux(<WelcomeChatNew {...defaultProps} />);

      expect(mockUseGetUserProjectDetailsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          id: NaN,
        }),
        expect.any(Object),
      );
    });
  });

  describe('default welcome view', () => {
    it('should render default welcome view when not in embed mode and no projectId', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseParams.mockReturnValue({ projectId: undefined });

      renderWithRedux(<WelcomeChatNew {...defaultProps} />);

      expect(screen.getByText('Test Mentor')).toBeInTheDocument();
      expect(screen.getByTestId('chat-input-form')).toBeInTheDocument();
      expect(screen.getByTestId('conversation-starters')).toBeInTheDocument();
      expect(screen.getByTestId('explore-mentors')).toBeInTheDocument();
    });

    it('should render AppSyncBanner when conditions are met', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseParams.mockReturnValue({ projectId: undefined });
      mockConfig.mainTenantKey.mockReturnValue('main');
      mockConfig.showAppBanner.mockReturnValue('true');

      renderWithRedux(<WelcomeChatNew {...defaultProps} tenantKey="main" />);

      expect(screen.getByTestId('app-sync-banner')).toBeInTheDocument();
    });

    it('should not render AppSyncBanner when tenantKey does not match', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseParams.mockReturnValue({ projectId: undefined });
      mockConfig.mainTenantKey.mockReturnValue('main');
      mockConfig.showAppBanner.mockReturnValue('true');

      renderWithRedux(<WelcomeChatNew {...defaultProps} tenantKey="other-tenant" />);

      expect(screen.queryByTestId('app-sync-banner')).not.toBeInTheDocument();
    });

    it('should not render AppSyncBanner when showAppBanner is not "true"', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseParams.mockReturnValue({ projectId: undefined });
      mockConfig.mainTenantKey.mockReturnValue('main');
      mockConfig.showAppBanner.mockReturnValue('false');

      renderWithRedux(<WelcomeChatNew {...defaultProps} tenantKey="main" />);

      expect(screen.queryByTestId('app-sync-banner')).not.toBeInTheDocument();
    });

    it('should render mentor name with gradient styling', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseParams.mockReturnValue({ projectId: undefined });

      renderWithRedux(<WelcomeChatNew {...defaultProps} />);

      const mentorName = screen.getByText('Test Mentor');
      expect(mentorName).toBeInTheDocument();
      expect(mentorName).toHaveClass('bg-gradient-to-r');
    });

    it('should render WelcomeMessage component with Markdown', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseParams.mockReturnValue({ projectId: undefined });

      renderWithRedux(<WelcomeChatNew {...defaultProps} />);

      // WelcomeMessage renders using Markdown component
      const markdownContent = screen.getByTestId('markdown-content');
      expect(markdownContent).toBeInTheDocument();
      expect(markdownContent).toHaveTextContent('Welcome message');
    });

    it('should use aiWelcomeMessage when welcomeMessage is empty', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseParams.mockReturnValue({ projectId: undefined });
      mockUseWelcome.mockReturnValue({ welcomeMessage: '' });

      renderWithRedux(<WelcomeChatNew {...defaultProps} aiWelcomeMessage="AI Welcome" />);

      expect(screen.getByText('AI Welcome')).toBeInTheDocument();
    });

    it('should use welcomeMessage over aiWelcomeMessage', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseParams.mockReturnValue({ projectId: undefined });
      mockUseWelcome.mockReturnValue({ welcomeMessage: 'Hook Welcome' });

      renderWithRedux(<WelcomeChatNew {...defaultProps} aiWelcomeMessage="AI Welcome" />);

      expect(screen.getByText('Hook Welcome')).toBeInTheDocument();
      expect(screen.queryByText('AI Welcome')).not.toBeInTheDocument();
    });

    it('should render empty string when both welcome messages are empty', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseParams.mockReturnValue({ projectId: undefined });
      mockUseWelcome.mockReturnValue({ welcomeMessage: '' });

      renderWithRedux(<WelcomeChatNew {...defaultProps} aiWelcomeMessage="" />);

      // Verify Markdown component exists and is empty
      const markdownContent = screen.getByTestId('markdown-content');
      expect(markdownContent).toBeInTheDocument();
      expect(markdownContent.textContent).toBe('');
    });

    it('should pass correct props to useWelcome hook', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseParams.mockReturnValue({ projectId: undefined });
      mockConfig.baseWsUrl.mockReturnValue('wss://test.com');

      render(
        <WelcomeChatNew
          {...defaultProps}
          sessionId="session-456"
          username="user-123"
          tenantKey="tenant-456"
          mentorUniqueId="mentor-789"
          isNewSession={false}
        />,
      );

      expect(mockUseWelcome).toHaveBeenCalledWith({
        sessionId: 'session-456',
        username: 'user-123',
        tenantKey: 'tenant-456',
        mentorUniqueId: 'mentor-789',
        token: 'test-token',
        wsUrl: 'wss://test.com/ws/langflow/',
        isNewSession: false,
      });
    });

    it('should render ChatInputForm with correct props', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseParams.mockReturnValue({ projectId: undefined });

      renderWithRedux(<WelcomeChatNew {...defaultProps} username="test-user" />);

      expect(screen.getByTestId('chat-input-form')).toBeInTheDocument();
      expect(screen.getByTestId('chat-session-id')).toHaveTextContent('session-123');
      expect(screen.getByTestId('chat-username')).toHaveTextContent('test-user');
    });

    it('should handle username as null in ChatInputForm', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseParams.mockReturnValue({ projectId: undefined });

      renderWithRedux(<WelcomeChatNew {...defaultProps} username={null as any} />);

      expect(screen.getByTestId('chat-username')).toHaveTextContent('');
    });

    it('should use default chatAreaMaxWidth when not provided', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseParams.mockReturnValue({ projectId: undefined });

      renderWithRedux(<WelcomeChatNew {...defaultProps} />);

      // Find the parent container of the chat input form
      const chatInputForm = screen.getByTestId('chat-input-form');
      const chatFormContainer = chatInputForm.parentElement;
      expect(chatFormContainer).toHaveStyle({ maxWidth: '848px' });
    });

    it('should use custom chatAreaMaxWidth when provided', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseParams.mockReturnValue({ projectId: undefined });

      renderWithRedux(<WelcomeChatNew {...defaultProps} chatAreaMaxWidth={800} />);

      // Find the parent container of the chat input form
      const chatInputForm = screen.getByTestId('chat-input-form');
      const chatFormContainer = chatInputForm.parentElement;
      expect(chatFormContainer).toHaveStyle({ maxWidth: '800px' });
    });

    it('should render ConversationStarters with correct props', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseParams.mockReturnValue({ projectId: undefined });

      renderWithRedux(<WelcomeChatNew {...defaultProps} enabledGuidedPrompts={true} />);

      expect(screen.getByTestId('conversation-starters')).toBeInTheDocument();
      expect(screen.getByTestId('guided-prompts')).toHaveTextContent('enabled');
      expect(screen.getByTestId('conversation-session-id')).toHaveTextContent('session-123');
    });

    it('should handle template selection from ConversationStarters', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseParams.mockReturnValue({ projectId: undefined });

      renderWithRedux(<WelcomeChatNew {...defaultProps} />);

      const templateButton = screen.getByTestId('template-select');
      templateButton.click();

      expect(mockOnSubmit).toHaveBeenCalledWith('template 1');
    });

    it('should render ExploreMentors component', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseParams.mockReturnValue({ projectId: undefined });

      renderWithRedux(<WelcomeChatNew {...defaultProps} />);

      expect(screen.getByTestId('explore-mentors')).toBeInTheDocument();
    });
  });

  describe('default prop values', () => {
    it('should use default isNewSession value of true', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseParams.mockReturnValue({ projectId: undefined });

      renderWithRedux(<WelcomeChatNew {...defaultProps} isNewSession={undefined as any} />);

      expect(mockUseWelcome).toHaveBeenCalledWith(
        expect.objectContaining({
          isNewSession: true,
        }),
      );
    });

    it('should use default aiWelcomeMessage value of empty string', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseParams.mockReturnValue({ projectId: undefined });
      mockUseWelcome.mockReturnValue({ welcomeMessage: '' });

      renderWithRedux(<WelcomeChatNew {...defaultProps} aiWelcomeMessage={undefined as any} />);

      // Verify Markdown component exists and is empty
      const markdownContent = screen.getByTestId('markdown-content');
      expect(markdownContent).toBeInTheDocument();
      expect(markdownContent.textContent).toBe('');
    });

    it('should use default chatAreaMaxWidth value', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseParams.mockReturnValue({ projectId: undefined });

      renderWithRedux(<WelcomeChatNew {...defaultProps} chatAreaMaxWidth={undefined as any} />);

      // Find the parent container of the chat input form
      const chatInputForm = screen.getByTestId('chat-input-form');
      const chatFormContainer = chatInputForm.parentElement;
      expect(chatFormContainer).toHaveStyle({ maxWidth: '848px' });
    });
  });

  describe('edge cases', () => {
    it('should handle empty mentorName', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseParams.mockReturnValue({ projectId: undefined });

      renderWithRedux(<WelcomeChatNew {...defaultProps} mentorName="" />);

      // Verify the heading exists (even if empty)
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toBeInTheDocument();
      expect(heading.textContent).toBe('');
    });

    it('should handle very long mentorName', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseParams.mockReturnValue({ projectId: undefined });

      const longName = 'A'.repeat(1000);
      renderWithRedux(<WelcomeChatNew {...defaultProps} mentorName={longName} />);

      expect(screen.getByText(longName)).toBeInTheDocument();
    });

    it('should handle empty sessionId', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseParams.mockReturnValue({ projectId: undefined });

      renderWithRedux(<WelcomeChatNew {...defaultProps} sessionId="" />);

      expect(screen.getByTestId('chat-session-id')).toHaveTextContent('');
    });

    it('should handle all boolean props as false', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseParams.mockReturnValue({ projectId: undefined });

      renderWithRedux(
        <WelcomeChatNew
          {...defaultProps}
          enabledGuidedPrompts={false}
          enableWebBrowsing={false}
          isStreaming={false}
          enableSafetyDisclaimer={false}
          isPreviewMode={false}
          screenSharing={false}
          deepResearch={false}
          imageGeneration={false}
          codeInterpreter={false}
          promptsIsEnabled={false}
          googleSlidesIsEnabled={false}
          googleDocumentIsEnabled={false}
          artifactsEnabled={false}
        />,
      );

      expect(screen.getByTestId('chat-input-form')).toBeInTheDocument();
    });

    it('should handle empty activeTools array', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseParams.mockReturnValue({ projectId: undefined });

      renderWithRedux(<WelcomeChatNew {...defaultProps} activeTools={[]} />);

      expect(screen.getByTestId('chat-input-form')).toBeInTheDocument();
    });

    it('should handle activeTools with multiple values', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseParams.mockReturnValue({ projectId: undefined });

      renderWithRedux(
        <WelcomeChatNew {...defaultProps} activeTools={['canvas', 'web_browsing']} />,
      );

      expect(screen.getByTestId('chat-input-form')).toBeInTheDocument();
    });

    it('should handle project with loading state', () => {
      mockUseParams.mockReturnValue({ projectId: '1' });
      mockUseGetUserProjectDetailsQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: undefined,
      });

      const { container } = renderWithRedux(<WelcomeChatNew {...defaultProps} />);

      // Should return null while loading
      expect(container.firstChild).toBeNull();
    });

    it('should handle project with error state', () => {
      mockUseParams.mockReturnValue({ projectId: '1' });
      mockUseGetUserProjectDetailsQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: { message: 'Error loading project' },
      });

      const { container } = renderWithRedux(<WelcomeChatNew {...defaultProps} />);

      // Should return null on error
      expect(container.firstChild).toBeNull();
    });

    it('should handle axdToken as undefined', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseParams.mockReturnValue({ projectId: undefined });
      mockUseAxdToken.mockReturnValue({ axdToken: undefined });

      renderWithRedux(<WelcomeChatNew {...defaultProps} />);

      expect(mockUseWelcome).toHaveBeenCalledWith(
        expect.objectContaining({
          token: undefined,
        }),
      );
    });

    it('should handle empty string axdToken', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseParams.mockReturnValue({ projectId: undefined });
      mockUseAxdToken.mockReturnValue({ axdToken: '' });

      renderWithRedux(<WelcomeChatNew {...defaultProps} />);

      expect(mockUseWelcome).toHaveBeenCalledWith(
        expect.objectContaining({
          token: '',
        }),
      );
    });
  });

  describe('conditional rendering paths', () => {
    it('should prioritize embedMode over projectId', () => {
      mockUseEmbedMode.mockReturnValue(true);
      mockUseParams.mockReturnValue({ projectId: '1' });
      mockUseGetUserProjectDetailsQuery.mockReturnValue({
        data: defaultProject,
        isLoading: false,
        error: undefined,
      });

      renderWithRedux(<WelcomeChatNew {...defaultProps} />);

      expect(screen.getByTestId('welcome-chat')).toBeInTheDocument();
      expect(screen.queryByTestId('project-landing-page')).not.toBeInTheDocument();
    });

    it('should prioritize projectId over default view when not in embed mode', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseParams.mockReturnValue({ projectId: '1' });
      mockUseGetUserProjectDetailsQuery.mockReturnValue({
        data: defaultProject,
        isLoading: false,
        error: undefined,
      });

      renderWithRedux(<WelcomeChatNew {...defaultProps} />);

      expect(screen.getByTestId('project-landing-page')).toBeInTheDocument();
      expect(screen.queryByTestId('welcome-chat')).not.toBeInTheDocument();
      expect(screen.queryByTestId('conversation-starters')).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have proper heading structure in default view', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseParams.mockReturnValue({ projectId: undefined });

      renderWithRedux(<WelcomeChatNew {...defaultProps} />);

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent('Test Mentor');
    });

    it('should have accessible form elements', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseParams.mockReturnValue({ projectId: undefined });

      renderWithRedux(<WelcomeChatNew {...defaultProps} />);

      const chatInput = screen.getByTestId('chat-input');
      expect(chatInput).toBeInTheDocument();
      expect(chatInput).toHaveAttribute('placeholder', 'Type a message...');
    });
  });

  describe('integration with child components', () => {
    it('should pass all props to ProjectLandingPage when project exists', () => {
      mockUseParams.mockReturnValue({ projectId: '1' });
      mockUseGetUserProjectDetailsQuery.mockReturnValue({
        data: defaultProject,
        isLoading: false,
        error: undefined,
      });

      renderWithRedux(<WelcomeChatNew {...defaultProps} />);

      expect(screen.getByTestId('project-landing-page')).toBeInTheDocument();
      expect(screen.getByTestId('project-name')).toHaveTextContent('Test Project');
      expect(screen.getByTestId('session-id')).toHaveTextContent('session-123');
    });

    it('should pass all props to WelcomeChat in embed mode', () => {
      mockUseEmbedMode.mockReturnValue(true);

      render(
        <WelcomeChatNew
          {...defaultProps}
          isNewSession={false}
          aiWelcomeMessage="Custom AI message"
        />,
      );

      expect(screen.getByTestId('welcome-chat')).toBeInTheDocument();
      expect(screen.getByTestId('mentor-name')).toHaveTextContent('Test Mentor');
    });
  });

  describe('WelcomeMessage component edge cases', () => {
    it('should use welcomeMessage when both are provided', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseParams.mockReturnValue({ projectId: undefined });
      mockUseWelcome.mockReturnValue({ welcomeMessage: 'Hook Message' });

      renderWithRedux(<WelcomeChatNew {...defaultProps} aiWelcomeMessage="AI Message" />);

      expect(screen.getByText('Hook Message')).toBeInTheDocument();
      expect(screen.queryByText('AI Message')).not.toBeInTheDocument();
    });

    it('should use aiWelcomeMessage when welcomeMessage is empty string', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseParams.mockReturnValue({ projectId: undefined });
      mockUseWelcome.mockReturnValue({ welcomeMessage: '' });

      renderWithRedux(<WelcomeChatNew {...defaultProps} aiWelcomeMessage="AI Fallback" />);

      expect(screen.getByText('AI Fallback')).toBeInTheDocument();
    });

    it('should use aiWelcomeMessage when welcomeMessage is null', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseParams.mockReturnValue({ projectId: undefined });
      mockUseWelcome.mockReturnValue({ welcomeMessage: null as any });

      renderWithRedux(<WelcomeChatNew {...defaultProps} aiWelcomeMessage="AI Fallback" />);

      expect(screen.getByText('AI Fallback')).toBeInTheDocument();
    });

    it('should render empty string when both messages are falsy', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseParams.mockReturnValue({ projectId: undefined });
      mockUseWelcome.mockReturnValue({ welcomeMessage: '' });

      renderWithRedux(<WelcomeChatNew {...defaultProps} aiWelcomeMessage="" />);

      // Verify Markdown component exists and is empty
      const markdownContent = screen.getByTestId('markdown-content');
      expect(markdownContent).toBeInTheDocument();
      expect(markdownContent.textContent).toBe('');
    });

    it('should construct wsUrl correctly', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseParams.mockReturnValue({ projectId: undefined });
      mockConfig.baseWsUrl.mockReturnValue('wss://custom.example.com');

      renderWithRedux(<WelcomeChatNew {...defaultProps} />);

      expect(mockUseWelcome).toHaveBeenCalledWith(
        expect.objectContaining({
          wsUrl: 'wss://custom.example.com/ws/langflow/',
        }),
      );
    });
  });

  describe('parseInt edge cases for projectId', () => {
    it('should handle projectId as string number', () => {
      mockUseParams.mockReturnValue({ projectId: '42' });
      mockUseGetUserProjectDetailsQuery.mockReturnValue({
        data: defaultProject,
        isLoading: false,
        error: undefined,
      });

      renderWithRedux(<WelcomeChatNew {...defaultProps} />);

      expect(mockUseGetUserProjectDetailsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 42,
        }),
        expect.any(Object),
      );
    });

    it('should handle projectId as zero', () => {
      mockUseParams.mockReturnValue({ projectId: '0' });
      mockUseGetUserProjectDetailsQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: undefined,
      });

      renderWithRedux(<WelcomeChatNew {...defaultProps} />);

      expect(mockUseGetUserProjectDetailsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 0,
        }),
        expect.any(Object),
      );
    });

    it('should handle projectId as negative number string', () => {
      mockUseParams.mockReturnValue({ projectId: '-1' });
      mockUseGetUserProjectDetailsQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: undefined,
      });

      renderWithRedux(<WelcomeChatNew {...defaultProps} />);

      expect(mockUseGetUserProjectDetailsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          id: -1,
        }),
        expect.any(Object),
      );
    });
  });

  describe('query skip conditions', () => {
    it('should skip query when all conditions are false', () => {
      mockUseParams.mockReturnValue({ projectId: undefined });

      renderWithRedux(
        <WelcomeChatNew
          {...defaultProps}
          username={undefined as any}
          tenantKey={undefined as any}
        />,
      );

      expect(mockUseGetUserProjectDetailsQuery).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          skip: true,
        }),
      );
    });

    it('should not skip query when all conditions are true', () => {
      mockUseParams.mockReturnValue({ projectId: '1' });
      mockUseGetUserProjectDetailsQuery.mockReturnValue({
        data: defaultProject,
        isLoading: false,
        error: undefined,
      });

      renderWithRedux(<WelcomeChatNew {...defaultProps} username="user" tenantKey="tenant" />);

      expect(mockUseGetUserProjectDetailsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'user',
          tenantKey: 'tenant',
          id: 1,
        }),
        expect.objectContaining({
          skip: false,
        }),
      );
    });

    it('should skip query when username is falsy', () => {
      mockUseParams.mockReturnValue({ projectId: '1' });

      renderWithRedux(<WelcomeChatNew {...defaultProps} username="" tenantKey="tenant" />);

      expect(mockUseGetUserProjectDetailsQuery).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          skip: true,
        }),
      );
    });

    it('should skip query when tenantKey is falsy', () => {
      mockUseParams.mockReturnValue({ projectId: '1' });

      renderWithRedux(<WelcomeChatNew {...defaultProps} username="user" tenantKey="" />);

      expect(mockUseGetUserProjectDetailsQuery).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          skip: true,
        }),
      );
    });
  });

  describe('component structure and styling', () => {
    it('should have correct container classes in embed mode', () => {
      mockUseEmbedMode.mockReturnValue(true);

      const { container } = renderWithRedux(<WelcomeChatNew {...defaultProps} />);
      const embedContainer = container.querySelector('.flex-1.h-full');
      expect(embedContainer).toBeInTheDocument();
    });

    it('should have correct container classes in default view', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseParams.mockReturnValue({ projectId: undefined });

      const { container } = renderWithRedux(<WelcomeChatNew {...defaultProps} />);
      const defaultContainer = container.querySelector('.overflow-y-auto');
      expect(defaultContainer).toBeInTheDocument();
    });

    it('should apply inline style for chatAreaMaxWidth', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseParams.mockReturnValue({ projectId: undefined });

      renderWithRedux(<WelcomeChatNew {...defaultProps} chatAreaMaxWidth={900} />);

      // Find the parent container of the chat input form
      const chatInputForm = screen.getByTestId('chat-input-form');
      const chatContainer = chatInputForm.parentElement;
      expect(chatContainer).toHaveStyle({ maxWidth: '900px' });
    });
  });

  describe('Markdown rendering for welcome messages', () => {
    it('should render welcome message using Markdown component', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseParams.mockReturnValue({ projectId: undefined });
      mockUseWelcome.mockReturnValue({ welcomeMessage: 'Hello **bold** text' });

      renderWithRedux(<WelcomeChatNew {...defaultProps} />);

      const markdownContent = screen.getByTestId('markdown-content');
      expect(markdownContent).toBeInTheDocument();
      expect(markdownContent).toHaveTextContent('Hello **bold** text');
    });

    it('should pass correct className to Markdown component', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseParams.mockReturnValue({ projectId: undefined });
      mockUseWelcome.mockReturnValue({ welcomeMessage: 'Test message' });

      renderWithRedux(<WelcomeChatNew {...defaultProps} />);

      const markdownContent = screen.getByTestId('markdown-content');
      expect(markdownContent).toHaveClass('text-gray-600');
      expect(markdownContent).toHaveClass('text-lg');
      expect(markdownContent).toHaveClass('max-w-3xl');
    });

    it('should render aiWelcomeMessage with Markdown when welcomeMessage is empty', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseParams.mockReturnValue({ projectId: undefined });
      mockUseWelcome.mockReturnValue({ welcomeMessage: '' });

      renderWithRedux(
        <WelcomeChatNew {...defaultProps} aiWelcomeMessage="Welcome with *markdown* content" />,
      );

      const markdownContent = screen.getByTestId('markdown-content');
      expect(markdownContent).toHaveTextContent('Welcome with *markdown* content');
    });

    it('should handle markdown content with special characters', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseParams.mockReturnValue({ projectId: undefined });
      mockUseWelcome.mockReturnValue({
        welcomeMessage: 'Hello! How can I help you today? 🤖',
      });

      renderWithRedux(<WelcomeChatNew {...defaultProps} />);

      const markdownContent = screen.getByTestId('markdown-content');
      expect(markdownContent).toHaveTextContent('Hello! How can I help you today? 🤖');
    });

    it('should handle markdown content with links', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseParams.mockReturnValue({ projectId: undefined });
      mockUseWelcome.mockReturnValue({
        welcomeMessage: 'Visit [our site](https://example.com) for more info',
      });

      renderWithRedux(<WelcomeChatNew {...defaultProps} />);

      const markdownContent = screen.getByTestId('markdown-content');
      expect(markdownContent).toHaveTextContent(
        'Visit [our site](https://example.com) for more info',
      );
    });

    it('should handle multiline markdown content', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseParams.mockReturnValue({ projectId: undefined });
      mockUseWelcome.mockReturnValue({
        welcomeMessage: 'Line 1\nLine 2\nLine 3',
      });

      renderWithRedux(<WelcomeChatNew {...defaultProps} />);

      const markdownContent = screen.getByTestId('markdown-content');
      // DOM normalizes whitespace, so we check that content is present
      expect(markdownContent).toHaveTextContent('Line 1');
      expect(markdownContent).toHaveTextContent('Line 2');
      expect(markdownContent).toHaveTextContent('Line 3');
    });
  });
});
