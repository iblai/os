import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { DefaultMentorsSection } from '../default-mentors-section';
import {
  ExplorePageContext,
  ExplorePageContextValue,
} from '../explore-page-context';
import { TooltipProvider } from '@/components/ui/tooltip';

// Mock the data-layer hooks
const mockUseGetAiSearchMentorsQuery = vi.fn();

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetAiSearchMentorsQuery: (...args: unknown[]) =>
    mockUseGetAiSearchMentorsQuery(...args),
}));

// Mock UI components
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, className, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/spinner', () => ({
  Spinner: ({ className }: any) => (
    <div data-testid="spinner" className={className}>
      Loading...
    </div>
  ),
}));

// Mock child components
vi.mock('../mentor-card-with-star', () => ({
  MentorCardWithStar: ({ mentor }: any) => (
    <div data-testid="mentor-card">{mentor.name}</div>
  ),
}));

// Mock EmptyState component
vi.mock('../empty-state', () => ({
  EmptyState: ({ hint }: { hint?: string }) => (
    <div data-testid="empty-state">
      No mentors found
      {hint && <p>{hint}</p>}
    </div>
  ),
}));

/**
 * Test suite for DefaultMentorsSection component
 *
 * Tests the default/all mentors section display and functionality.
 */
describe('DefaultMentorsSection', () => {
  const mockSetDefaultMentorsLoading = vi.fn();
  const mockToggleFavorite = vi.fn();
  const mockHandleMentorClick = vi.fn();

  const mockContextValue: ExplorePageContextValue = {
    tenantKey: 'test-tenant',
    username: 'test-user',
    debouncedSearch: '',
    isSearching: false,
    filters: {
      categories: null,
      subjects: null,
      llm_providers: null,
      types: null,
      is_featured: null,
    },
    createdBy: 'my-organization',
    includeMainPublicMentors: false,
    togglingMentorId: null,
    toggleFavorite: mockToggleFavorite,
    handleMentorClick: mockHandleMentorClick,
    starredMentorsLoading: false,
    setStarredMentorsLoading: vi.fn(),
    customMentorsLoading: false,
    setCustomMentorsLoading: vi.fn(),
    featuredMentorsLoading: false,
    setFeaturedMentorsLoading: vi.fn(),
    defaultMentorsLoading: false,
    setDefaultMentorsLoading: mockSetDefaultMentorsLoading,
  };

  const mockMentors = [
    {
      id: '1',
      name: 'Mentor 1',
      unique_id: 'mentor-1',
      description: 'First mentor',
    },
    {
      id: '2',
      name: 'Mentor 2',
      unique_id: 'mentor-2',
      description: 'Second mentor',
    },
  ];

  const renderWithContext = (
    contextOverrides: Partial<ExplorePageContextValue> = {},
  ) => {
    return render(
      <TooltipProvider>
        <ExplorePageContext.Provider
          value={{ ...mockContextValue, ...contextOverrides }}
        >
          <DefaultMentorsSection />
        </ExplorePageContext.Provider>
      </TooltipProvider>,
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGetAiSearchMentorsQuery.mockReturnValue({
      data: { results: mockMentors, next: null },
      isLoading: false,
      isFetching: false,
    });
  });

  describe('Basic rendering', () => {
    it('renders the All Mentors heading by default', () => {
      renderWithContext();

      expect(
        screen.getByRole('heading', { name: /All Agents/i }),
      ).toBeInTheDocument();
    });

    it('renders default subtext', () => {
      renderWithContext();

      expect(
        screen.getByText('Explore agents and specialized learning assistants.'),
      ).toBeInTheDocument();
    });

    it('renders mentor cards when mentors exist', () => {
      renderWithContext();

      expect(screen.getByText('Mentor 1')).toBeInTheDocument();
      expect(screen.getByText('Mentor 2')).toBeInTheDocument();
    });

    it('renders mentors list with proper roles', () => {
      renderWithContext();

      expect(
        screen.getByRole('list', { name: /All agents/i }),
      ).toBeInTheDocument();
      expect(screen.getAllByRole('listitem')).toHaveLength(2);
    });

    it('leaves agent creation to the page header', () => {
      renderWithContext();

      expect(
        screen.queryByRole('button', { name: /Create new agent/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe('Dynamic title based on filters', () => {
    it('shows subject as title when subject filter is active', () => {
      renderWithContext({
        filters: {
          categories: null,
          subjects: 'Mathematics',
          llm_providers: null,
          types: null,
          is_featured: null,
        },
      });

      expect(
        screen.getByRole('heading', { name: /Mathematics/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          'Explore mathematics agents and specialized learning assistants.',
        ),
      ).toBeInTheDocument();
    });

    it('shows category as title when category filter is active', () => {
      renderWithContext({
        filters: {
          categories: 'Science',
          subjects: null,
          llm_providers: null,
          types: null,
          is_featured: null,
        },
      });

      expect(
        screen.getByRole('heading', { name: /Science/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          'Explore science agents and specialized learning assistants.',
        ),
      ).toBeInTheDocument();
    });

    it('shows LLM provider as title when llm filter is active', () => {
      renderWithContext({
        filters: {
          categories: null,
          subjects: null,
          llm_providers: 'OpenAI',
          types: null,
          is_featured: null,
        },
      });

      expect(
        screen.getByRole('heading', { name: /OpenAI Agents/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByText('Explore agents powered by OpenAI.'),
      ).toBeInTheDocument();
    });

    it('prioritizes subject over category in title', () => {
      renderWithContext({
        filters: {
          categories: 'Science',
          subjects: 'Physics',
          llm_providers: null,
          types: null,
          is_featured: null,
        },
      });

      expect(
        screen.getByRole('heading', { name: /Physics/i }),
      ).toBeInTheDocument();
    });
  });

  describe('Loading state', () => {
    it('shows spinner when loading', () => {
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: null,
        isLoading: true,
        isFetching: true,
      });

      renderWithContext();

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Loading agents...')).toBeInTheDocument();
    });

    it('calls setDefaultMentorsLoading when fetching state changes', () => {
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: { results: mockMentors, next: null },
        isLoading: false,
        isFetching: true,
      });

      renderWithContext();

      expect(mockSetDefaultMentorsLoading).toHaveBeenCalledWith(true);
    });
  });

  describe('Empty state', () => {
    it('shows empty state when no mentors and not loading', () => {
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: { results: [], next: null },
        isLoading: false,
        isFetching: false,
      });

      renderWithContext();

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(
        screen.getByText('Try a different search term or clear your filters.'),
      ).toBeInTheDocument();
    });
  });

  describe('Search results header', () => {
    it('titles the list with the query and the match count while searching', () => {
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: { results: mockMentors, next: null, count: 2 },
        isLoading: false,
        isFetching: false,
      });

      renderWithContext({ debouncedSearch: 'math', isSearching: true });

      expect(
        screen.getByRole('heading', { name: 'Results for “math”', level: 2 }),
      ).toBeInTheDocument();
      expect(
        screen.getByText('2 agents match your search.'),
      ).toBeInTheDocument();
    });

    it('shows the total agent count next to the heading when browsing', () => {
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: { results: mockMentors, next: null, count: 89 },
        isLoading: false,
        isFetching: false,
      });

      renderWithContext();

      expect(screen.getByText('89 agents')).toBeInTheDocument();
    });
  });

  describe('API query parameters', () => {
    it('calls useGetAiSearchMentorsQuery with correct parameters', () => {
      renderWithContext();

      expect(mockUseGetAiSearchMentorsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          platform_key: 'test-tenant',
          limit: 12,
          include_main_public_mentors: false,
        }),
        expect.objectContaining({
          skip: false,
        }),
      );
    });

    it('passes search query when searching', () => {
      renderWithContext({ debouncedSearch: 'python' });

      expect(mockUseGetAiSearchMentorsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'python',
        }),
        expect.anything(),
      );
    });

    it('passes filter parameters when filters are active', () => {
      renderWithContext({
        filters: {
          categories: 'Technology',
          subjects: 'Computer Science',
          llm_providers: 'Anthropic',
          types: 'Tutor',
          is_featured: null,
        },
      });

      expect(mockUseGetAiSearchMentorsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'Technology',
          llm: 'Anthropic',
          types: 'Tutor',
          subjects: 'Computer Science',
        }),
        expect.anything(),
      );
    });

    it('passes featured when the Featured filter is on', () => {
      renderWithContext({
        filters: {
          categories: null,
          subjects: null,
          llm_providers: null,
          types: null,
          is_featured: 'true',
        },
      });

      expect(mockUseGetAiSearchMentorsQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({ featured: true }),
        expect.anything(),
      );
    });

    it('does not pass featured when the Featured filter is off', () => {
      renderWithContext();

      expect(
        mockUseGetAiSearchMentorsQuery.mock.calls.at(-1)?.[0]?.featured,
      ).toBeUndefined();
    });

    it('skips query when tenantKey is not available', () => {
      renderWithContext({ tenantKey: '' });

      expect(mockUseGetAiSearchMentorsQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          skip: true,
        }),
      );
    });
  });

  describe('Pagination', () => {
    it('shows See more button when there is a next page', () => {
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: { results: mockMentors, next: 'http://api/next-page' },
        isLoading: false,
        isFetching: false,
      });

      renderWithContext();

      expect(
        screen.getByRole('button', { name: /Load more agents/i }),
      ).toBeInTheDocument();
    });

    it('does not show See more button when there is no next page', () => {
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: { results: mockMentors, next: null },
        isLoading: false,
        isFetching: false,
      });

      renderWithContext();

      expect(
        screen.queryByRole('button', { name: /Load more agents/i }),
      ).not.toBeInTheDocument();
    });

    it('loads more mentors when See more is clicked', async () => {
      const user = userEvent.setup();
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: { results: mockMentors, next: 'http://api/next-page' },
        isLoading: false,
        isFetching: false,
      });

      renderWithContext();

      const seeMoreButton = screen.getByRole('button', {
        name: /Load more agents/i,
      });
      await user.click(seeMoreButton);

      await waitFor(() => {
        expect(mockUseGetAiSearchMentorsQuery).toHaveBeenLastCalledWith(
          expect.objectContaining({
            limit: 24, // 12 + 12
          }),
          expect.anything(),
        );
      });
    });

    it('shows loading state in See more button while fetching', () => {
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: { results: mockMentors, next: 'http://api/next-page' },
        isLoading: false,
        isFetching: true,
      });

      renderWithContext();

      expect(screen.getByText('Loading more')).toBeInTheDocument();
    });

    it('disables See more button while fetching', () => {
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: { results: mockMentors, next: 'http://api/next-page' },
        isLoading: false,
        isFetching: true,
      });

      renderWithContext();

      const seeMoreButton = screen.getByRole('button', {
        name: /Load more agents/i,
      });
      expect(seeMoreButton).toBeDisabled();
    });
  });

  describe('Pagination reset', () => {
    it('resets pagination when search changes', () => {
      const { rerender } = render(
        <TooltipProvider>
          <ExplorePageContext.Provider
            value={{ ...mockContextValue, debouncedSearch: '' }}
          >
            <DefaultMentorsSection />
          </ExplorePageContext.Provider>
        </TooltipProvider>,
      );

      rerender(
        <TooltipProvider>
          <ExplorePageContext.Provider
            value={{ ...mockContextValue, debouncedSearch: 'new search' }}
          >
            <DefaultMentorsSection />
          </ExplorePageContext.Provider>
        </TooltipProvider>,
      );

      expect(mockUseGetAiSearchMentorsQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({
          limit: 12,
        }),
        expect.anything(),
      );
    });
  });

  describe('Accessibility', () => {
    it('has proper heading structure', () => {
      renderWithContext();

      const heading = screen.getByRole('heading', {
        name: /All Agents/i,
        level: 2,
      });
      expect(heading.tagName).toBe('H2');
    });

    it('loading state has proper aria-live', () => {
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: null,
        isLoading: true,
        isFetching: true,
      });

      renderWithContext();

      const loadingContainer = screen.getByRole('status');
      expect(loadingContainer).toHaveAttribute('aria-live', 'polite');
    });

    it('list items have proper aria-label', () => {
      renderWithContext();

      const listItems = screen.getAllByRole('listitem');
      expect(listItems[0]).toHaveAttribute(
        'aria-label',
        expect.stringContaining('Mentor 1'),
      );
    });
  });
});
