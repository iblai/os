import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { FeaturedMentorsSection } from '../featured-mentors-section';
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

/**
 * Test suite for FeaturedMentorsSection component
 *
 * Tests the featured mentors section display and functionality.
 */
describe('FeaturedMentorsSection', () => {
  const mockSetFeaturedMentorsLoading = vi.fn();
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
    setFeaturedMentorsLoading: mockSetFeaturedMentorsLoading,
    defaultMentorsLoading: false,
    setDefaultMentorsLoading: vi.fn(),
  };

  const mockFeaturedMentors = [
    {
      id: '1',
      name: 'Featured Mentor 1',
      unique_id: 'featured-1',
      description: 'A featured mentor',
    },
    {
      id: '2',
      name: 'Featured Mentor 2',
      unique_id: 'featured-2',
      description: 'Another featured mentor',
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
          <FeaturedMentorsSection />
        </ExplorePageContext.Provider>
      </TooltipProvider>,
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGetAiSearchMentorsQuery.mockReturnValue({
      data: { results: mockFeaturedMentors, next: null },
      isFetching: false,
    });
  });

  describe('Basic rendering', () => {
    it('renders the Featured heading', () => {
      renderWithContext();

      expect(
        screen.getByRole('heading', { name: /^Featured$/i, level: 2 }),
      ).toBeInTheDocument();
    });

    it('renders mentor cards when featured mentors exist', () => {
      renderWithContext();

      expect(screen.getByText('Featured Mentor 1')).toBeInTheDocument();
      expect(screen.getByText('Featured Mentor 2')).toBeInTheDocument();
    });

    it('returns null when no featured mentors and not fetching', () => {
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: { results: [], next: null },
        isFetching: false,
      });

      const { container } = renderWithContext();

      // Component should return null
      expect(container.firstChild).toBeNull();
    });

    it('renders when fetching with no data', () => {
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: { results: [], next: null },
        isFetching: true,
      });

      // The component renders when fetching (even with empty results) because
      // it only returns null when not fetching AND results are empty
      renderWithContext();
      expect(
        screen.getByRole('heading', { name: /^Featured$/i, level: 2 }),
      ).toBeInTheDocument();
    });
  });

  describe('API query parameters', () => {
    it('calls useGetAiSearchMentorsQuery with featured=true', () => {
      renderWithContext();

      expect(mockUseGetAiSearchMentorsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          platform_key: 'test-tenant',
          featured: true,
          limit: 6,
          include_main_public_mentors: false,
        }),
        expect.objectContaining({
          skip: false,
        }),
      );
    });

    it('passes search query when searching', () => {
      renderWithContext({ debouncedSearch: 'science' });

      expect(mockUseGetAiSearchMentorsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'science',
        }),
        expect.anything(),
      );
    });

    it('passes filter parameters when filters are active', () => {
      renderWithContext({
        filters: {
          categories: 'Science',
          subjects: 'Physics',
          llm_providers: 'Anthropic',
          types: 'Coach',
          is_featured: null,
        },
      });

      expect(mockUseGetAiSearchMentorsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'Science',
          llm: 'Anthropic',
          types: 'Coach',
          subjects: 'Physics',
        }),
        expect.anything(),
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
    it('calls setFeaturedMentorsLoading when fetching state changes', () => {
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: { results: mockFeaturedMentors, next: null },
        isFetching: true,
      });

      renderWithContext();

      expect(mockSetFeaturedMentorsLoading).toHaveBeenCalledWith(true);
    });

    it('calls setFeaturedMentorsLoading with false when not fetching', () => {
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: { results: mockFeaturedMentors, next: null },
        isFetching: false,
      });

      renderWithContext();

      expect(mockSetFeaturedMentorsLoading).toHaveBeenCalledWith(false);
    });
  });

  describe('Pagination', () => {
    it('shows See more button when there is a next page', () => {
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: { results: mockFeaturedMentors, next: 'http://api/next-page' },
        isFetching: false,
      });

      renderWithContext();

      expect(
        screen.getByRole('button', { name: /Load more featured mentors/i }),
      ).toBeInTheDocument();
    });

    it('does not show See more button when there is no next page', () => {
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: { results: mockFeaturedMentors, next: null },
        isFetching: false,
      });

      renderWithContext();

      expect(
        screen.queryByRole('button', { name: /Load more featured mentors/i }),
      ).not.toBeInTheDocument();
    });

    it('loads more mentors when See more is clicked', async () => {
      const user = userEvent.setup();
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: { results: mockFeaturedMentors, next: 'http://api/next-page' },
        isFetching: false,
      });

      renderWithContext();

      const seeMoreButton = screen.getByRole('button', {
        name: /Load more featured mentors/i,
      });
      await user.click(seeMoreButton);

      await waitFor(() => {
        expect(mockUseGetAiSearchMentorsQuery).toHaveBeenLastCalledWith(
          expect.objectContaining({
            limit: 12, // 6 + 6
          }),
          expect.anything(),
        );
      });
    });

    it('shows loading state in See more button while fetching', () => {
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: { results: mockFeaturedMentors, next: 'http://api/next-page' },
        isFetching: true,
      });

      renderWithContext();

      expect(screen.getByText('Loading more')).toBeInTheDocument();
    });

    it('disables See more button while fetching', () => {
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: { results: mockFeaturedMentors, next: 'http://api/next-page' },
        isFetching: true,
      });

      renderWithContext();

      const seeMoreButton = screen.getByRole('button', {
        name: /Load more featured mentors/i,
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
            <FeaturedMentorsSection />
          </ExplorePageContext.Provider>
        </TooltipProvider>,
      );

      rerender(
        <TooltipProvider>
          <ExplorePageContext.Provider
            value={{ ...mockContextValue, debouncedSearch: 'new search' }}
          >
            <FeaturedMentorsSection />
          </ExplorePageContext.Provider>
        </TooltipProvider>,
      );

      expect(mockUseGetAiSearchMentorsQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({
          limit: 6,
        }),
        expect.anything(),
      );
    });
  });

  describe('Accessibility', () => {
    it('has proper heading structure', () => {
      renderWithContext();

      const heading = screen.getByRole('heading', {
        name: /^Featured$/i,
        level: 2,
      });
      expect(heading).toHaveAttribute('aria-level', '2');
    });
  });
});
