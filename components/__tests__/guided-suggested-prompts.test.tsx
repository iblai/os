import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GuidedSuggestedPrompts } from '../guided-suggested-prompts';

const mockRefetch = vi.fn();
const mockUseGetGuidedPromptsQuery = vi.fn();

vi.mock('@data-layer/index', () => ({
  useGetGuidedPromptsQuery: (...args: unknown[]) => mockUseGetGuidedPromptsQuery(...args),
}));

vi.mock('@/lib/utils', async () => {
  const actual = await vi.importActual('@/lib/utils');
  return { ...actual };
});

vi.mock('@/lib/constants', () => ({
  CSS_CLASS_NAMES: {
    APP_LAYOUT: {
      GUIDED_SUGGESTED_PROMPTS: 'guided-prompts',
      GUIDED_SUGGESTED_PROMPTS_REFRESH: 'guided-prompts-refresh',
    },
  },
}));

describe('GuidedSuggestedPrompts', () => {
  const defaultProps = {
    enabledGuidedPrompts: true,
    tenantKey: 'test-tenant',
    sessionId: 'test-session',
    username: 'testuser',
    isStreaming: false,
    isPending: false,
    onPromptSelect: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGetGuidedPromptsQuery.mockReturnValue({
      data: { ai_prompts: ['Prompt 1', 'Prompt 2', 'Prompt 3'] },
      refetch: mockRefetch,
      isFetching: false,
      status: 'fulfilled',
    });
  });

  describe('username fallback to anonymous', () => {
    it('should pass the provided username as userId', () => {
      render(<GuidedSuggestedPrompts {...defaultProps} username="realuser" />);

      expect(mockUseGetGuidedPromptsQuery).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'realuser' }),
        expect.any(Object),
      );
    });

    it('should fall back to "anonymous" when username is an empty string', () => {
      render(<GuidedSuggestedPrompts {...defaultProps} username="" />);

      expect(mockUseGetGuidedPromptsQuery).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'anonymous' }),
        expect.any(Object),
      );
    });
  });

  describe('rendering', () => {
    it('should render prompts when data is available', () => {
      render(<GuidedSuggestedPrompts {...defaultProps} />);

      expect(screen.getByText('Prompt 1')).toBeInTheDocument();
      expect(screen.getByText('Prompt 2')).toBeInTheDocument();
      expect(screen.getByText('Prompt 3')).toBeInTheDocument();
    });

    it('should render at most 3 prompts', () => {
      mockUseGetGuidedPromptsQuery.mockReturnValue({
        data: { ai_prompts: ['P1', 'P2', 'P3', 'P4', 'P5'] },
        refetch: mockRefetch,
        isFetching: false,
        status: 'fulfilled',
      });

      render(<GuidedSuggestedPrompts {...defaultProps} />);

      expect(screen.getByText('P1')).toBeInTheDocument();
      expect(screen.getByText('P2')).toBeInTheDocument();
      expect(screen.getByText('P3')).toBeInTheDocument();
      expect(screen.queryByText('P4')).not.toBeInTheDocument();
    });

    it('should return null when enabledGuidedPrompts is false', () => {
      const { container } = render(
        <GuidedSuggestedPrompts {...defaultProps} enabledGuidedPrompts={false} />,
      );

      expect(container.innerHTML).toBe('');
    });

    it('should return null when isStreaming is true', () => {
      const { container } = render(<GuidedSuggestedPrompts {...defaultProps} isStreaming={true} />);

      expect(container.innerHTML).toBe('');
    });

    it('should return null when isPending is true', () => {
      const { container } = render(<GuidedSuggestedPrompts {...defaultProps} isPending={true} />);

      expect(container.innerHTML).toBe('');
    });

    it('should return null when ai_prompts is empty', () => {
      mockUseGetGuidedPromptsQuery.mockReturnValue({
        data: { ai_prompts: [] },
        refetch: mockRefetch,
        isFetching: false,
        status: 'fulfilled',
      });

      const { container } = render(<GuidedSuggestedPrompts {...defaultProps} />);

      expect(container.innerHTML).toBe('');
    });
  });

  describe('interactions', () => {
    it('should call onPromptSelect when a prompt is clicked', () => {
      const onPromptSelect = vi.fn();
      render(<GuidedSuggestedPrompts {...defaultProps} onPromptSelect={onPromptSelect} />);

      fireEvent.click(screen.getByText('Prompt 1'));

      expect(onPromptSelect).toHaveBeenCalledWith('Prompt 1');
    });

    it('should call refetch when refresh button is clicked', () => {
      render(<GuidedSuggestedPrompts {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: 'Refresh Guided Prompts' }));

      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  describe('skip conditions', () => {
    it('should skip query when tenantKey is empty', () => {
      render(<GuidedSuggestedPrompts {...defaultProps} tenantKey="" />);

      expect(mockUseGetGuidedPromptsQuery).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ skip: true }),
      );
    });

    it('should skip query when sessionId is empty', () => {
      render(<GuidedSuggestedPrompts {...defaultProps} sessionId="" />);

      expect(mockUseGetGuidedPromptsQuery).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ skip: true }),
      );
    });

    it('should skip query when enabledGuidedPrompts is false', () => {
      render(<GuidedSuggestedPrompts {...defaultProps} enabledGuidedPrompts={false} />);

      expect(mockUseGetGuidedPromptsQuery).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ skip: true }),
      );
    });

    it('should not skip query when username is empty (falls back to anonymous)', () => {
      render(<GuidedSuggestedPrompts {...defaultProps} username="" />);

      expect(mockUseGetGuidedPromptsQuery).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'anonymous' }),
        expect.objectContaining({ skip: false }),
      );
    });
  });
});
