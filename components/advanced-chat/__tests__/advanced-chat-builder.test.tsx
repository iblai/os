import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { AdvancedStaticChatBuilder } from '../advanced-chat-builder';
import type { AdvancedTab, Prompt } from '@iblai/iblai-js/web-utils';

// Mock dependencies - hoist variables used in vi.mock factories
const {
  mockUseLazyGetPromptsSearchQuery,
  mockUseLazyGetGuidedPromptsQuery,
  mockUseWelcome,
  mockUseAxdToken,
  mockConfig,
  mockAdvancedTabsProperties,
} = vi.hoisted(() => ({
  mockUseLazyGetPromptsSearchQuery: vi.fn(),
  mockUseLazyGetGuidedPromptsQuery: vi.fn(),
  mockUseWelcome: vi.fn(),
  mockUseAxdToken: vi.fn(),
  mockConfig: {
    baseWsUrl: vi.fn(),
    iblTemplateMentor: vi.fn(() => 'default-mentor'),
    iblAvatarServiceUrl: vi.fn(() => 'https://avatar.example.com'),
  },
  mockAdvancedTabsProperties: {
    chat: {
      display: 'Chat',
      tag: 'default',
      prompts: [],
    },
    options: {
      display: 'Options',
      tag: 'options',
      description: 'Options description',
      metaDescription: 'Meta description',
      prompts: [{ type: 'ai', content: 'Option 1' }],
    },
    empty: {
      display: 'Empty',
      tag: null,
      prompts: [],
    },
  },
}));

vi.mock('@iblai/iblai-js/web-utils', () => ({
  advancedTabsProperties: mockAdvancedTabsProperties,
}));

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useLazyGetPromptsSearchQuery: () => mockUseLazyGetPromptsSearchQuery(),
  useLazyGetGuidedPromptsQuery: () => mockUseLazyGetGuidedPromptsQuery(),
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

vi.mock('@/hooks/use-welcome-message', () => ({
  default: (args: any) => mockUseWelcome(args),
}));

vi.mock('@/hooks/use-tokens', () => ({
  useAxdToken: () => mockUseAxdToken(),
}));

vi.mock('@/lib/config', () => ({
  config: mockConfig,
}));

vi.mock('@/components/markdown', () => ({
  default: ({
    children,
    className,
  }: {
    children: string;
    className?: string;
  }) => (
    <div data-testid="markdown-content" className={className}>
      {children}
    </div>
  ),
}));

vi.mock('../ui-tags/default-tag', () => ({
  DefaultTag: ({
    prompts,
    onPromptSelect,
  }: {
    prompts: Prompt[];
    onPromptSelect: (tab: AdvancedTab, prompt: string) => void;
  }) => (
    <div data-testid="default-tag">
      {prompts.map((prompt, i) => (
        <button
          key={i}
          data-testid={`prompt-${i}`}
          onClick={() =>
            onPromptSelect('chat' as AdvancedTab, prompt.content ?? '')
          }
        >
          {prompt.content}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('../ui-tags/options-tag', () => ({
  OptionsTag: ({
    title,
    description,
    options,
    onOptionSelect,
    profileImage,
    mentorName,
  }: any) => (
    <div data-testid="options-tag">
      <div data-testid="options-title">{title}</div>
      <div data-testid="options-description">{description}</div>
      <div data-testid="options-mentor-name">{mentorName}</div>
      <div data-testid="options-profile-image">{profileImage}</div>
      {options.map((opt: Prompt, i: number) => (
        <button
          key={i}
          data-testid={`option-${i}`}
          onClick={() => onOptionSelect('options', opt.content)}
        >
          {opt.content}
        </button>
      ))}
    </div>
  ),
}));

describe('AdvancedStaticChatBuilder', () => {
  const mockSendMessage = vi.fn();
  const mockTriggerGetPromptsSearch = vi.fn();
  const mockTriggerGetGuidedPrompts = vi.fn();

  const defaultProps = {
    activeTab: 'chat' as AdvancedTab,
    sendMessage: mockSendMessage,
    profileImage: 'https://example.com/image.jpg',
    mentorName: 'Test Mentor',
    tenantKey: 'test-tenant',
    sessionId: 'session-123',
    username: 'test-user',
    mentorUniqueId: 'mentor-123',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockTriggerGetPromptsSearch.mockResolvedValue({
      data: { results: [] },
    });
    mockTriggerGetGuidedPrompts.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({ ai_prompts: [] }),
    });

    mockUseLazyGetPromptsSearchQuery.mockReturnValue([
      mockTriggerGetPromptsSearch,
      { isLoading: false },
    ]);
    mockUseLazyGetGuidedPromptsQuery.mockReturnValue([
      mockTriggerGetGuidedPrompts,
      { isLoading: false },
    ]);

    mockUseWelcome.mockReturnValue({ welcomeMessage: 'Welcome message' });
    mockUseAxdToken.mockReturnValue('test-token');
    mockConfig.baseWsUrl.mockReturnValue('wss://example.com');
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('basic rendering', () => {
    it('should render DefaultTag when activeTab is chat', () => {
      render(<AdvancedStaticChatBuilder {...defaultProps} />);
      expect(screen.getByTestId('default-tag')).toBeInTheDocument();
    });

    it('should render OptionsTag when activeTab is options', () => {
      render(
        <AdvancedStaticChatBuilder
          {...defaultProps}
          activeTab={'options' as AdvancedTab}
        />,
      );
      expect(screen.getByTestId('options-tag')).toBeInTheDocument();
    });

    it('should return null for empty/invalid tab', () => {
      const { container } = render(
        <AdvancedStaticChatBuilder
          {...defaultProps}
          activeTab={'empty' as AdvancedTab}
        />,
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe('welcome message with Markdown', () => {
    it('should render welcome message using Markdown component', async () => {
      mockUseWelcome.mockReturnValue({ welcomeMessage: 'Hello **world**' });

      render(<AdvancedStaticChatBuilder {...defaultProps} />);

      await waitFor(() => {
        const markdownContent = screen.getByTestId('markdown-content');
        expect(markdownContent).toBeInTheDocument();
        expect(markdownContent).toHaveTextContent('Hello **world**');
      });
    });

    it('should pass correct className to Markdown component', async () => {
      render(<AdvancedStaticChatBuilder {...defaultProps} />);

      await waitFor(() => {
        const markdownContent = screen.getByTestId('markdown-content');
        expect(markdownContent).toHaveClass('mt-1');
        expect(markdownContent).toHaveClass('text-[14px]');
        expect(markdownContent).toHaveClass('text-gray-600');
      });
    });

    it('should render mentor name in welcome section', async () => {
      render(<AdvancedStaticChatBuilder {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Test Mentor')).toBeInTheDocument();
      });
    });

    it('should render mentor avatar in welcome section', async () => {
      const { container } = render(
        <AdvancedStaticChatBuilder {...defaultProps} />,
      );

      await waitFor(() => {
        // Avatar container should be present
        const avatarContainer = container.querySelector('[data-slot="avatar"]');
        expect(avatarContainer).toBeInTheDocument();
      });
    });

    it('should handle empty welcome message', async () => {
      mockUseWelcome.mockReturnValue({ welcomeMessage: '' });

      render(<AdvancedStaticChatBuilder {...defaultProps} />);

      // Welcome section should not be rendered when welcomeMessage is empty
      await waitFor(() => {
        expect(
          screen.queryByTestId('markdown-content'),
        ).not.toBeInTheDocument();
      });
    });

    it('should handle markdown with special characters', async () => {
      mockUseWelcome.mockReturnValue({
        welcomeMessage: 'Hello! How can I help you? 🤖',
      });

      render(<AdvancedStaticChatBuilder {...defaultProps} />);

      await waitFor(() => {
        const markdownContent = screen.getByTestId('markdown-content');
        expect(markdownContent).toHaveTextContent(
          'Hello! How can I help you? 🤖',
        );
      });
    });

    it('should handle multiline markdown content', async () => {
      mockUseWelcome.mockReturnValue({
        welcomeMessage: 'Line 1\nLine 2\n- Item 1',
      });

      render(<AdvancedStaticChatBuilder {...defaultProps} />);

      await waitFor(() => {
        const markdownContent = screen.getByTestId('markdown-content');
        // DOM normalizes whitespace, so we check that content is present
        expect(markdownContent).toHaveTextContent('Line 1');
        expect(markdownContent).toHaveTextContent('Line 2');
        expect(markdownContent).toHaveTextContent('Item 1');
      });
    });
  });

  describe('welcome section visibility', () => {
    it('should show welcome section when no prompts and not loading', async () => {
      mockUseLazyGetPromptsSearchQuery.mockReturnValue([
        mockTriggerGetPromptsSearch,
        { isLoading: false },
      ]);
      mockUseLazyGetGuidedPromptsQuery.mockReturnValue([
        mockTriggerGetGuidedPrompts,
        { isLoading: false },
      ]);

      render(<AdvancedStaticChatBuilder {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('markdown-content')).toBeInTheDocument();
      });
    });

    it('should hide welcome section when prompts are present', async () => {
      mockTriggerGetPromptsSearch.mockResolvedValue({
        data: {
          results: [{ prompt: 'Test prompt' }],
        },
      });

      render(<AdvancedStaticChatBuilder {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.queryByTestId('markdown-content'),
        ).not.toBeInTheDocument();
      });
    });

    it('should hide welcome section when loading suggested prompts', () => {
      mockUseLazyGetPromptsSearchQuery.mockReturnValue([
        mockTriggerGetPromptsSearch,
        { isLoading: true },
      ]);

      render(<AdvancedStaticChatBuilder {...defaultProps} />);

      expect(screen.queryByTestId('markdown-content')).not.toBeInTheDocument();
    });

    it('should hide welcome section when loading guided prompts', () => {
      mockUseLazyGetGuidedPromptsQuery.mockReturnValue([
        mockTriggerGetGuidedPrompts,
        { isLoading: true },
      ]);

      render(<AdvancedStaticChatBuilder {...defaultProps} />);

      expect(screen.queryByTestId('markdown-content')).not.toBeInTheDocument();
    });
  });

  describe('useWelcome hook integration', () => {
    it('should pass correct props to useWelcome hook', () => {
      mockConfig.baseWsUrl.mockReturnValue('wss://test.com');

      render(
        <AdvancedStaticChatBuilder
          {...defaultProps}
          sessionId="session-456"
          username="user-123"
          tenantKey="tenant-456"
          mentorUniqueId="mentor-789"
        />,
      );

      expect(mockUseWelcome).toHaveBeenCalledWith({
        sessionId: 'session-456',
        username: 'user-123',
        tenantKey: 'tenant-456',
        mentorUniqueId: 'mentor-789',
        token: 'test-token',
        wsUrl: 'wss://test.com/ws/langflow/',
      });
    });

    it('should use "anonymous" for username when empty', () => {
      render(<AdvancedStaticChatBuilder {...defaultProps} username="" />);

      expect(mockUseWelcome).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'anonymous',
        }),
      );
    });
  });

  describe('options tab', () => {
    it('should render OptionsTag with correct props', () => {
      render(
        <AdvancedStaticChatBuilder
          {...defaultProps}
          activeTab={'options' as AdvancedTab}
        />,
      );

      expect(screen.getByTestId('options-tag')).toBeInTheDocument();
      expect(screen.getByTestId('options-title')).toHaveTextContent('Options');
      expect(screen.getByTestId('options-mentor-name')).toHaveTextContent(
        'Test Mentor',
      );
      expect(screen.getByTestId('options-profile-image')).toHaveTextContent(
        'https://example.com/image.jpg',
      );
    });
  });

  describe('prompt fetching', () => {
    it('should fetch prompts when conditions are met', async () => {
      render(<AdvancedStaticChatBuilder {...defaultProps} />);

      await waitFor(() => {
        expect(mockTriggerGetPromptsSearch).toHaveBeenCalledWith(
          expect.objectContaining({
            org: 'test-tenant',
            username: 'test-user',
            mentor: 'mentor-123',
          }),
          true,
        );
      });
    });

    it('should not fetch prompts when tenantKey is missing', async () => {
      render(<AdvancedStaticChatBuilder {...defaultProps} tenantKey="" />);

      await waitFor(() => {
        expect(mockTriggerGetPromptsSearch).not.toHaveBeenCalled();
      });
    });

    it('should not fetch prompts when sessionId is missing', async () => {
      render(<AdvancedStaticChatBuilder {...defaultProps} sessionId="" />);

      await waitFor(() => {
        expect(mockTriggerGetPromptsSearch).not.toHaveBeenCalled();
      });
    });

    it('should not fetch prompts when mentorUniqueId is missing', async () => {
      render(<AdvancedStaticChatBuilder {...defaultProps} mentorUniqueId="" />);

      await waitFor(() => {
        expect(mockTriggerGetPromptsSearch).not.toHaveBeenCalled();
      });
    });

    it('should fallback to guided prompts when suggested prompts are empty', async () => {
      mockTriggerGetPromptsSearch.mockResolvedValue({
        data: { results: [] },
      });
      mockTriggerGetGuidedPrompts.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({
          ai_prompts: ['Guided prompt 1', 'Guided prompt 2'],
        }),
      });

      render(<AdvancedStaticChatBuilder {...defaultProps} />);

      await waitFor(() => {
        expect(mockTriggerGetGuidedPrompts).toHaveBeenCalled();
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty mentor name', async () => {
      render(<AdvancedStaticChatBuilder {...defaultProps} mentorName="" />);

      await waitFor(() => {
        const heading = screen.getByRole('heading', { level: 1 });
        expect(heading.textContent).toBe('');
      });
    });

    it('should handle very long mentor name', async () => {
      const longName = 'A'.repeat(100);
      render(
        <AdvancedStaticChatBuilder {...defaultProps} mentorName={longName} />,
      );

      await waitFor(() => {
        expect(screen.getByText(longName)).toBeInTheDocument();
      });
    });

    it('should handle null welcome message from hook', async () => {
      mockUseWelcome.mockReturnValue({ welcomeMessage: null });

      render(<AdvancedStaticChatBuilder {...defaultProps} />);

      // Welcome section should not be rendered when welcomeMessage is null/falsy
      await waitFor(() => {
        expect(
          screen.queryByTestId('markdown-content'),
        ).not.toBeInTheDocument();
      });
    });

    it('should handle undefined welcome message from hook', async () => {
      mockUseWelcome.mockReturnValue({ welcomeMessage: undefined });

      render(<AdvancedStaticChatBuilder {...defaultProps} />);

      // Welcome section should not be rendered when welcomeMessage is undefined/falsy
      await waitFor(() => {
        expect(
          screen.queryByTestId('markdown-content'),
        ).not.toBeInTheDocument();
      });
    });

    it('should use "anonymous" as username when username prop is undefined', () => {
      render(
        <AdvancedStaticChatBuilder
          {...defaultProps}
          username={undefined as any}
        />,
      );

      expect(mockUseWelcome).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'anonymous',
        }),
      );
    });
  });

  describe('avatar fallback', () => {
    it('should show first two letters of mentor name as fallback', async () => {
      render(
        <AdvancedStaticChatBuilder
          {...defaultProps}
          mentorName="AI Assistant"
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('AI')).toBeInTheDocument();
      });
    });

    it('should handle three letter mentor name for fallback', async () => {
      render(<AdvancedStaticChatBuilder {...defaultProps} mentorName="ABC" />);

      await waitFor(() => {
        expect(screen.getByText('AB')).toBeInTheDocument();
      });
    });
  });

  describe('accessibility', () => {
    it('should have proper heading structure', async () => {
      render(<AdvancedStaticChatBuilder {...defaultProps} />);

      await waitFor(() => {
        const heading = screen.getByRole('heading', { level: 1 });
        expect(heading).toBeInTheDocument();
        expect(heading).toHaveTextContent('Test Mentor');
      });
    });

    it('should render avatar with fallback text', async () => {
      render(<AdvancedStaticChatBuilder {...defaultProps} />);

      await waitFor(() => {
        // Avatar fallback shows first 2 letters
        expect(screen.getByText('TE')).toBeInTheDocument();
      });
    });
  });
});
