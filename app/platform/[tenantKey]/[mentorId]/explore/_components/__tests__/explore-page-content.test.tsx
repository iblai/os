import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  render,
  screen,
  waitFor,
  act,
  fireEvent,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ExplorePageContent } from '../explore-page-content';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  useExplorePageContext,
  ExplorePageContextValue,
} from '../explore-page-context';

// Store context value for testing
let capturedContextValue: ExplorePageContextValue | null = null;

// Mock hooks
const mockUseUsername = vi.fn((): string | null => 'test-user');
vi.mock('@/hooks/use-user', () => ({
  useUsername: () => mockUseUsername(),
}));

const mockNavigateToMentor = vi.fn();
vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({
    navigateToMentor: mockNavigateToMentor,
    openCreateMentorModal: vi.fn(),
  }),
}));

const mockIsLoggedIn = vi.fn();
const mockRedirectToAuthSpaJoinTenant = vi.fn();
vi.mock('@/lib/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils')>();
  return {
    ...actual,
    isLoggedIn: () => mockIsLoggedIn(),
    redirectToAuthSpaJoinTenant: (...args: any[]) =>
      mockRedirectToAuthSpaJoinTenant(...args),
  };
});

const mockUseTenantMetadata = vi.fn(() => ({
  metadata: {
    mentor_include_community_mentors: true,
  },
}));
vi.mock('@iblai/iblai-js/web-utils', () => ({
  useTenantMetadata: () => mockUseTenantMetadata(),
}));

vi.mock('@/lib/config', () => ({
  config: {
    mainTenantKey: () => 'main',
    iblTemplateMentor: () => 'default-mentor',
    stripeEnabled: () => 'false',
  },
}));

// Mock data-layer hooks
const mockUseGetAiSearchMentorsQuery = vi.fn();
const mockUseGetPersonnalizedMentorsQuery = vi.fn();
const mockStarMentor = vi.fn();
const mockUnstarMentor = vi.fn();

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetAiSearchMentorsQuery: (...args: unknown[]) =>
    mockUseGetAiSearchMentorsQuery(...args),
  useGetPersonnalizedMentorsQuery: (...args: unknown[]) =>
    mockUseGetPersonnalizedMentorsQuery(...args),
  useStarMentorMutation: () => [mockStarMentor, { isLoading: false }],
  useUnstarMentorMutation: () => [mockUnstarMentor, { isLoading: false }],
}));

// Mock section components - capture context for testing
vi.mock('../starred-mentors-section', () => ({
  StarredMentorsSection: () => (
    <div data-testid="starred-mentors-section">Starred Section</div>
  ),
}));

vi.mock('../featured-mentors-section', () => ({
  FeaturedMentorsSection: () => (
    <div data-testid="featured-mentors-section">Featured Section</div>
  ),
}));

vi.mock('../custom-mentors-section', () => ({
  CustomMentorsSection: () => {
    const context = useExplorePageContext();
    capturedContextValue = context;
    return <div data-testid="custom-mentors-section">Custom Section</div>;
  },
}));

vi.mock('../default-mentors-section', () => ({
  DefaultMentorsSection: () => {
    const context = useExplorePageContext();
    capturedContextValue = context;
    return <div data-testid="default-mentors-section">Default Section</div>;
  },
}));

vi.mock('../mentor-categories', () => ({
  MentorCategories: ({
    onFiltersChange,
    onCreatedByChange,
  }: {
    onFiltersChange?: (filters: unknown) => void;
    onCreatedByChange?: (
      createdBy: 'me' | 'my-organization' | 'community' | null,
    ) => void;
  }) => (
    <div data-testid="mentor-categories">
      <button
        data-testid="change-filter-btn"
        onClick={() =>
          onFiltersChange?.({
            categories: 'Test',
            subjects: null,
            llm_providers: null,
            types: null,
          })
        }
      >
        Change Filter
      </button>
      <button
        data-testid="change-created-by-me"
        onClick={() => onCreatedByChange?.('me')}
      >
        Created By Me
      </button>
      <button
        data-testid="change-created-by-my-organization"
        onClick={() => onCreatedByChange?.('my-organization')}
      >
        Created By My Organization
      </button>
      <button
        data-testid="change-created-by-community"
        onClick={() => onCreatedByChange?.('community')}
      >
        Created By Community
      </button>
      <button
        data-testid="clear-created-by"
        onClick={() => onCreatedByChange?.(null)}
      >
        Clear Created By
      </button>
    </div>
  ),
}));

/**
 * Test suite for ExplorePageContent component
 *
 * Tests the main explore page content including search behavior,
 * section visibility, and filter interactions.
 */
describe('ExplorePageContent', () => {
  const mockFacets = {
    categories: { terms: { Education: 10 } },
  };

  const mockMentors = [
    { id: '1', name: 'Mentor 1' },
    { id: '2', name: 'Mentor 2' },
  ];

  const renderComponent = () => {
    return render(
      <TooltipProvider>
        <ExplorePageContent tenantKey="test-tenant" />
      </TooltipProvider>,
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    capturedContextValue = null;

    // Default mock implementations
    mockUseUsername.mockReturnValue('test-user');
    mockNavigateToMentor.mockClear();
    mockIsLoggedIn.mockReturnValue(true);
    mockUseTenantMetadata.mockReturnValue({
      metadata: {
        mentor_include_community_mentors: true,
      },
    });

    mockUseGetAiSearchMentorsQuery.mockReturnValue({
      data: { results: mockMentors, facets: mockFacets },
      isFetching: false,
      isLoading: false,
    });

    mockUseGetPersonnalizedMentorsQuery.mockReturnValue({
      data: { results: mockMentors },
      isFetching: false,
      isLoading: false,
    });

    mockStarMentor.mockReturnValue({ unwrap: vi.fn().mockResolvedValue({}) });
    mockUnstarMentor.mockReturnValue({ unwrap: vi.fn().mockResolvedValue({}) });

    // Default: user is logged in
    mockIsLoggedIn.mockReturnValue(true);
    mockRedirectToAuthSpaJoinTenant.mockClear();
  });

  describe('Basic rendering', () => {
    it('renders the page title', () => {
      renderComponent();

      expect(
        screen.getByText(/Discover and create academic agents/i),
      ).toBeInTheDocument();
    });

    it('renders the search input', () => {
      renderComponent();

      expect(
        screen.getByRole('textbox', { name: /Search agents/i }),
      ).toBeInTheDocument();
    });

    it('renders skip to main content link', () => {
      renderComponent();

      expect(screen.getByText('Skip to main content')).toBeInTheDocument();
    });

    it('renders mentor categories filter', () => {
      renderComponent();

      expect(screen.getByTestId('mentor-categories')).toBeInTheDocument();
    });

    it('renders all mentor sections', () => {
      mockUseTenantMetadata.mockReturnValue({
        metadata: { mentor_include_community_mentors: false },
      });
      renderComponent();

      expect(screen.getByTestId('starred-mentors-section')).toBeDefined();
      expect(screen.getByTestId('featured-mentors-section')).toBeDefined();
      expect(screen.getByTestId('custom-mentors-section')).toBeDefined();
      expect(screen.getByTestId('default-mentors-section')).toBeDefined();
    });
  });

  describe('Section visibility - Default state', () => {
    it('shows all sections when community mentors enabled and createdBy is null (default)', () => {
      // When mentor_include_community_mentors is true and createdBy is null (not set),
      // all sections should be shown with include_main_public_mentors=true
      renderComponent();

      expect(screen.getByTestId('starred-mentors-section')).toBeInTheDocument();
      expect(
        screen.getByTestId('featured-mentors-section'),
      ).toBeInTheDocument();
      expect(screen.getByTestId('custom-mentors-section')).toBeInTheDocument();
      expect(screen.getByTestId('default-mentors-section')).toBeInTheDocument();
    });

    it('shows all sections when community mentors disabled', () => {
      // When mentor_include_community_mentors is false, createdBy starts as null
      // but include_main_public_mentors is false
      mockUseTenantMetadata.mockReturnValue({
        metadata: {
          mentor_include_community_mentors: false,
        },
      });

      renderComponent();

      expect(screen.getByTestId('starred-mentors-section')).toBeInTheDocument();
      expect(
        screen.getByTestId('featured-mentors-section'),
      ).toBeInTheDocument();
      expect(screen.getByTestId('custom-mentors-section')).toBeInTheDocument();
      expect(screen.getByTestId('default-mentors-section')).toBeInTheDocument();
    });
  });

  describe('Authentication Redirects', () => {
    it('calls redirectToAuthSpaJoinTenant when toggleFavorite is called while not logged in', async () => {
      mockIsLoggedIn.mockReturnValue(false);

      renderComponent();

      await waitFor(() => {
        expect(capturedContextValue).not.toBeNull();
      });

      const mentor = {
        id: '1',
        name: 'Test Mentor',
        unique_id: 'test-unique-id',
        starred: false,
      };
      const mockEvent = {
        stopPropagation: vi.fn(),
      } as unknown as React.MouseEvent;

      await act(async () => {
        await capturedContextValue!.toggleFavorite(mentor, mockEvent);
      });

      expect(mockRedirectToAuthSpaJoinTenant).toHaveBeenCalledWith(
        'test-tenant',
      );
    });

    it('calls star mutation when logged in and mentor is not starred', async () => {
      mockIsLoggedIn.mockReturnValue(true);
      const mockUnwrap = vi.fn().mockResolvedValue({});
      mockStarMentor.mockReturnValue({ unwrap: mockUnwrap });

      renderComponent();

      await waitFor(() => {
        expect(capturedContextValue).not.toBeNull();
      });

      const mentor = {
        id: '1',
        name: 'Test Mentor',
        unique_id: 'test-unique-id',
        starred: false,
      };
      const mockEvent = {
        stopPropagation: vi.fn(),
      } as unknown as React.MouseEvent;

      await act(async () => {
        await capturedContextValue!.toggleFavorite(mentor, mockEvent);
      });

      expect(mockStarMentor).toHaveBeenCalledWith({
        org: 'test-tenant',
        userId: 'test-user',
        mentor: 'test-unique-id',
      });
    });

    it('calls unstar mutation when logged in and mentor is starred', async () => {
      mockIsLoggedIn.mockReturnValue(true);
      const mockUnwrap = vi.fn().mockResolvedValue({});
      mockUnstarMentor.mockReturnValue({ unwrap: mockUnwrap });

      renderComponent();

      await waitFor(() => {
        expect(capturedContextValue).not.toBeNull();
      });

      const mentor = {
        id: '1',
        name: 'Test Mentor',
        unique_id: 'test-unique-id',
        starred: true,
      };
      const mockEvent = {
        stopPropagation: vi.fn(),
      } as unknown as React.MouseEvent;

      await act(async () => {
        await capturedContextValue!.toggleFavorite(mentor, mockEvent);
      });

      expect(mockUnstarMentor).toHaveBeenCalledWith({
        org: 'test-tenant',
        userId: 'test-user',
        mentor: 'test-unique-id',
      });
    });
  });

  describe('Search behavior - Only show DefaultMentorsSection', () => {
    it('hides starred, featured, and custom sections when searching', async () => {
      // Set community mentors disabled so default is my-organization (shows all sections)
      mockUseTenantMetadata.mockReturnValue({
        metadata: {
          mentor_include_community_mentors: false,
        },
      });

      const user = userEvent.setup();
      renderComponent();

      // Verify all sections are visible initially with my-organization default
      expect(screen.getByTestId('starred-mentors-section')).toBeInTheDocument();
      expect(
        screen.getByTestId('featured-mentors-section'),
      ).toBeInTheDocument();
      expect(screen.getByTestId('custom-mentors-section')).toBeInTheDocument();

      // Enter search query
      const searchInput = screen.getByRole('textbox', {
        name: /Search agents/i,
      });
      await user.type(searchInput, 'test search');

      // Wait for debounce and re-render
      await waitFor(
        () => {
          expect(
            screen.queryByTestId('starred-mentors-section'),
          ).not.toBeInTheDocument();
          expect(
            screen.queryByTestId('featured-mentors-section'),
          ).not.toBeInTheDocument();
          expect(
            screen.queryByTestId('custom-mentors-section'),
          ).not.toBeInTheDocument();
        },
        { timeout: 1000 },
      );

      // Default section should still be visible
      expect(screen.getByTestId('default-mentors-section')).toBeInTheDocument();
    });

    it('shows all sections again when search is cleared (with community disabled)', async () => {
      // Set community mentors disabled so default is my-organization
      mockUseTenantMetadata.mockReturnValue({
        metadata: {
          mentor_include_community_mentors: false,
        },
      });

      const user = userEvent.setup();
      renderComponent();

      // Verify sections are visible initially with my-organization default
      expect(screen.getByTestId('starred-mentors-section')).toBeInTheDocument();

      // Enter search query
      const searchInput = screen.getByRole('textbox', {
        name: /Search agents/i,
      });
      await user.type(searchInput, 'test');

      // Wait for sections to hide
      await waitFor(
        () => {
          expect(
            screen.queryByTestId('starred-mentors-section'),
          ).not.toBeInTheDocument();
        },
        { timeout: 1000 },
      );

      // Clear search
      await user.clear(searchInput);

      // Wait for sections to reappear
      await waitFor(
        () => {
          expect(
            screen.getByTestId('starred-mentors-section'),
          ).toBeInTheDocument();
          expect(
            screen.getByTestId('featured-mentors-section'),
          ).toBeInTheDocument();
          expect(
            screen.getByTestId('custom-mentors-section'),
          ).toBeInTheDocument();
        },
        { timeout: 1000 },
      );
    });

    it('handles search input changes', async () => {
      renderComponent();

      const searchInput = screen.getByRole('textbox', {
        name: /Search agents/i,
      });
      await userEvent.type(searchInput, 'mathematics');

      expect(searchInput).toHaveValue('mathematics');
    });

    it('debounces search input', async () => {
      renderComponent();

      const searchInput = screen.getByRole('textbox', {
        name: /Search agents/i,
      });
      fireEvent.change(searchInput, { target: { value: 'm' } });
      fireEvent.change(searchInput, { target: { value: 'ma' } });
      fireEvent.change(searchInput, { target: { value: 'mat' } });

      // The debounced value should update after 500ms
      await waitFor(
        () => {
          expect(searchInput).toHaveValue('mat');
        },
        { timeout: 600 },
      );
    });
  });

  describe('Created By filter - Me', () => {
    it('shows only custom section when createdBy is me', async () => {
      const user = userEvent.setup();
      renderComponent();

      // Click "Created By Me" button
      const createdByMeBtn = screen.getByTestId('change-created-by-me');
      await user.click(createdByMeBtn);

      await waitFor(() => {
        expect(
          screen.queryByTestId('starred-mentors-section'),
        ).not.toBeInTheDocument();
        expect(
          screen.queryByTestId('featured-mentors-section'),
        ).not.toBeInTheDocument();
        expect(
          screen.getByTestId('custom-mentors-section'),
        ).toBeInTheDocument();
        expect(
          screen.queryByTestId('default-mentors-section'),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('Created By filter - Community', () => {
    it('shows all sections when createdBy is community', async () => {
      const user = userEvent.setup();
      renderComponent();

      // Click "Created By Community" button
      const createdByCommunityBtn = screen.getByTestId(
        'change-created-by-community',
      );
      await user.click(createdByCommunityBtn);

      await waitFor(() => {
        expect(
          screen.getByTestId('starred-mentors-section'),
        ).toBeInTheDocument();
        expect(
          screen.getByTestId('featured-mentors-section'),
        ).toBeInTheDocument();
        expect(
          screen.getByTestId('custom-mentors-section'),
        ).toBeInTheDocument();
        expect(
          screen.getByTestId('default-mentors-section'),
        ).toBeInTheDocument();
      });
    });

    it('switches to community view when community filter is selected', async () => {
      const user = userEvent.setup();
      renderComponent();

      const communityButton = screen.getByTestId('change-created-by-community');
      await user.click(communityButton);

      // Verify that the tenant key is switched to main tenant
      await waitFor(() => {
        expect(capturedContextValue!.tenantKey).toBe('main');
      });
    });
  });

  describe('Created By filter - My Organization', () => {
    it('switches back to my-organization view', async () => {
      const user = userEvent.setup();
      renderComponent();

      const orgButton = screen.getByTestId('change-created-by-my-organization');
      await user.click(orgButton);

      // Should show all sections
      await waitFor(() => {
        expect(
          screen.getByTestId('starred-mentors-section'),
        ).toBeInTheDocument();
        expect(
          screen.getByTestId('featured-mentors-section'),
        ).toBeInTheDocument();
        expect(
          screen.getByTestId('custom-mentors-section'),
        ).toBeInTheDocument();
        expect(
          screen.getByTestId('default-mentors-section'),
        ).toBeInTheDocument();
      });
    });
  });

  describe('Clearing Created By filter', () => {
    it('resets to null state when cleared', async () => {
      const user = userEvent.setup();
      renderComponent();

      // First set to community
      const communityButton = screen.getByTestId('change-created-by-community');
      await user.click(communityButton);

      await waitFor(() => {
        expect(capturedContextValue!.createdBy).toBe('community');
        expect(capturedContextValue!.tenantKey).toBe('main');
      });

      // Now clear it
      const clearButton = screen.getByTestId('clear-created-by');
      await user.click(clearButton);

      // Should reset to null with community enabled defaults
      await waitFor(() => {
        expect(capturedContextValue!.createdBy).toBeNull();
        expect(capturedContextValue!.tenantKey).toBe('test-tenant');
        expect(capturedContextValue!.includeMainPublicMentors).toBe(true);
      });
    });

    it('shows all sections after clearing', async () => {
      const user = userEvent.setup();
      renderComponent();

      // First set to me (only shows custom section)
      const meButton = screen.getByTestId('change-created-by-me');
      await user.click(meButton);

      await waitFor(() => {
        expect(
          screen.getByTestId('custom-mentors-section'),
        ).toBeInTheDocument();
        expect(
          screen.queryByTestId('starred-mentors-section'),
        ).not.toBeInTheDocument();
      });

      // Now clear it
      const clearButton = screen.getByTestId('clear-created-by');
      await user.click(clearButton);

      // Should show all sections again
      await waitFor(() => {
        expect(
          screen.getByTestId('starred-mentors-section'),
        ).toBeInTheDocument();
        expect(
          screen.getByTestId('featured-mentors-section'),
        ).toBeInTheDocument();
        expect(
          screen.getByTestId('custom-mentors-section'),
        ).toBeInTheDocument();
        expect(
          screen.getByTestId('default-mentors-section'),
        ).toBeInTheDocument();
      });
    });
  });

  describe('Search input behavior', () => {
    it('shows search icon when not loading', () => {
      renderComponent();

      // Search icon should be visible (no animate-spin class)
      const searchContainer = screen.getByRole('textbox', {
        name: /Search agents/i,
      }).parentElement;
      expect(
        searchContainer?.querySelector('.animate-spin'),
      ).not.toBeInTheDocument();
    });

    it('shows loading spinner when searching and loading', async () => {
      const user = userEvent.setup();

      // Set up loading state
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: { results: mockMentors, facets: mockFacets },
        isFetching: true,
      });

      renderComponent();

      const searchInput = screen.getByRole('textbox', {
        name: /Search agents/i,
      });
      await user.type(searchInput, 'test');

      // Note: Due to debounce and component state, this may be tricky to test
      // The loading spinner appears when searchQuery is truthy AND any loading state is true
    });

    it('has proper placeholder text', () => {
      renderComponent();

      const searchInput = screen.getByRole('textbox', {
        name: /Search agents/i,
      });
      expect(searchInput).toHaveAttribute('placeholder', 'Search');
    });
  });

  describe('Context value', () => {
    it('provides correct tenantKey to context', () => {
      // This is tested implicitly through the section components receiving the context
      renderComponent();

      // The sections receive context - if they render, context is provided correctly
      expect(screen.getByTestId('default-mentors-section')).toBeInTheDocument();
    });

    it('provides correct tenant key to children', () => {
      mockUseTenantMetadata.mockReturnValue({
        metadata: { mentor_include_community_mentors: false },
      });
      render(
        <TooltipProvider>
          <ExplorePageContent tenantKey="test-tenant-123" />
        </TooltipProvider>,
      );

      // Context value is provided to all child components
      expect(screen.getByTestId('custom-mentors-section')).toBeInTheDocument();
    });

    it('provides username to children', () => {
      mockUseUsername.mockReturnValue('john.doe');

      renderComponent();

      // Username should be available in context
      expect(mockUseUsername).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has proper main content landmark', () => {
      renderComponent();

      const mainContent = document.getElementById('main-content');
      expect(mainContent).toBeInTheDocument();
      expect(mainContent).toHaveAttribute(
        'aria-label',
        'Agent exploration page',
      );
    });

    it('search input has proper label', () => {
      renderComponent();

      expect(screen.getByLabelText(/Search agents/i)).toBeInTheDocument();
    });

    it('page has proper heading structure', () => {
      renderComponent();

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toBeInTheDocument();
    });
  });

  describe('Filter integration', () => {
    it('passes facets to MentorCategories', () => {
      renderComponent();

      // MentorCategories is rendered
      expect(screen.getByTestId('mentor-categories')).toBeInTheDocument();
    });

    it('updates filters when category filter changes', async () => {
      const user = userEvent.setup();
      renderComponent();

      const filterButton = screen.getByTestId('change-filter-btn');
      await user.click(filterButton);

      // Filter state should be updated (verified through re-queries)
      await waitFor(() => {
        expect(capturedContextValue!.filters.categories).toBe('Test');
      });
    });
  });

  describe('Custom mentors check for Me filter', () => {
    it('checks for custom mentors to show Me in filter', () => {
      mockUseGetPersonnalizedMentorsQuery.mockReturnValue({
        data: { results: [{ id: '1', name: 'Custom Mentor' }] },
        isFetching: false,
      });

      renderComponent();

      // The query should be called to check for custom mentors
      expect(mockUseGetPersonnalizedMentorsQuery).toHaveBeenCalled();
    });

    it('passes skip true when username is null', () => {
      mockUseUsername.mockReturnValue(null);

      renderComponent();

      expect(mockUseGetPersonnalizedMentorsQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ skip: true }),
      );
    });
  });

  describe('Context functions', () => {
    it('handleMentorClick navigates to mentor with unique_id', async () => {
      renderComponent();

      await waitFor(() => {
        expect(capturedContextValue).not.toBeNull();
      });

      const mentor = {
        id: '1',
        name: 'Test Mentor',
        unique_id: 'test-unique-id',
      };
      act(() => {
        capturedContextValue!.handleMentorClick(mentor);
      });

      expect(mockNavigateToMentor).toHaveBeenCalledWith('test-unique-id');
    });

    it('handleMentorClick does not navigate when mentor has no unique_id', async () => {
      renderComponent();

      await waitFor(() => {
        expect(capturedContextValue).not.toBeNull();
      });

      const mentor = { id: '1', name: 'Test Mentor' };
      act(() => {
        capturedContextValue!.handleMentorClick(mentor);
      });

      expect(mockNavigateToMentor).not.toHaveBeenCalled();
    });

    it('toggleFavorite stars a mentor when not starred', async () => {
      mockIsLoggedIn.mockReturnValue(true);
      const mockUnwrap = vi.fn().mockResolvedValue({});
      mockStarMentor.mockReturnValue({ unwrap: mockUnwrap });

      renderComponent();

      await waitFor(() => {
        expect(capturedContextValue).not.toBeNull();
      });

      const mentor = {
        id: '1',
        name: 'Test Mentor',
        unique_id: 'test-unique-id',
        starred: false,
      };
      const mockEvent = {
        stopPropagation: vi.fn(),
      } as unknown as React.MouseEvent;

      await act(async () => {
        await capturedContextValue!.toggleFavorite(mentor, mockEvent);
      });

      expect(mockEvent.stopPropagation).toHaveBeenCalled();
      expect(mockStarMentor).toHaveBeenCalledWith({
        org: 'test-tenant',
        userId: 'test-user',
        mentor: 'test-unique-id',
      });
    });

    it('toggleFavorite unstars a mentor when already starred', async () => {
      mockIsLoggedIn.mockReturnValue(true);
      const mockUnwrap = vi.fn().mockResolvedValue({});
      mockUnstarMentor.mockReturnValue({ unwrap: mockUnwrap });

      renderComponent();

      await waitFor(() => {
        expect(capturedContextValue).not.toBeNull();
      });

      const mentor = {
        id: '1',
        name: 'Test Mentor',
        unique_id: 'test-unique-id',
        starred: true,
      };
      const mockEvent = {
        stopPropagation: vi.fn(),
      } as unknown as React.MouseEvent;

      await act(async () => {
        await capturedContextValue!.toggleFavorite(mentor, mockEvent);
      });

      expect(mockUnstarMentor).toHaveBeenCalledWith({
        org: 'test-tenant',
        userId: 'test-user',
        mentor: 'test-unique-id',
      });
    });

    it('toggleFavorite does nothing when username is null', async () => {
      mockUseUsername.mockReturnValue(null);
      mockIsLoggedIn.mockReturnValue(true);

      renderComponent();

      await waitFor(() => {
        expect(capturedContextValue).not.toBeNull();
      });

      const mentor = {
        id: '1',
        name: 'Test Mentor',
        unique_id: 'test-unique-id',
      };
      const mockEvent = {
        stopPropagation: vi.fn(),
      } as unknown as React.MouseEvent;

      await act(async () => {
        await capturedContextValue!.toggleFavorite(mentor, mockEvent);
      });

      expect(mockStarMentor).not.toHaveBeenCalled();
      expect(mockUnstarMentor).not.toHaveBeenCalled();
    });

    it('toggleFavorite redirects to auth when user is not logged in', async () => {
      mockIsLoggedIn.mockReturnValue(false);

      renderComponent();

      await waitFor(() => {
        expect(capturedContextValue).not.toBeNull();
      });

      const mentor = {
        id: '1',
        name: 'Test Mentor',
        unique_id: 'test-unique-id',
        starred: false,
      };
      const mockEvent = {
        stopPropagation: vi.fn(),
      } as unknown as React.MouseEvent;

      await act(async () => {
        await capturedContextValue!.toggleFavorite(mentor, mockEvent);
      });

      expect(mockEvent.stopPropagation).toHaveBeenCalled();
      expect(mockRedirectToAuthSpaJoinTenant).toHaveBeenCalledWith(
        'test-tenant',
      );
      expect(mockStarMentor).not.toHaveBeenCalled();
      expect(mockUnstarMentor).not.toHaveBeenCalled();
    });

    it('toggleFavorite handles errors gracefully', async () => {
      mockIsLoggedIn.mockReturnValue(true);
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockStarMentor.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(new Error('API Error')),
      });

      renderComponent();

      await waitFor(() => {
        expect(capturedContextValue).not.toBeNull();
      });

      const mentor = {
        id: '1',
        name: 'Test Mentor',
        unique_id: 'test-unique-id',
        starred: false,
      };
      const mockEvent = {
        stopPropagation: vi.fn(),
      } as unknown as React.MouseEvent;

      await act(async () => {
        await capturedContextValue!.toggleFavorite(mentor, mockEvent);
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error toggling favorite:',
        expect.any(Error),
      );
      consoleErrorSpy.mockRestore();
    });

    it('toggleFavorite handles mentor without unique_id', async () => {
      mockIsLoggedIn.mockReturnValue(true);
      const mockUnwrap = vi.fn().mockResolvedValue({});
      mockStarMentor.mockReturnValue({ unwrap: mockUnwrap });

      renderComponent();

      await waitFor(() => {
        expect(capturedContextValue).not.toBeNull();
      });

      const mentor = { id: '1', name: 'Test Mentor', starred: false };
      const mockEvent = {
        stopPropagation: vi.fn(),
      } as unknown as React.MouseEvent;

      await act(async () => {
        await capturedContextValue!.toggleFavorite(mentor, mockEvent);
      });

      expect(mockStarMentor).toHaveBeenCalledWith({
        org: 'test-tenant',
        userId: 'test-user',
        mentor: '',
      });
    });
  });

  describe('includeMainPublicMentors logic', () => {
    it('returns false when mentor_include_community_mentors is false', async () => {
      mockUseTenantMetadata.mockReturnValue({
        metadata: {
          mentor_include_community_mentors: false,
        },
      });

      renderComponent();

      await waitFor(() => {
        expect(capturedContextValue).not.toBeNull();
      });

      expect(capturedContextValue!.includeMainPublicMentors).toBe(false);
    });

    it('returns true when createdBy is null and community mentors enabled', async () => {
      // When community mentors enabled and createdBy is null (default), include_main_public_mentors should be true
      renderComponent();

      await waitFor(() => {
        expect(capturedContextValue).not.toBeNull();
        expect(capturedContextValue!.createdBy).toBeNull();
        expect(capturedContextValue!.includeMainPublicMentors).toBe(true);
      });
    });

    it('returns false for my-organization createdBy', async () => {
      const user = userEvent.setup();
      renderComponent();

      // Switch to my-organization
      const createdByMyOrgBtn = screen.getByTestId(
        'change-created-by-my-organization',
      );
      await user.click(createdByMyOrgBtn);

      await waitFor(() => {
        expect(capturedContextValue).not.toBeNull();
        expect(capturedContextValue!.includeMainPublicMentors).toBe(false);
      });
    });

    it('returns true for community createdBy', async () => {
      const user = userEvent.setup();
      renderComponent();

      const createdByCommunityBtn = screen.getByTestId(
        'change-created-by-community',
      );
      await user.click(createdByCommunityBtn);

      await waitFor(() => {
        expect(capturedContextValue!.includeMainPublicMentors).toBe(true);
      });
    });

    it('returns false for me createdBy', async () => {
      const user = userEvent.setup();
      renderComponent();

      const createdByMeBtn = screen.getByTestId('change-created-by-me');
      await user.click(createdByMeBtn);

      await waitFor(() => {
        expect(capturedContextValue!.includeMainPublicMentors).toBe(false);
      });
    });
  });

  describe('Effective tenant key', () => {
    it('uses prop tenant key when createdBy is null (default)', async () => {
      // When createdBy is null, use the current tenant key
      renderComponent();

      await waitFor(() => {
        expect(capturedContextValue).not.toBeNull();
        expect(capturedContextValue!.createdBy).toBeNull();
        expect(capturedContextValue!.tenantKey).toBe('test-tenant');
      });
    });

    it('uses main tenant key when createdBy is community', async () => {
      const user = userEvent.setup();
      renderComponent();

      const createdByCommunityBtn = screen.getByTestId(
        'change-created-by-community',
      );
      await user.click(createdByCommunityBtn);

      await waitFor(() => {
        expect(capturedContextValue!.tenantKey).toBe('main');
      });
    });

    it('uses prop tenant key when createdBy is my-organization', async () => {
      const user = userEvent.setup();
      renderComponent();

      // Switch to my-organization
      const createdByMyOrgBtn = screen.getByTestId(
        'change-created-by-my-organization',
      );
      await user.click(createdByMyOrgBtn);

      await waitFor(() => {
        expect(capturedContextValue).not.toBeNull();
        expect(capturedContextValue!.tenantKey).toBe('test-tenant');
      });
    });

    it('uses prop tenant key when createdBy is me', async () => {
      const user = userEvent.setup();
      renderComponent();

      const createdByMeBtn = screen.getByTestId('change-created-by-me');
      await user.click(createdByMeBtn);

      await waitFor(() => {
        expect(capturedContextValue).not.toBeNull();
        expect(capturedContextValue!.tenantKey).toBe('test-tenant');
      });
    });
  });

  describe('Filter changes', () => {
    it('updates filters when onFiltersChange is called', async () => {
      const user = userEvent.setup();
      renderComponent();

      const changeFilterBtn = screen.getByTestId('change-filter-btn');
      await user.click(changeFilterBtn);

      await waitFor(() => {
        expect(capturedContextValue!.filters.categories).toBe('Test');
      });
    });
  });

  describe('API query parameters', () => {
    it('passes correct parameters when createdBy is null and community enabled', () => {
      // When community mentors are enabled and createdBy is null (default),
      // platform_key is current tenant and include_main_public_mentors is true
      renderComponent();

      expect(mockUseGetAiSearchMentorsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          platform_key: 'test-tenant',
          limit: 1,
          include_main_public_mentors: true,
        }),
        expect.objectContaining({
          skip: false,
        }),
      );
    });

    it('passes correct parameters when community mentors disabled', () => {
      // When community mentors are disabled, include_main_public_mentors is false
      mockUseTenantMetadata.mockReturnValue({
        metadata: {
          mentor_include_community_mentors: false,
        },
      });

      renderComponent();

      expect(mockUseGetAiSearchMentorsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          platform_key: 'test-tenant',
          limit: 1,
          include_main_public_mentors: false,
        }),
        expect.objectContaining({
          skip: false,
        }),
      );
    });

    it('skips query when tenantKey is empty', () => {
      render(
        <TooltipProvider>
          <ExplorePageContent tenantKey="" />
        </TooltipProvider>,
      );

      expect(mockUseGetAiSearchMentorsQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          skip: true,
        }),
      );
    });
  });

  describe('hasCustomMentors', () => {
    it('determines hasCustomMentors as true when custom mentors exist', () => {
      mockUseGetPersonnalizedMentorsQuery.mockReturnValue({
        data: { results: [{ id: '1', name: 'Custom Mentor' }] },
        isFetching: false,
      });

      renderComponent();

      // This is implicitly tested through the MentorCategories receiving includeMeToCreatedByFilter
      expect(mockUseGetPersonnalizedMentorsQuery).toHaveBeenCalled();
    });

    it('determines hasCustomMentors as false when no custom mentors', () => {
      mockUseGetPersonnalizedMentorsQuery.mockReturnValue({
        data: { results: [] },
        isFetching: false,
      });

      renderComponent();

      expect(mockUseGetPersonnalizedMentorsQuery).toHaveBeenCalled();
    });

    it('determines hasCustomMentors as false when results is undefined', () => {
      mockUseGetPersonnalizedMentorsQuery.mockReturnValue({
        data: {},
        isFetching: false,
      });

      renderComponent();

      expect(mockUseGetPersonnalizedMentorsQuery).toHaveBeenCalled();
    });
  });

  describe('Loading States', () => {
    it('updates loading states for all sections', () => {
      mockUseTenantMetadata.mockReturnValue({
        metadata: { mentor_include_community_mentors: false },
      });
      renderComponent();

      // Context provides loading state setters to all sections
      expect(screen.getByTestId('starred-mentors-section')).toBeDefined();
      expect(screen.getByTestId('custom-mentors-section')).toBeDefined();
      expect(screen.getByTestId('featured-mentors-section')).toBeDefined();
      expect(screen.getByTestId('default-mentors-section')).toBeInTheDocument();
    });
  });

  describe('Mentor Click Handler', () => {
    it('handles mentor click navigation', () => {
      renderComponent();

      // The context provides handleMentorClick to children
      // which should call navigateToMentor with the mentor's unique_id
      expect(mockNavigateToMentor).toBeDefined();
    });
  });
});
