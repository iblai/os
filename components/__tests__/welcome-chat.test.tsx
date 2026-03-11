import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { WelcomeChat } from '../welcome-chat';

// Mock dependencies - hoist variables used in vi.mock factories
const {
  mockUseUsername,
  mockUseAxdToken,
  mockUseParams,
  mockUseWelcome,
  mockUseGetGuidedPromptsQuery,
  mockUseGetPromptsSearchQuery,
  mockUseMentorSettings,
  mockConfig,
} = vi.hoisted(() => ({
  mockUseUsername: vi.fn(),
  mockUseAxdToken: vi.fn(),
  mockUseParams: vi.fn(),
  mockUseWelcome: vi.fn(),
  mockUseGetGuidedPromptsQuery: vi.fn(),
  mockUseGetPromptsSearchQuery: vi.fn(),
  mockUseMentorSettings: vi.fn(),
  mockConfig: {
    baseWsUrl: vi.fn(),
    iblTemplateMentor: vi.fn(() => 'default-mentor'),
    iblAvatarServiceUrl: vi.fn(() => 'https://avatar.example.com'),
  },
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => mockUseUsername(),
}));

vi.mock('@/hooks/use-tokens', () => ({
  useAxdToken: () => mockUseAxdToken(),
}));

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

vi.mock('@/hooks/use-welcome-message', () => ({
  default: (args: any) => mockUseWelcome(args),
}));

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetGuidedPromptsQuery: (args: any, options: any) =>
    mockUseGetGuidedPromptsQuery(args, options),
  useGetPromptsSearchQuery: (args: any, options: any) =>
    mockUseGetPromptsSearchQuery(args, options),
  useGetMentorSettingsQuery: () => ({ data: undefined, isLoading: false }),
  useGetMentorPublicSettingsQuery: () => ({ data: undefined, isLoading: false }),
}));

vi.mock('@/hooks/use-mentors/use-mentor-settings', () => ({
  useMentorSettings: () => mockUseMentorSettings(),
}));

vi.mock('@/lib/config', () => ({
  config: mockConfig,
}));

vi.mock('@/components/markdown', () => ({
  default: ({ children, className }: { children: string; className?: string }) => (
    <div data-testid="markdown-content" className={className}>
      {children}
    </div>
  ),
}));

describe('WelcomeChat', () => {
  const mockOnPromptSelect = vi.fn();

  const defaultProps = {
    onPromptSelect: mockOnPromptSelect,
    mentorName: 'Test Mentor',
    profileImage: 'https://example.com/image.jpg',
    enabledGuidedPrompts: true,
    sessionId: 'session-123',
    mentorUniqueId: 'mentor-123',
    isNewSession: true,
    aiWelcomeMessage: '',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUsername.mockReturnValue('test-user');
    mockUseAxdToken.mockReturnValue('test-token');
    mockUseParams.mockReturnValue({ tenantKey: 'test-tenant', mentorId: 'mentor-123' });
    mockUseWelcome.mockReturnValue({ welcomeMessage: 'Welcome message' });
    mockUseGetGuidedPromptsQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: undefined,
    });
    mockUseGetPromptsSearchQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: undefined,
    });
    mockUseMentorSettings.mockReturnValue({
      data: { starterPrompts: undefined },
    });
    mockConfig.baseWsUrl.mockReturnValue('wss://example.com');
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('basic rendering', () => {
    it('should render mentor name', () => {
      render(<WelcomeChat {...defaultProps} />);
      expect(screen.getByText('Test Mentor')).toBeInTheDocument();
    });

    it('should render mentor avatar container', () => {
      const { container } = render(<WelcomeChat {...defaultProps} />);
      // The avatar container with the ring styling should be present
      const avatarContainer = container.querySelector('.border-2.border-blue-500');
      expect(avatarContainer).toBeInTheDocument();
    });

    it('should render avatar fallback with first two letters of mentor name', () => {
      render(<WelcomeChat {...defaultProps} mentorName="AI Assistant" />);
      expect(screen.getByText('AI')).toBeInTheDocument();
    });

    it('should render welcome message using Markdown component', () => {
      render(<WelcomeChat {...defaultProps} />);
      const markdownContent = screen.getByTestId('markdown-content');
      expect(markdownContent).toBeInTheDocument();
      expect(markdownContent).toHaveTextContent('Welcome message');
    });
  });

  describe('Markdown rendering', () => {
    it('should pass welcome message to Markdown component', () => {
      mockUseWelcome.mockReturnValue({ welcomeMessage: 'Hello **bold** text' });

      render(<WelcomeChat {...defaultProps} />);

      const markdownContent = screen.getByTestId('markdown-content');
      expect(markdownContent).toHaveTextContent('Hello **bold** text');
    });

    it('should pass correct className to Markdown component', () => {
      render(<WelcomeChat {...defaultProps} />);

      const markdownContent = screen.getByTestId('markdown-content');
      expect(markdownContent).toHaveClass('mt-1');
      expect(markdownContent).toHaveClass('text-[14px]');
      expect(markdownContent).toHaveClass('text-gray-600');
    });

    it('should use aiWelcomeMessage when welcomeMessage is empty', () => {
      mockUseWelcome.mockReturnValue({ welcomeMessage: '' });

      render(<WelcomeChat {...defaultProps} aiWelcomeMessage="AI Welcome" />);

      const markdownContent = screen.getByTestId('markdown-content');
      expect(markdownContent).toHaveTextContent('AI Welcome');
    });

    it('should prioritize welcomeMessage over aiWelcomeMessage', () => {
      mockUseWelcome.mockReturnValue({ welcomeMessage: 'Hook Message' });

      render(<WelcomeChat {...defaultProps} aiWelcomeMessage="AI Message" />);

      const markdownContent = screen.getByTestId('markdown-content');
      expect(markdownContent).toHaveTextContent('Hook Message');
      expect(markdownContent).not.toHaveTextContent('AI Message');
    });

    it('should render empty string when both messages are empty', () => {
      mockUseWelcome.mockReturnValue({ welcomeMessage: '' });

      render(<WelcomeChat {...defaultProps} aiWelcomeMessage="" />);

      const markdownContent = screen.getByTestId('markdown-content');
      expect(markdownContent.textContent).toBe('');
    });

    it('should handle markdown content with special characters', () => {
      mockUseWelcome.mockReturnValue({
        welcomeMessage: 'Hello! How can I help you? 🤖',
      });

      render(<WelcomeChat {...defaultProps} />);

      const markdownContent = screen.getByTestId('markdown-content');
      expect(markdownContent).toHaveTextContent('Hello! How can I help you? 🤖');
    });

    it('should handle multiline markdown content', () => {
      mockUseWelcome.mockReturnValue({
        welcomeMessage: 'Line 1\nLine 2\n- Item 1\n- Item 2',
      });

      render(<WelcomeChat {...defaultProps} />);

      const markdownContent = screen.getByTestId('markdown-content');
      // DOM normalizes whitespace, so we check that content is present
      expect(markdownContent).toHaveTextContent('Line 1');
      expect(markdownContent).toHaveTextContent('Line 2');
      expect(markdownContent).toHaveTextContent('Item 1');
      expect(markdownContent).toHaveTextContent('Item 2');
    });
  });

  describe('guided prompts', () => {
    it('should render guided prompts when available', () => {
      mockUseGetGuidedPromptsQuery.mockReturnValue({
        data: {
          ai_prompts: ['Prompt 1', 'Prompt 2', 'Prompt 3'],
        },
        isLoading: false,
        error: undefined,
      });

      render(<WelcomeChat {...defaultProps} />);

      expect(screen.getByText('Prompt 1')).toBeInTheDocument();
      expect(screen.getByText('Prompt 2')).toBeInTheDocument();
      expect(screen.getByText('Prompt 3')).toBeInTheDocument();
    });

    it('should limit guided prompts to 4', () => {
      mockUseGetGuidedPromptsQuery.mockReturnValue({
        data: {
          ai_prompts: ['Prompt 1', 'Prompt 2', 'Prompt 3', 'Prompt 4', 'Prompt 5'],
        },
        isLoading: false,
        error: undefined,
      });

      render(<WelcomeChat {...defaultProps} />);

      expect(screen.getByText('Prompt 1')).toBeInTheDocument();
      expect(screen.getByText('Prompt 2')).toBeInTheDocument();
      expect(screen.getByText('Prompt 3')).toBeInTheDocument();
      expect(screen.getByText('Prompt 4')).toBeInTheDocument();
      expect(screen.queryByText('Prompt 5')).not.toBeInTheDocument();
    });

    it('should call onPromptSelect when a prompt is clicked', () => {
      mockUseGetGuidedPromptsQuery.mockReturnValue({
        data: {
          ai_prompts: ['Test Prompt'],
        },
        isLoading: false,
        error: undefined,
      });

      render(<WelcomeChat {...defaultProps} />);

      const promptButton = screen.getByText('Test Prompt');
      fireEvent.click(promptButton);

      expect(mockOnPromptSelect).toHaveBeenCalledWith('Test Prompt');
    });

    it('should not render guided prompts when enabledGuidedPrompts is false', () => {
      mockUseGetGuidedPromptsQuery.mockReturnValue({
        data: {
          ai_prompts: ['Prompt 1'],
        },
        isLoading: false,
        error: undefined,
      });

      render(<WelcomeChat {...defaultProps} enabledGuidedPrompts={false} />);

      expect(screen.queryByText('Prompt 1')).not.toBeInTheDocument();
    });

    it('should hide mentor info when guided prompts are present', () => {
      mockUseGetGuidedPromptsQuery.mockReturnValue({
        data: {
          ai_prompts: ['Prompt 1', 'Prompt 2'],
        },
        isLoading: false,
        error: undefined,
      });

      render(<WelcomeChat {...defaultProps} />);

      expect(screen.queryByText('Test Mentor')).not.toBeInTheDocument();
      expect(screen.queryByTestId('markdown-content')).not.toBeInTheDocument();
    });

    it('should show mentor info when no guided prompts', () => {
      mockUseGetGuidedPromptsQuery.mockReturnValue({
        data: {
          ai_prompts: [],
        },
        isLoading: false,
        error: undefined,
      });

      render(<WelcomeChat {...defaultProps} />);

      expect(screen.getByText('Test Mentor')).toBeInTheDocument();
      expect(screen.getByTestId('markdown-content')).toBeInTheDocument();
    });
  });

  describe('useWelcome hook integration', () => {
    it('should pass correct props to useWelcome hook', () => {
      mockConfig.baseWsUrl.mockReturnValue('wss://test.com');

      render(
        <WelcomeChat
          {...defaultProps}
          sessionId="session-456"
          mentorUniqueId="mentor-789"
          isNewSession={false}
        />,
      );

      expect(mockUseWelcome).toHaveBeenCalledWith({
        sessionId: 'session-456',
        username: 'test-user',
        tenantKey: 'test-tenant',
        mentorUniqueId: 'mentor-789',
        token: 'test-token',
        wsUrl: 'wss://test.com/ws/langflow/',
        isNewSession: false,
      });
    });

    it('should use empty string for username when not available', () => {
      mockUseUsername.mockReturnValue(null);

      render(<WelcomeChat {...defaultProps} />);

      expect(mockUseWelcome).toHaveBeenCalledWith(
        expect.objectContaining({
          username: '',
        }),
      );
    });

    it('should default isNewSession to true', () => {
      render(<WelcomeChat {...defaultProps} isNewSession={undefined as any} />);

      expect(mockUseWelcome).toHaveBeenCalledWith(
        expect.objectContaining({
          isNewSession: true,
        }),
      );
    });
  });

  describe('useGetGuidedPromptsQuery integration', () => {
    it('should skip query when enabledGuidedPrompts is false', () => {
      render(<WelcomeChat {...defaultProps} enabledGuidedPrompts={false} />);

      expect(mockUseGetGuidedPromptsQuery).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          skip: true,
        }),
      );
    });

    it('should skip query when tenantKey is missing', () => {
      mockUseParams.mockReturnValue({ tenantKey: undefined });

      render(<WelcomeChat {...defaultProps} />);

      expect(mockUseGetGuidedPromptsQuery).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          skip: true,
        }),
      );
    });

    it('should skip query when sessionId is empty', () => {
      render(<WelcomeChat {...defaultProps} sessionId="" />);

      expect(mockUseGetGuidedPromptsQuery).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          skip: true,
        }),
      );
    });

    it('should use "anonymous" for username when not available', () => {
      mockUseUsername.mockReturnValue(null);

      render(<WelcomeChat {...defaultProps} />);

      expect(mockUseGetGuidedPromptsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'anonymous',
        }),
        expect.any(Object),
      );
    });
  });

  describe('edge cases', () => {
    it('should handle empty mentor name', () => {
      render(<WelcomeChat {...defaultProps} mentorName="" />);

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toBeInTheDocument();
      expect(heading.textContent).toBe('');
    });

    it('should handle very long mentor name', () => {
      const longName = 'A'.repeat(100);
      render(<WelcomeChat {...defaultProps} mentorName={longName} />);

      expect(screen.getByText(longName)).toBeInTheDocument();
    });

    it('should handle empty profile image', () => {
      render(<WelcomeChat {...defaultProps} profileImage="" />);

      // Avatar fallback should be visible
      expect(screen.getByText('TE')).toBeInTheDocument();
    });

    it('should handle invalid profile image URL', () => {
      const { container } = render(<WelcomeChat {...defaultProps} profileImage="invalid-url" />);

      // Avatar container should still be present
      const avatarContainer = container.querySelector('[data-slot="avatar"]');
      expect(avatarContainer).toBeInTheDocument();
    });

    it('should handle null welcome message from hook', () => {
      mockUseWelcome.mockReturnValue({ welcomeMessage: null });

      render(<WelcomeChat {...defaultProps} aiWelcomeMessage="Fallback" />);

      const markdownContent = screen.getByTestId('markdown-content');
      expect(markdownContent).toHaveTextContent('Fallback');
    });

    it('should handle undefined welcome message from hook', () => {
      mockUseWelcome.mockReturnValue({ welcomeMessage: undefined });

      render(<WelcomeChat {...defaultProps} aiWelcomeMessage="Fallback" />);

      const markdownContent = screen.getByTestId('markdown-content');
      expect(markdownContent).toHaveTextContent('Fallback');
    });
  });

  describe('styling and layout', () => {
    it('should have correct container classes', () => {
      const { container } = render(<WelcomeChat {...defaultProps} />);

      const mainContainer = container.querySelector('.rounded-lg.p-4.max-w-2xl.mx-auto.h-full');
      expect(mainContainer).toBeInTheDocument();
    });

    it('should center content when no guided prompts', () => {
      mockUseGetGuidedPromptsQuery.mockReturnValue({
        data: {
          ai_prompts: [],
        },
        isLoading: false,
        error: undefined,
      });

      const { container } = render(<WelcomeChat {...defaultProps} />);

      const mainContainer = container.querySelector('.justify-center');
      expect(mainContainer).toBeInTheDocument();
    });

    it('should not center content when guided prompts exist', () => {
      mockUseGetGuidedPromptsQuery.mockReturnValue({
        data: {
          ai_prompts: ['Prompt 1'],
        },
        isLoading: false,
        error: undefined,
      });

      const { container } = render(<WelcomeChat {...defaultProps} />);

      const mainContainer = container.querySelector('.justify-center');
      expect(mainContainer).not.toBeInTheDocument();
    });

    it('should apply correct avatar ring class', () => {
      const { container } = render(<WelcomeChat {...defaultProps} />);

      // Check for the avatar container having the correct border
      const avatarContainer = container.querySelector('.border-2.border-blue-500');
      expect(avatarContainer).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have proper heading structure', () => {
      render(<WelcomeChat {...defaultProps} />);

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent('Test Mentor');
    });

    it('should render avatar with mentor name fallback', () => {
      render(<WelcomeChat {...defaultProps} />);

      // Avatar fallback shows first 2 letters
      expect(screen.getByText('TE')).toBeInTheDocument();
    });

    it('should have accessible prompt buttons', () => {
      mockUseGetGuidedPromptsQuery.mockReturnValue({
        data: {
          ai_prompts: ['Prompt 1'],
        },
        isLoading: false,
        error: undefined,
      });

      render(<WelcomeChat {...defaultProps} />);

      const button = screen.getByRole('button', { name: /Prompt 1/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('type', 'button');
    });
  });

  describe('suggested prompts', () => {
    beforeEach(() => {
      mockUseMentorSettings.mockReturnValue({
        data: { starterPrompts: 'suggested_prompt' },
      });
    });

    it('should render suggested prompts when starterPrompts is suggested_prompt', () => {
      mockUseGetPromptsSearchQuery.mockReturnValue({
        data: {
          results: [
            { id: '1', prompt: 'Suggested 1' },
            { id: '2', prompt: 'Suggested 2' },
          ],
        },
        isLoading: false,
        error: undefined,
      });

      render(<WelcomeChat {...defaultProps} />);

      expect(screen.getByText('Suggested 1')).toBeInTheDocument();
      expect(screen.getByText('Suggested 2')).toBeInTheDocument();
    });

    it('should call onPromptSelect when a suggested prompt is clicked', () => {
      mockUseGetPromptsSearchQuery.mockReturnValue({
        data: {
          results: [{ id: '1', prompt: 'Click me' }],
        },
        isLoading: false,
        error: undefined,
      });

      render(<WelcomeChat {...defaultProps} />);

      fireEvent.click(screen.getByText('Click me'));
      expect(mockOnPromptSelect).toHaveBeenCalledWith('Click me');
    });

    it('should limit suggested prompts to 4', () => {
      mockUseGetPromptsSearchQuery.mockReturnValue({
        data: {
          results: [
            { id: '1', prompt: 'S1' },
            { id: '2', prompt: 'S2' },
            { id: '3', prompt: 'S3' },
            { id: '4', prompt: 'S4' },
            { id: '5', prompt: 'S5' },
          ],
        },
        isLoading: false,
        error: undefined,
      });

      render(<WelcomeChat {...defaultProps} />);

      expect(screen.getByText('S1')).toBeInTheDocument();
      expect(screen.getByText('S4')).toBeInTheDocument();
      expect(screen.queryByText('S5')).not.toBeInTheDocument();
    });

    it('should render suggested prompts even when enabledGuidedPrompts is false', () => {
      mockUseGetPromptsSearchQuery.mockReturnValue({
        data: {
          results: [{ id: '1', prompt: 'Suggested without guided' }],
        },
        isLoading: false,
        error: undefined,
      });

      render(<WelcomeChat {...defaultProps} enabledGuidedPrompts={false} />);

      expect(screen.getByText('Suggested without guided')).toBeInTheDocument();
    });

    it('should not render guided prompts when in suggested mode', () => {
      mockUseGetGuidedPromptsQuery.mockReturnValue({
        data: { ai_prompts: ['Guided prompt'] },
        isLoading: false,
        error: undefined,
      });
      mockUseGetPromptsSearchQuery.mockReturnValue({
        data: {
          results: [{ id: '1', prompt: 'Suggested prompt' }],
        },
        isLoading: false,
        error: undefined,
      });

      render(<WelcomeChat {...defaultProps} />);

      expect(screen.queryByText('Guided prompt')).not.toBeInTheDocument();
      expect(screen.getByText('Suggested prompt')).toBeInTheDocument();
    });
  });
});
