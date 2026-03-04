import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { StarredMentorsSection } from '../starred-mentors-section';
import { ExplorePageContext, ExplorePageContextValue } from '../explore-page-context';
import { TooltipProvider } from '@/components/ui/tooltip';
import { mockStarredMentor, mockMentorsListWithPagination, mockEmptyMentorsList } from './fixtures';

// Mock the data-layer hooks
const mockUseGetAiSearchMentorsQuery = vi.fn();

vi.mock('@data-layer/index', () => ({
  useGetAiSearchMentorsQuery: (...args: unknown[]) => mockUseGetAiSearchMentorsQuery(...args),
}));

// Mock isLoggedIn from @/lib/utils
const mockIsLoggedIn = vi.fn(() => true);
const mockRedirectToAuthSpaJoinTenant = vi.fn();
vi.mock('@/lib/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils')>();
  return {
    ...actual,
    isLoggedIn: () => mockIsLoggedIn(),
    redirectToAuthSpaJoinTenant: (...args: unknown[]) => mockRedirectToAuthSpaJoinTenant(...args),
  };
});

/**
 * Test suite for StarredMentorsSection component
 *
 * Tests the starred/favorite mentors section display and functionality.
 */
describe('StarredMentorsSection', () => {
  const mockSetStarredMentorsLoading = vi.fn();
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
    setStarredMentorsLoading: mockSetStarredMentorsLoading,
    customMentorsLoading: false,
    setCustomMentorsLoading: vi.fn(),
    featuredMentorsLoading: false,
    setFeaturedMentorsLoading: vi.fn(),
    defaultMentorsLoading: false,
    setDefaultMentorsLoading: vi.fn(),
  };

  const mockStarredMentors = [
    {
      id: '1',
      name: 'Starred Mentor 1',
      unique_id: 'starred-1',
      description: 'A starred mentor',
      starred: true,
    },
    {
      id: '2',
      name: 'Starred Mentor 2',
      unique_id: 'starred-2',
      description: 'Another starred mentor',
      starred: true,
    },
  ];

  const renderWithContext = (contextOverrides: Partial<ExplorePageContextValue> = {}) => {
    return render(
      <TooltipProvider>
        <ExplorePageContext.Provider value={{ ...mockContextValue, ...contextOverrides }}>
          <StarredMentorsSection />
        </ExplorePageContext.Provider>
      </TooltipProvider>,
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoggedIn.mockReturnValue(true);
    mockRedirectToAuthSpaJoinTenant.mockClear();
    mockUseGetAiSearchMentorsQuery.mockReturnValue({
      data: { results: mockStarredMentors, next: null },
      isFetching: false,
    });
  });

  describe('Basic rendering', () => {
    it('renders the Favorites heading', () => {
      renderWithContext();

      expect(screen.getByRole('heading', { name: /Favorites/i })).toBeInTheDocument();
    });

    it('handles null data gracefully', () => {
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: null,
        isFetching: false,
      });

      renderWithContext();

      expect(screen.getByRole('heading', { name: /^Favorites$/i, level: 2 })).toBeInTheDocument();
    });

    it('handles undefined results gracefully', () => {
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: { next: null },
        isFetching: false,
      });

      renderWithContext();

      expect(screen.getByRole('heading', { name: /^Favorites$/i, level: 2 })).toBeInTheDocument();
    });

    it('renders mentor cards when starred mentors exist', () => {
      renderWithContext();

      expect(screen.getByText('Starred Mentor 1')).toBeInTheDocument();
      expect(screen.getByText('Starred Mentor 2')).toBeInTheDocument();
    });

    it('renders list of starred mentors when data is available', () => {
      const starredMentorsList = {
        results: [
          mockStarredMentor,
          { ...mockStarredMentor, id: 'starred-2', name: 'Starred Mentor 2' },
        ],
        next: null,
        count: 2,
        facets: {},
      };

      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: starredMentorsList,
        isFetching: false,
      });

      renderWithContext();

      expect(screen.getByText('Favorites')).toBeInTheDocument();
      expect(screen.getByText('Starred Mentor')).toBeInTheDocument();
      expect(screen.getByText('Starred Mentor 2')).toBeInTheDocument();
    });

    it('renders empty state when no starred mentors', () => {
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: { results: [], next: null },
        isFetching: false,
      });

      renderWithContext();

      expect(screen.getByText('Add to Favorites')).toBeInTheDocument();
      expect(
        screen.getByText('Star your favorite mentors to quickly access them here'),
      ).toBeInTheDocument();
      expect(screen.getByText('No favorites yet')).toBeInTheDocument();
    });

    it('shows empty state card when no starred mentors', () => {
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: mockEmptyMentorsList,
        isFetching: false,
      });

      renderWithContext();

      expect(screen.getByText('Add to Favorites')).toBeInTheDocument();
      expect(
        screen.getByText('Star your favorite mentors to quickly access them here'),
      ).toBeInTheDocument();
      expect(screen.getByText('No favorites yet')).toBeInTheDocument();
    });

    it('renders mentors in a list with proper role', () => {
      renderWithContext();

      expect(screen.getByRole('list', { name: /Favorite mentors/i })).toBeInTheDocument();
      expect(screen.getAllByRole('listitem')).toHaveLength(2);
    });
  });

  describe('API query parameters', () => {
    it('calls useGetAiSearchMentorsQuery with correct parameters', () => {
      renderWithContext();

      expect(mockUseGetAiSearchMentorsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          platform_key: 'test-tenant',
          starred: true,
          limit: 6,
          order_direction: 'desc',
          include_main_public_mentors: false,
        }),
        expect.objectContaining({
          skip: false,
        }),
      );
    });

    it('passes search query when searching', () => {
      renderWithContext({ debouncedSearch: 'math' });

      expect(mockUseGetAiSearchMentorsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'math',
        }),
        expect.anything(),
      );
    });

    it('passes filter parameters when filters are active', () => {
      renderWithContext({
        filters: {
          categories: 'Education',
          subjects: 'Math',
          llm_providers: 'OpenAI',
          types: 'Tutor',
          is_featured: null,
        },
      });

      expect(mockUseGetAiSearchMentorsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'Education',
          llm: 'OpenAI',
          types: 'Tutor',
          subjects: 'Math',
        }),
        expect.anything(),
      );
    });

    it('skips query when username is not available', () => {
      renderWithContext({ username: null });

      expect(mockUseGetAiSearchMentorsQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          skip: true,
        }),
      );
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

  describe('Loading state', () => {
    it('calls setStarredMentorsLoading when fetching state changes', () => {
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: { results: [], next: null },
        isFetching: true,
      });

      renderWithContext();

      expect(mockSetStarredMentorsLoading).toHaveBeenCalledWith(true);
    });

    it('calls setStarredMentorsLoading with false when not fetching', () => {
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: { results: mockStarredMentors, next: null },
        isFetching: false,
      });

      renderWithContext();

      expect(mockSetStarredMentorsLoading).toHaveBeenCalledWith(false);
    });

    it('shows loading state while fetching mentors', () => {
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: mockMentorsListWithPagination,
        isFetching: true,
      });

      renderWithContext();

      const loadingButton = screen.getByText('Loading more');
      expect(loadingButton).toBeInTheDocument();
      expect(screen.getByTestId('spinner')).toBeInTheDocument();
    });

    it('disables "See more" button while fetching', () => {
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: mockMentorsListWithPagination,
        isFetching: true,
      });

      renderWithContext();

      const button = screen.getByRole('button', { name: /load more favorite mentors/i });
      expect(button).toBeDisabled();
    });
  });

  describe('Pagination', () => {
    it('shows See more button when there is a next page', () => {
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: { results: mockStarredMentors, next: 'http://api/next-page' },
        isFetching: false,
      });

      renderWithContext();

      expect(
        screen.getByRole('button', { name: /Load more favorite mentors/i }),
      ).toBeInTheDocument();
    });

    it('shows "See more" button with pagination', () => {
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: mockMentorsListWithPagination,
        isFetching: false,
      });

      renderWithContext();

      expect(screen.getByText('See more')).toBeInTheDocument();
    });

    it('does not show See more button when there is no next page', () => {
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: { results: mockStarredMentors, next: null },
        isFetching: false,
      });

      renderWithContext();

      expect(
        screen.queryByRole('button', { name: /Load more favorite mentors/i }),
      ).not.toBeInTheDocument();
    });

    it('does not show "See more" button when there are no more starred mentors', () => {
      const starredMentorsList = {
        results: [mockStarredMentor],
        next: null,
        count: 1,
        facets: {},
      };

      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: starredMentorsList,
        isFetching: false,
      });

      renderWithContext();

      expect(screen.queryByText('See more')).not.toBeInTheDocument();
    });

    it('loads more mentors when See more is clicked', async () => {
      const user = userEvent.setup();
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: { results: mockStarredMentors, next: 'http://api/next-page' },
        isFetching: false,
      });

      renderWithContext();

      const seeMoreButton = screen.getByRole('button', { name: /Load more favorite mentors/i });
      await user.click(seeMoreButton);

      // The limit should increase by 6 (FAVORITE_MENTORS_LIMIT)
      await waitFor(() => {
        expect(mockUseGetAiSearchMentorsQuery).toHaveBeenLastCalledWith(
          expect.objectContaining({
            limit: 12,
          }),
          expect.anything(),
        );
      });
    });

    it('loads more starred mentors when "See more" is clicked', () => {
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: mockMentorsListWithPagination,
        isFetching: false,
      });

      renderWithContext();

      const seeMoreButton = screen.getByText('See more');
      fireEvent.click(seeMoreButton);

      // Should re-render and make a new query with increased limit
      expect(mockUseGetAiSearchMentorsQuery).toHaveBeenCalled();
    });

    it('shows loading state in See more button while fetching', () => {
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: { results: mockStarredMentors, next: 'http://api/next-page' },
        isFetching: true,
      });

      renderWithContext();

      expect(screen.getByText('Loading more')).toBeInTheDocument();
    });

    it('disables See more button while fetching', () => {
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: { results: mockStarredMentors, next: 'http://api/next-page' },
        isFetching: true,
      });

      renderWithContext();

      const seeMoreButton = screen.getByRole('button', { name: /Load more favorite mentors/i });
      expect(seeMoreButton).toBeDisabled();
    });
  });

  describe('Pagination reset', () => {
    it('resets pagination when search changes', () => {
      const { rerender } = render(
        <TooltipProvider>
          <ExplorePageContext.Provider value={{ ...mockContextValue, debouncedSearch: '' }}>
            <StarredMentorsSection />
          </ExplorePageContext.Provider>
        </TooltipProvider>,
      );

      // Simulate search change
      rerender(
        <TooltipProvider>
          <ExplorePageContext.Provider value={{ ...mockContextValue, debouncedSearch: 'test' }}>
            <StarredMentorsSection />
          </ExplorePageContext.Provider>
        </TooltipProvider>,
      );

      // The limit should be reset to the initial value (6)
      expect(mockUseGetAiSearchMentorsQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({
          limit: 6,
        }),
        expect.anything(),
      );
    });
  });

  describe('Authentication Redirects', () => {
    it('redirects to signup when not logged in and empty favorites card is clicked', () => {
      mockIsLoggedIn.mockReturnValue(false);
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: mockEmptyMentorsList,
        isFetching: false,
      });

      renderWithContext();

      const favoritesCard = screen.getByTestId('favorites-card');
      fireEvent.click(favoritesCard);

      expect(mockRedirectToAuthSpaJoinTenant).toHaveBeenCalledWith('test-tenant');
    });

    it('does not redirect when logged in and empty favorites card is clicked', () => {
      mockIsLoggedIn.mockReturnValue(true);
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: mockEmptyMentorsList,
        isFetching: false,
      });

      renderWithContext();

      const favoritesCard = screen.getByTestId('favorites-card');
      fireEvent.click(favoritesCard);

      // When logged in, clicking the card does nothing (no redirect)
      expect(mockRedirectToAuthSpaJoinTenant).not.toHaveBeenCalled();
    });

    it('handles keyboard navigation for empty favorites card when not logged in', () => {
      mockIsLoggedIn.mockReturnValue(false);
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: mockEmptyMentorsList,
        isFetching: false,
      });

      renderWithContext();

      const favoritesCard = screen.getByTestId('favorites-card');

      // Test Enter key
      fireEvent.keyDown(favoritesCard, { key: 'Enter' });
      expect(mockRedirectToAuthSpaJoinTenant).toHaveBeenCalledWith('test-tenant');

      mockRedirectToAuthSpaJoinTenant.mockClear();

      // Test Space key
      fireEvent.keyDown(favoritesCard, { key: ' ' });
      expect(mockRedirectToAuthSpaJoinTenant).toHaveBeenCalledWith('test-tenant');
    });
  });

  describe('Accessibility', () => {
    it('has proper heading structure', () => {
      renderWithContext();

      const heading = screen.getByRole('heading', { name: /Favorites/i });
      expect(heading).toHaveAttribute('aria-level', '2');
    });

    it('has proper list role and label', () => {
      renderWithContext();

      expect(screen.getByRole('list', { name: /Favorite mentors/i })).toBeInTheDocument();
    });

    it('list items have proper role', () => {
      renderWithContext();

      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(2);
    });

    it('has correct ARIA attributes on empty state card', () => {
      mockIsLoggedIn.mockReturnValue(false);
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: mockEmptyMentorsList,
        isFetching: false,
      });

      renderWithContext();

      const favoritesCard = screen.getByTestId('favorites-card');
      expect(favoritesCard).toHaveAttribute('role', 'button');
      expect(favoritesCard).toHaveAttribute('tabIndex', '0');
      expect(favoritesCard).toHaveAttribute(
        'aria-label',
        'Add to Favorites - Sign up to star mentors',
      );
    });
  });

  describe('Empty state interactions', () => {
    beforeEach(() => {
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: { results: [], next: null },
        isFetching: false,
      });
    });

    it('redirects to auth when not logged in and empty state card is clicked', async () => {
      const user = userEvent.setup();
      mockIsLoggedIn.mockReturnValue(false);

      renderWithContext();

      const emptyCard = screen.getByRole('button', { name: /Add to Favorites/i });
      await user.click(emptyCard);

      expect(mockRedirectToAuthSpaJoinTenant).toHaveBeenCalledWith('test-tenant');
    });

    it('does not redirect when logged in and empty state card is clicked', async () => {
      const user = userEvent.setup();
      mockIsLoggedIn.mockReturnValue(true);

      renderWithContext();

      const emptyCard = screen.getByRole('button', { name: /Add to Favorites/i });
      await user.click(emptyCard);

      expect(mockRedirectToAuthSpaJoinTenant).not.toHaveBeenCalled();
    });

    it('can trigger action with Enter key on empty state card', async () => {
      const user = userEvent.setup();
      mockIsLoggedIn.mockReturnValue(false);

      renderWithContext();

      const emptyCard = screen.getByRole('button', { name: /Add to Favorites/i });
      emptyCard.focus();
      await user.keyboard('{Enter}');

      expect(mockRedirectToAuthSpaJoinTenant).toHaveBeenCalledWith('test-tenant');
    });

    it('can trigger action with Space key on empty state card', async () => {
      const user = userEvent.setup();
      mockIsLoggedIn.mockReturnValue(false);

      renderWithContext();

      const emptyCard = screen.getByRole('button', { name: /Add to Favorites/i });
      emptyCard.focus();
      await user.keyboard(' ');

      expect(mockRedirectToAuthSpaJoinTenant).toHaveBeenCalledWith('test-tenant');
    });

    it('empty state card is keyboard accessible', () => {
      renderWithContext();

      const emptyCard = screen.getByRole('button', { name: /Add to Favorites/i });
      expect(emptyCard).toHaveAttribute('tabindex', '0');
    });

    it('does not trigger action with other keys on empty state card', async () => {
      const user = userEvent.setup();
      mockIsLoggedIn.mockReturnValue(false);

      renderWithContext();

      const emptyCard = screen.getByRole('button', { name: /Add to Favorites/i });
      emptyCard.focus();
      await user.keyboard('{Tab}');

      expect(mockRedirectToAuthSpaJoinTenant).not.toHaveBeenCalled();
    });
  });
});
