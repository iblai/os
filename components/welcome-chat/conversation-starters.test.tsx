import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ConversationStarters } from './conversation-starters';

// ============================================================================
// MOCKS
// ============================================================================

const mockUseUsername = vi.fn();
const mockUseParams = vi.fn();
const mockUseAppSelector = vi.fn();
const mockUseMentorSettings = vi.fn();
const mockUseGetGuidedPromptsQuery = vi.fn();
const mockCheckRbacPermission = vi.fn();

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => mockUseUsername(),
}));

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

vi.mock('@/lib/hooks', () => ({
  useAppSelector: (selector: any) => mockUseAppSelector(selector),
}));

vi.mock('@/features/rbac/rbac-slice', () => ({
  selectRbacPermissions: vi.fn(),
}));

vi.mock('@/hoc/withPermissions', () => ({
  checkRbacPermission: (...args: unknown[]) => mockCheckRbacPermission(...args),
}));

vi.mock('@/hooks/use-mentors/use-mentor-settings', () => ({
  useMentorSettings: () => mockUseMentorSettings(),
}));

vi.mock('@data-layer/index', () => ({
  useGetGuidedPromptsQuery: (...args: unknown[]) => mockUseGetGuidedPromptsQuery(...args),
}));

// Mock the UI components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, onClick, onKeyDown, tabIndex, role, className, ...props }: any) => (
    <div
      onClick={onClick}
      onKeyDown={onKeyDown}
      tabIndex={tabIndex}
      role={role}
      className={className}
      {...props}
    >
      {children}
    </div>
  ),
  CardContent: ({ children, className }: any) => <div className={className}>{children}</div>,
}));

// Mock lucide-react
vi.mock('lucide-react', () => ({
  Globe: ({ className }: any) => (
    <span data-testid="globe-icon" className={className}>
      Globe
    </span>
  ),
}));

// Mock lucide-react/dynamic
vi.mock('lucide-react/dynamic', () => ({
  DynamicIcon: ({ name, className }: any) => (
    <span data-testid={`dynamic-icon-${name}`} className={className}>
      {name}
    </span>
  ),
  iconNames: ['home', 'settings', 'user', 'search', 'star', 'heart'],
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
}));

// ============================================================================
// TEST DATA
// ============================================================================

const mockGuidedPrompts = {
  results: [
    { prompt: 'What is machine learning?', icon: 'home' },
    { prompt: 'How do I get started?', icon: 'search' },
    { prompt: 'Tell me about AI', icon: null },
  ],
};

const mockRbacPermissions = { '/mentors/mentor-db-123/': { chat: true } };

const defaultMocks = () => {
  mockUseUsername.mockReturnValue('testuser');
  mockUseParams.mockReturnValue({ tenantKey: 'test-tenant', mentorId: 'test-mentor' });
  mockUseAppSelector.mockReturnValue(mockRbacPermissions);
  mockUseMentorSettings.mockReturnValue({
    data: { mentorDbId: 'mentor-db-123' },
  });
  mockUseGetGuidedPromptsQuery.mockReturnValue({
    data: mockGuidedPrompts,
  });
  mockCheckRbacPermission.mockReturnValue(true);
};

// ============================================================================
// TESTS
// ============================================================================

describe('ConversationStarters', () => {
  const mockOnTemplateSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    defaultMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Rendering', () => {
    it('renders the component with heading', () => {
      render(
        <ConversationStarters
          onTemplateSelect={mockOnTemplateSelect}
          enabledGuidedPrompts={true}
          sessionId="session-123"
        />,
      );

      expect(screen.getByRole('heading', { name: /Conversation Starters/i })).toBeInTheDocument();
    });

    it('renders all guided prompts', () => {
      render(
        <ConversationStarters
          onTemplateSelect={mockOnTemplateSelect}
          enabledGuidedPrompts={true}
          sessionId="session-123"
        />,
      );

      expect(screen.getByText('What is machine learning?')).toBeInTheDocument();
      expect(screen.getByText('How do I get started?')).toBeInTheDocument();
      expect(screen.getByText('Tell me about AI')).toBeInTheDocument();
    });

    it('renders cards with proper accessibility attributes', () => {
      render(
        <ConversationStarters
          onTemplateSelect={mockOnTemplateSelect}
          enabledGuidedPrompts={true}
          sessionId="session-123"
        />,
      );

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(3);

      expect(buttons[0]).toHaveAttribute(
        'aria-label',
        'Select starter template: What is machine learning?',
      );
      expect(buttons[0]).toHaveAttribute('tabIndex', '0');
      expect(buttons[0]).toHaveAttribute('aria-disabled', 'false');
    });

    it('returns null when guidedPrompts is undefined', () => {
      mockUseGetGuidedPromptsQuery.mockReturnValue({
        data: undefined,
      });

      const { container } = render(
        <ConversationStarters
          onTemplateSelect={mockOnTemplateSelect}
          enabledGuidedPrompts={true}
          sessionId="session-123"
        />,
      );

      expect(container.firstChild).toBeNull();
    });

    it('returns null when guidedPrompts.results is empty', () => {
      mockUseGetGuidedPromptsQuery.mockReturnValue({
        data: { results: [] },
      });

      const { container } = render(
        <ConversationStarters
          onTemplateSelect={mockOnTemplateSelect}
          enabledGuidedPrompts={true}
          sessionId="session-123"
        />,
      );

      expect(container.firstChild).toBeNull();
    });

    it('returns null when guidedPrompts.results is undefined', () => {
      mockUseGetGuidedPromptsQuery.mockReturnValue({
        data: { results: undefined },
      });

      const { container } = render(
        <ConversationStarters
          onTemplateSelect={mockOnTemplateSelect}
          enabledGuidedPrompts={true}
          sessionId="session-123"
        />,
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('Icon component', () => {
    it('renders DynamicIcon when icon name is valid', () => {
      render(
        <ConversationStarters
          onTemplateSelect={mockOnTemplateSelect}
          enabledGuidedPrompts={true}
          sessionId="session-123"
        />,
      );

      expect(screen.getByTestId('dynamic-icon-home')).toBeInTheDocument();
      expect(screen.getByTestId('dynamic-icon-search')).toBeInTheDocument();
    });

    it('renders Globe icon when icon is null', () => {
      mockUseGetGuidedPromptsQuery.mockReturnValue({
        data: {
          results: [{ prompt: 'Test prompt', icon: null }],
        },
      });

      render(
        <ConversationStarters
          onTemplateSelect={mockOnTemplateSelect}
          enabledGuidedPrompts={true}
          sessionId="session-123"
        />,
      );

      expect(screen.getByTestId('globe-icon')).toBeInTheDocument();
    });

    it('renders Globe icon when icon name is not in iconNames', () => {
      mockUseGetGuidedPromptsQuery.mockReturnValue({
        data: {
          results: [{ prompt: 'Test prompt', icon: 'invalid-icon-name' }],
        },
      });

      render(
        <ConversationStarters
          onTemplateSelect={mockOnTemplateSelect}
          enabledGuidedPrompts={true}
          sessionId="session-123"
        />,
      );

      expect(screen.getByTestId('globe-icon')).toBeInTheDocument();
    });
  });

  describe('User interactions', () => {
    it('calls onTemplateSelect when clicking a card', async () => {
      const user = userEvent.setup();

      render(
        <ConversationStarters
          onTemplateSelect={mockOnTemplateSelect}
          enabledGuidedPrompts={true}
          sessionId="session-123"
        />,
      );

      const firstCard = screen.getAllByRole('button')[0];
      await user.click(firstCard);

      expect(mockOnTemplateSelect).toHaveBeenCalledWith('What is machine learning?');
    });

    it('calls onTemplateSelect when pressing Enter', () => {
      render(
        <ConversationStarters
          onTemplateSelect={mockOnTemplateSelect}
          enabledGuidedPrompts={true}
          sessionId="session-123"
        />,
      );

      const firstCard = screen.getAllByRole('button')[0];
      fireEvent.keyDown(firstCard, { key: 'Enter' });

      expect(mockOnTemplateSelect).toHaveBeenCalledWith('What is machine learning?');
    });

    it('calls onTemplateSelect when pressing Space', () => {
      render(
        <ConversationStarters
          onTemplateSelect={mockOnTemplateSelect}
          enabledGuidedPrompts={true}
          sessionId="session-123"
        />,
      );

      const firstCard = screen.getAllByRole('button')[0];
      fireEvent.keyDown(firstCard, { key: ' ' });

      expect(mockOnTemplateSelect).toHaveBeenCalledWith('What is machine learning?');
    });

    it('does not call onTemplateSelect when pressing other keys', () => {
      render(
        <ConversationStarters
          onTemplateSelect={mockOnTemplateSelect}
          enabledGuidedPrompts={true}
          sessionId="session-123"
        />,
      );

      const firstCard = screen.getAllByRole('button')[0];
      fireEvent.keyDown(firstCard, { key: 'Tab' });

      expect(mockOnTemplateSelect).not.toHaveBeenCalled();
    });
  });

  describe('RBAC permissions', () => {
    it('disables cards when user does not have chat permission', async () => {
      mockCheckRbacPermission.mockReturnValue(false);

      render(
        <ConversationStarters
          onTemplateSelect={mockOnTemplateSelect}
          enabledGuidedPrompts={true}
          sessionId="session-123"
        />,
      );

      const cards = screen.getAllByRole('button');

      // Check disabled styling class is applied
      expect(cards[0].className).toContain('opacity-50');
      expect(cards[0].className).toContain('cursor-not-allowed');

      // Check accessibility attributes
      expect(cards[0]).toHaveAttribute('tabIndex', '-1');
      expect(cards[0]).toHaveAttribute('aria-disabled', 'true');
    });

    it('does not call onTemplateSelect when clicking disabled card', async () => {
      const user = userEvent.setup();
      mockCheckRbacPermission.mockReturnValue(false);

      render(
        <ConversationStarters
          onTemplateSelect={mockOnTemplateSelect}
          enabledGuidedPrompts={true}
          sessionId="session-123"
        />,
      );

      const firstCard = screen.getAllByRole('button')[0];
      await user.click(firstCard);

      expect(mockOnTemplateSelect).not.toHaveBeenCalled();
    });

    it('does not call onTemplateSelect when pressing Enter on disabled card', () => {
      mockCheckRbacPermission.mockReturnValue(false);

      render(
        <ConversationStarters
          onTemplateSelect={mockOnTemplateSelect}
          enabledGuidedPrompts={true}
          sessionId="session-123"
        />,
      );

      const firstCard = screen.getAllByRole('button')[0];
      fireEvent.keyDown(firstCard, { key: 'Enter' });

      expect(mockOnTemplateSelect).not.toHaveBeenCalled();
    });

    it('does not call onTemplateSelect when pressing Space on disabled card', () => {
      mockCheckRbacPermission.mockReturnValue(false);

      render(
        <ConversationStarters
          onTemplateSelect={mockOnTemplateSelect}
          enabledGuidedPrompts={true}
          sessionId="session-123"
        />,
      );

      const firstCard = screen.getAllByRole('button')[0];
      fireEvent.keyDown(firstCard, { key: ' ' });

      expect(mockOnTemplateSelect).not.toHaveBeenCalled();
    });

    it('checks RBAC permission with correct resource path', () => {
      render(
        <ConversationStarters
          onTemplateSelect={mockOnTemplateSelect}
          enabledGuidedPrompts={true}
          sessionId="session-123"
        />,
      );

      expect(mockCheckRbacPermission).toHaveBeenCalledWith(
        mockRbacPermissions,
        '/mentors/mentor-db-123/#chat',
      );
    });

    it('enables cards when mentorDbId is not available', () => {
      mockUseMentorSettings.mockReturnValue({
        data: { mentorDbId: null },
      });
      // When mentorDbId is null, hasChatPermission defaults to true

      render(
        <ConversationStarters
          onTemplateSelect={mockOnTemplateSelect}
          enabledGuidedPrompts={true}
          sessionId="session-123"
        />,
      );

      const cards = screen.getAllByRole('button');
      expect(cards[0]).toHaveAttribute('tabIndex', '0');
      expect(cards[0]).toHaveAttribute('aria-disabled', 'false');
    });

    it('enables cards when mentor RBAC data is not loaded (e.g., 403 from permissions API)', () => {
      // Simulate RBAC permissions missing the mentor key (e.g., API returned 403)
      mockUseAppSelector.mockReturnValue({});
      mockCheckRbacPermission.mockReturnValue(false);

      render(
        <ConversationStarters
          onTemplateSelect={mockOnTemplateSelect}
          enabledGuidedPrompts={true}
          sessionId="session-123"
        />,
      );

      const cards = screen.getAllByRole('button');
      expect(cards[0]).toHaveAttribute('tabIndex', '0');
      expect(cards[0]).toHaveAttribute('aria-disabled', 'false');
      expect(mockCheckRbacPermission).not.toHaveBeenCalled();
    });

    it('enables cards when mentorSettings data is undefined', () => {
      mockUseMentorSettings.mockReturnValue({
        data: undefined,
      });

      render(
        <ConversationStarters
          onTemplateSelect={mockOnTemplateSelect}
          enabledGuidedPrompts={true}
          sessionId="session-123"
        />,
      );

      const cards = screen.getAllByRole('button');
      expect(cards[0]).toHaveAttribute('tabIndex', '0');
      expect(cards[0]).toHaveAttribute('aria-disabled', 'false');
    });
  });

  describe('Query parameters', () => {
    it('calls useGetGuidedPromptsQuery with correct parameters', () => {
      render(
        <ConversationStarters
          onTemplateSelect={mockOnTemplateSelect}
          enabledGuidedPrompts={true}
          sessionId="session-123"
        />,
      );

      expect(mockUseGetGuidedPromptsQuery).toHaveBeenCalledWith(
        {
          org: 'test-tenant',
          sessionId: 'session-123',
          userId: 'testuser',
        },
        {
          skip: false,
        },
      );
    });

    it('skips query when enabledGuidedPrompts is false', () => {
      render(
        <ConversationStarters
          onTemplateSelect={mockOnTemplateSelect}
          enabledGuidedPrompts={false}
          sessionId="session-123"
        />,
      );

      expect(mockUseGetGuidedPromptsQuery).toHaveBeenCalledWith(expect.anything(), {
        skip: true,
      });
    });

    it('skips query when tenantKey is empty', () => {
      mockUseParams.mockReturnValue({ tenantKey: '', mentorId: 'test-mentor' });

      render(
        <ConversationStarters
          onTemplateSelect={mockOnTemplateSelect}
          enabledGuidedPrompts={true}
          sessionId="session-123"
        />,
      );

      expect(mockUseGetGuidedPromptsQuery).toHaveBeenCalledWith(expect.anything(), {
        skip: true,
      });
    });

    it('skips query when sessionId is empty', () => {
      render(
        <ConversationStarters
          onTemplateSelect={mockOnTemplateSelect}
          enabledGuidedPrompts={true}
          sessionId=""
        />,
      );

      expect(mockUseGetGuidedPromptsQuery).toHaveBeenCalledWith(expect.anything(), {
        skip: true,
      });
    });

    it('uses "anonymous" as username when useUsername returns null', () => {
      mockUseUsername.mockReturnValue(null);

      render(
        <ConversationStarters
          onTemplateSelect={mockOnTemplateSelect}
          enabledGuidedPrompts={true}
          sessionId="session-123"
        />,
      );

      expect(mockUseGetGuidedPromptsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'anonymous',
        }),
        expect.anything(),
      );
    });

    it('uses "anonymous" as username when useUsername returns undefined', () => {
      mockUseUsername.mockReturnValue(undefined);

      render(
        <ConversationStarters
          onTemplateSelect={mockOnTemplateSelect}
          enabledGuidedPrompts={true}
          sessionId="session-123"
        />,
      );

      expect(mockUseGetGuidedPromptsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'anonymous',
        }),
        expect.anything(),
      );
    });
  });

  describe('Edge cases', () => {
    it('handles single guided prompt', () => {
      mockUseGetGuidedPromptsQuery.mockReturnValue({
        data: {
          results: [{ prompt: 'Single prompt', icon: 'star' }],
        },
      });

      render(
        <ConversationStarters
          onTemplateSelect={mockOnTemplateSelect}
          enabledGuidedPrompts={true}
          sessionId="session-123"
        />,
      );

      expect(screen.getByText('Single prompt')).toBeInTheDocument();
      expect(screen.getAllByRole('button')).toHaveLength(1);
    });

    it('handles many guided prompts', () => {
      const manyPrompts = Array.from({ length: 10 }, (_, i) => ({
        prompt: `Prompt ${i + 1}`,
        icon: 'star',
      }));

      mockUseGetGuidedPromptsQuery.mockReturnValue({
        data: { results: manyPrompts },
      });

      render(
        <ConversationStarters
          onTemplateSelect={mockOnTemplateSelect}
          enabledGuidedPrompts={true}
          sessionId="session-123"
        />,
      );

      expect(screen.getAllByRole('button')).toHaveLength(10);
    });

    it('handles prompts with special characters', () => {
      mockUseGetGuidedPromptsQuery.mockReturnValue({
        data: {
          results: [{ prompt: 'What is <script>alert("xss")</script>?', icon: null }],
        },
      });

      render(
        <ConversationStarters
          onTemplateSelect={mockOnTemplateSelect}
          enabledGuidedPrompts={true}
          sessionId="session-123"
        />,
      );

      expect(screen.getByText('What is <script>alert("xss")</script>?')).toBeInTheDocument();
    });

    it('handles prompts with very long text', () => {
      const longPrompt = 'A'.repeat(500);
      mockUseGetGuidedPromptsQuery.mockReturnValue({
        data: {
          results: [{ prompt: longPrompt, icon: null }],
        },
      });

      render(
        <ConversationStarters
          onTemplateSelect={mockOnTemplateSelect}
          enabledGuidedPrompts={true}
          sessionId="session-123"
        />,
      );

      expect(screen.getByText(longPrompt)).toBeInTheDocument();
    });

    it('handles prompts with unicode characters', () => {
      mockUseGetGuidedPromptsQuery.mockReturnValue({
        data: {
          results: [{ prompt: '你好世界 🌍 مرحبا', icon: null }],
        },
      });

      render(
        <ConversationStarters
          onTemplateSelect={mockOnTemplateSelect}
          enabledGuidedPrompts={true}
          sessionId="session-123"
        />,
      );

      expect(screen.getByText('你好世界 🌍 مرحبا')).toBeInTheDocument();
    });

    it('handles prompts with empty string', () => {
      mockUseGetGuidedPromptsQuery.mockReturnValue({
        data: {
          results: [{ prompt: '', icon: null }],
        },
      });

      render(
        <ConversationStarters
          onTemplateSelect={mockOnTemplateSelect}
          enabledGuidedPrompts={true}
          sessionId="session-123"
        />,
      );

      // Empty prompt should still render a card
      expect(screen.getAllByRole('button')).toHaveLength(1);
    });

    it('handles whitespace-only prompt', () => {
      mockUseGetGuidedPromptsQuery.mockReturnValue({
        data: {
          results: [{ prompt: '   ', icon: null }],
        },
      });

      render(
        <ConversationStarters
          onTemplateSelect={mockOnTemplateSelect}
          enabledGuidedPrompts={true}
          sessionId="session-123"
        />,
      );

      expect(screen.getAllByRole('button')).toHaveLength(1);
    });
  });

  describe('Styling', () => {
    it('applies enabled styling classes when chat is allowed', () => {
      render(
        <ConversationStarters
          onTemplateSelect={mockOnTemplateSelect}
          enabledGuidedPrompts={true}
          sessionId="session-123"
        />,
      );

      const card = screen.getAllByRole('button')[0];
      expect(card.className).toContain('cursor-pointer');
      expect(card.className).toContain('hover:shadow-sm');
    });

    it('applies disabled styling classes when chat is not allowed', () => {
      mockCheckRbacPermission.mockReturnValue(false);

      render(
        <ConversationStarters
          onTemplateSelect={mockOnTemplateSelect}
          enabledGuidedPrompts={true}
          sessionId="session-123"
        />,
      );

      const card = screen.getAllByRole('button')[0];
      expect(card.className).toContain('opacity-50');
      expect(card.className).toContain('cursor-not-allowed');
      expect(card.className).not.toContain('cursor-pointer');
    });
  });
});
