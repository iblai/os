import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { CustomMentorsSection } from '../custom-mentors-section';
import { ExplorePageContext, ExplorePageContextValue } from '../explore-page-context';
import { TooltipProvider } from '@/components/ui/tooltip';

// Mock the data-layer hooks
const mockUseGetPersonnalizedMentorsQuery = vi.fn();

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetPersonnalizedMentorsQuery: (...args: unknown[]) =>
    mockUseGetPersonnalizedMentorsQuery(...args),
}));

// Mock useNavigate hook
const mockOpenCreateMentorModal = vi.fn();
vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({
    openCreateMentorModal: mockOpenCreateMentorModal,
  }),
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

// Mock WithPermissions HOC
let mockHasPermission = true;
vi.mock('@/hoc/withPermissions', () => ({
  WithPermissions: ({ children }: { children: (hasPermission: boolean) => React.ReactNode }) =>
    children(mockHasPermission),
}));

// Mock UI components
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, onClick, className, ...props }: any) => (
    <div data-testid="card" className={className} onClick={onClick} {...props}>
      {children}
    </div>
  ),
  CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

vi.mock('@/components/spinner', () => ({
  Spinner: ({ className }: any) => (
    <div data-testid="spinner" className={className}>
      Loading...
    </div>
  ),
}));

// Mock child component
vi.mock('../mentor-card-with-star', () => ({
  MentorCardWithStar: ({ mentor }: any) => <div data-testid="mentor-card">{mentor.name}</div>,
}));

/**
 * Test suite for CustomMentorsSection component
 *
 * Tests the custom/personalized mentors section display and functionality.
 */
describe('CustomMentorsSection', () => {
  const mockSetCustomMentorsLoading = vi.fn();
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
    setCustomMentorsLoading: mockSetCustomMentorsLoading,
    featuredMentorsLoading: false,
    setFeaturedMentorsLoading: vi.fn(),
    defaultMentorsLoading: false,
    setDefaultMentorsLoading: vi.fn(),
  };

  const mockCustomMentors = [
    {
      id: '1',
      name: 'Custom Mentor 1',
      unique_id: 'custom-1',
      description: 'A custom mentor',
    },
    {
      id: '2',
      name: 'Custom Mentor 2',
      unique_id: 'custom-2',
      description: 'Another custom mentor',
    },
  ];

  const renderWithContext = (contextOverrides: Partial<ExplorePageContextValue> = {}) => {
    return render(
      <TooltipProvider>
        <ExplorePageContext.Provider value={{ ...mockContextValue, ...contextOverrides }}>
          <CustomMentorsSection />
        </ExplorePageContext.Provider>
      </TooltipProvider>,
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoggedIn.mockReturnValue(true);
    mockRedirectToAuthSpaJoinTenant.mockClear();
    mockHasPermission = true;
    mockUseGetPersonnalizedMentorsQuery.mockReturnValue({
      data: { results: mockCustomMentors, next: null },
      isFetching: false,
    });
    mockIsLoggedIn.mockReturnValue(true);
  });

  describe('Basic rendering', () => {
    it('renders the Custom heading', () => {
      renderWithContext();

      expect(screen.getByRole('heading', { name: /^Custom$/i, level: 2 })).toBeInTheDocument();
    });

    it('handles null data gracefully', () => {
      mockUseGetPersonnalizedMentorsQuery.mockReturnValue({
        data: null,
        isFetching: false,
      });

      renderWithContext();

      expect(screen.getByRole('heading', { name: /^Custom$/i, level: 2 })).toBeInTheDocument();
    });

    it('handles undefined results gracefully', () => {
      mockUseGetPersonnalizedMentorsQuery.mockReturnValue({
        data: { next: null },
        isFetching: false,
      });

      renderWithContext();

      expect(screen.getByRole('heading', { name: /^Custom$/i, level: 2 })).toBeInTheDocument();
    });

    it('renders mentor cards when custom mentors exist', () => {
      renderWithContext();

      expect(screen.getByText('Custom Mentor 1')).toBeInTheDocument();
      expect(screen.getByText('Custom Mentor 2')).toBeInTheDocument();
    });

    it('renders create mentor card when no custom mentors and user has permission', () => {
      mockUseGetPersonnalizedMentorsQuery.mockReturnValue({
        data: { results: [], next: null },
        isFetching: false,
      });

      renderWithContext();

      expect(screen.getByText('Create Custom Mentor')).toBeInTheDocument();
      expect(
        screen.getByText('Build your own custom mentor tailored to your specific learning needs'),
      ).toBeInTheDocument();
      expect(screen.getByText('Get started today')).toBeInTheDocument();
    });

    it('does not render create mentor card when user does not have permission', () => {
      mockHasPermission = false;
      mockUseGetPersonnalizedMentorsQuery.mockReturnValue({
        data: { results: [], next: null },
        isFetching: false,
      });

      renderWithContext();

      expect(screen.queryByText('Create Custom Mentor')).not.toBeInTheDocument();
    });

    it('does not render create mentor card below mentors when user does not have permission', () => {
      mockHasPermission = false;

      renderWithContext();

      expect(screen.getByText('Custom Mentor 1')).toBeInTheDocument();
      expect(screen.queryByText('Create Custom Mentor')).not.toBeInTheDocument();
    });

    it('renders mentors list with proper roles', () => {
      renderWithContext();

      expect(screen.getByRole('list', { name: /Custom mentors/i })).toBeInTheDocument();
      expect(screen.getAllByRole('listitem')).toHaveLength(2);
    });

    it('shows create mentor card below mentors when there are mentors', () => {
      renderWithContext();

      expect(screen.getByText('Custom Mentor 1')).toBeInTheDocument();
      expect(screen.getByText('Create Custom Mentor')).toBeInTheDocument();
    });
  });

  describe('API query parameters', () => {
    it('calls useGetPersonnalizedMentorsQuery with correct parameters', () => {
      renderWithContext();

      expect(mockUseGetPersonnalizedMentorsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          platform_key: 'test-tenant',
          username: 'test-user',
          limit: 6,
          include_main_public_mentors: false,
        }),
        expect.objectContaining({
          skip: false,
        }),
      );
    });

    it('passes search query when searching', () => {
      renderWithContext({ debouncedSearch: 'coding' });

      expect(mockUseGetPersonnalizedMentorsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'coding',
        }),
        expect.anything(),
      );
    });

    it('passes filter parameters when filters are active', () => {
      renderWithContext({
        filters: {
          categories: 'Technology',
          subjects: 'Programming',
          llm_providers: 'OpenAI',
          types: 'Assistant',
          is_featured: null,
        },
      });

      expect(mockUseGetPersonnalizedMentorsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'Technology',
          llm: 'OpenAI',
          types: 'Assistant',
          subjects: 'Programming',
        }),
        expect.anything(),
      );
    });

    it('skips query when username is not available', () => {
      renderWithContext({ username: null });

      expect(mockUseGetPersonnalizedMentorsQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          skip: true,
        }),
      );
    });

    it('skips query when tenantKey is not available', () => {
      renderWithContext({ tenantKey: '' });

      expect(mockUseGetPersonnalizedMentorsQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          skip: true,
        }),
      );
    });
  });

  describe('Loading state', () => {
    it('calls setCustomMentorsLoading when fetching state changes', () => {
      mockUseGetPersonnalizedMentorsQuery.mockReturnValue({
        data: { results: [], next: null },
        isFetching: true,
      });

      renderWithContext();

      expect(mockSetCustomMentorsLoading).toHaveBeenCalledWith(true);
    });

    it('calls setCustomMentorsLoading with false when not fetching', () => {
      mockUseGetPersonnalizedMentorsQuery.mockReturnValue({
        data: { results: mockCustomMentors, next: null },
        isFetching: false,
      });

      renderWithContext();

      expect(mockSetCustomMentorsLoading).toHaveBeenCalledWith(false);
    });

    it('shows loading state in See more button while fetching', () => {
      mockUseGetPersonnalizedMentorsQuery.mockReturnValue({
        data: { results: mockCustomMentors, next: 'http://api/next-page' },
        isFetching: true,
      });

      renderWithContext();

      expect(screen.getByText('Loading more')).toBeInTheDocument();
    });

    it('disables See more button while fetching', () => {
      mockUseGetPersonnalizedMentorsQuery.mockReturnValue({
        data: { results: mockCustomMentors, next: 'http://api/next-page' },
        isFetching: true,
      });

      renderWithContext();

      const seeMoreButton = screen.getByRole('button', { name: /Load more custom mentors/i });
      expect(seeMoreButton).toBeDisabled();
    });
  });

  describe('Create Mentor functionality', () => {
    it('calls openCreateMentorModal when create mentor card is clicked', async () => {
      const user = userEvent.setup();
      mockUseGetPersonnalizedMentorsQuery.mockReturnValue({
        data: { results: [], next: null },
        isFetching: false,
      });

      renderWithContext();

      const createCard = screen.getByRole('button', { name: /Create Custom Mentor/i });
      await user.click(createCard);

      expect(mockOpenCreateMentorModal).toHaveBeenCalled();
    });

    it('can trigger create modal with Enter key', async () => {
      const user = userEvent.setup();
      mockUseGetPersonnalizedMentorsQuery.mockReturnValue({
        data: { results: [], next: null },
        isFetching: false,
      });

      renderWithContext();

      const createCard = screen.getByRole('button', { name: /Create Custom Mentor/i });
      createCard.focus();
      await user.keyboard('{Enter}');

      expect(mockOpenCreateMentorModal).toHaveBeenCalled();
    });

    it('can trigger create modal with Space key', async () => {
      const user = userEvent.setup();
      mockUseGetPersonnalizedMentorsQuery.mockReturnValue({
        data: { results: [], next: null },
        isFetching: false,
      });

      renderWithContext();

      const createCard = screen.getByRole('button', { name: /Create Custom Mentor/i });
      createCard.focus();
      await user.keyboard(' ');

      expect(mockOpenCreateMentorModal).toHaveBeenCalled();
    });

    it('redirects to auth when not logged in and create card is clicked', async () => {
      const user = userEvent.setup();
      mockIsLoggedIn.mockReturnValue(false);
      mockUseGetPersonnalizedMentorsQuery.mockReturnValue({
        data: { results: [], next: null },
        isFetching: false,
      });

      renderWithContext();

      const createCard = screen.getByRole('button', { name: /Create Custom Mentor/i });
      await user.click(createCard);

      expect(mockRedirectToAuthSpaJoinTenant).toHaveBeenCalledWith('test-tenant');
      expect(mockOpenCreateMentorModal).not.toHaveBeenCalled();
    });

    it('redirects to auth when not logged in and Enter key is pressed on create card', async () => {
      const user = userEvent.setup();
      mockIsLoggedIn.mockReturnValue(false);
      mockUseGetPersonnalizedMentorsQuery.mockReturnValue({
        data: { results: [], next: null },
        isFetching: false,
      });

      renderWithContext();

      const createCard = screen.getByRole('button', { name: /Create Custom Mentor/i });
      createCard.focus();
      await user.keyboard('{Enter}');

      expect(mockRedirectToAuthSpaJoinTenant).toHaveBeenCalledWith('test-tenant');
      expect(mockOpenCreateMentorModal).not.toHaveBeenCalled();
    });

    it('can trigger create modal with keyboard when mentors exist', async () => {
      const user = userEvent.setup();
      renderWithContext();

      // When mentors exist, the create card is shown below the mentor list
      const createCards = screen.getAllByRole('button', { name: /Create Custom Mentor/i });
      const createCard = createCards[0];
      createCard.focus();
      await user.keyboard('{Enter}');

      expect(mockOpenCreateMentorModal).toHaveBeenCalled();
    });

    it('can trigger create modal with Space key when mentors exist', async () => {
      const user = userEvent.setup();
      renderWithContext();

      const createCards = screen.getAllByRole('button', { name: /Create Custom Mentor/i });
      const createCard = createCards[0];
      createCard.focus();
      await user.keyboard(' ');

      expect(mockOpenCreateMentorModal).toHaveBeenCalled();
    });
  });

  describe('Authentication Redirects', () => {
    it('redirects to signup when not logged in and create button is clicked', () => {
      mockIsLoggedIn.mockReturnValue(false);
      mockUseGetPersonnalizedMentorsQuery.mockReturnValue({
        data: { results: [], next: null },
        isFetching: false,
      });

      renderWithContext();

      const createButton = screen.getByRole('button', { name: /Create Custom Mentor/i });
      fireEvent.click(createButton);

      expect(mockRedirectToAuthSpaJoinTenant).toHaveBeenCalledWith('test-tenant');
      expect(mockOpenCreateMentorModal).not.toHaveBeenCalled();
    });

    it('opens create mentor modal when logged in and create button is clicked', () => {
      mockIsLoggedIn.mockReturnValue(true);
      mockUseGetPersonnalizedMentorsQuery.mockReturnValue({
        data: { results: [], next: null },
        isFetching: false,
      });

      renderWithContext();

      const createButton = screen.getByRole('button', { name: /Create Custom Mentor/i });
      fireEvent.click(createButton);

      expect(mockOpenCreateMentorModal).toHaveBeenCalled();
      expect(mockRedirectToAuthSpaJoinTenant).not.toHaveBeenCalled();
    });

    it('redirects when clicking create button below mentor list while not logged in', () => {
      mockIsLoggedIn.mockReturnValue(false);
      mockUseGetPersonnalizedMentorsQuery.mockReturnValue({
        data: { results: mockCustomMentors, next: null },
        isFetching: false,
      });

      renderWithContext();

      const createButtons = screen.getAllByRole('button', { name: /Create Custom Mentor/i });
      fireEvent.click(createButtons[0]);

      expect(mockRedirectToAuthSpaJoinTenant).toHaveBeenCalledWith('test-tenant');
      expect(mockOpenCreateMentorModal).not.toHaveBeenCalled();
    });
  });

  describe('Pagination', () => {
    it('shows See more button when there is a next page', () => {
      mockUseGetPersonnalizedMentorsQuery.mockReturnValue({
        data: { results: mockCustomMentors, next: 'http://api/next-page' },
        isFetching: false,
      });

      renderWithContext();

      expect(screen.getByRole('button', { name: /Load more custom mentors/i })).toBeInTheDocument();
    });

    it('does not show See more button when there is no next page', () => {
      mockUseGetPersonnalizedMentorsQuery.mockReturnValue({
        data: { results: mockCustomMentors, next: null },
        isFetching: false,
      });

      renderWithContext();

      expect(
        screen.queryByRole('button', { name: /Load more custom mentors/i }),
      ).not.toBeInTheDocument();
    });

    it('loads more mentors when See more is clicked', async () => {
      const user = userEvent.setup();
      mockUseGetPersonnalizedMentorsQuery.mockReturnValue({
        data: { results: mockCustomMentors, next: 'http://api/next-page' },
        isFetching: false,
      });

      renderWithContext();

      const seeMoreButton = screen.getByRole('button', { name: /Load more custom mentors/i });
      await user.click(seeMoreButton);

      await waitFor(() => {
        expect(mockUseGetPersonnalizedMentorsQuery).toHaveBeenLastCalledWith(
          expect.objectContaining({
            limit: 12,
          }),
          expect.anything(),
        );
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper heading structure', () => {
      renderWithContext();

      const heading = screen.getByRole('heading', { name: /^Custom$/i, level: 2 });
      expect(heading).toHaveAttribute('aria-level', '2');
    });

    it('create mentor card has proper role and aria-label', () => {
      mockUseGetPersonnalizedMentorsQuery.mockReturnValue({
        data: { results: [], next: null },
        isFetching: false,
      });

      renderWithContext();

      expect(screen.getByRole('button', { name: /Create Custom Mentor/i })).toBeInTheDocument();
    });

    it('create mentor card is keyboard accessible', () => {
      mockUseGetPersonnalizedMentorsQuery.mockReturnValue({
        data: { results: [], next: null },
        isFetching: false,
      });

      renderWithContext();

      const createCard = screen.getByRole('button', { name: /Create Custom Mentor/i });
      expect(createCard).toHaveAttribute('tabindex', '0');
    });
  });
});
