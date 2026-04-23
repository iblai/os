import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import { MyMentorsModal } from '../my-mentors-modal';
import { analyticsReducer } from '@/features/analytics/slice';

// ============================================================================
// MOCKS
// ============================================================================

const navigateToMentorMock = vi.fn();
const openCreateMentorModalMock = vi.fn();
const executeWithTrialCheckMock = vi.fn((fn: () => void) => fn());
const closeModalMock = vi.fn();
const setSearchQueryMock = vi.fn();
const handlePageChangeMock = vi.fn();
const onCloseMock = vi.fn();

let mockPathname = '/platform/tenant123/mentor456';
let mockMentorId = 'mentor456';
let mockIsLoggedIn = true;
let mockUserIsStudent = false;
let mockIsFetching = false;
let mockIsLoading = false;
let mockIsModalOpen = false;
let mockFreeTrialDialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> | null = null;
let mockMentors: any[] = [];
let mockCurrentPage = 1;
let mockTotalPages = 1;
let mockSearchQuery = '';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => mockPathname,
  useParams: () => ({ tenantKey: 'tenant123', mentorId: mockMentorId }),
}));

vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({
    openCreateMentorModal: openCreateMentorModalMock,
    navigateToMentor: navigateToMentorMock,
  }),
}));

vi.mock('@/hooks/use-user', () => ({
  useUserIsStudent: () => mockUserIsStudent,
}));

vi.mock('@/hooks/user-user-actions', () => ({
  useShowFreeTrialDialog: () => ({
    executeWithTrialCheck: executeWithTrialCheckMock,
    isModalOpen: mockIsModalOpen,
    FreeTrialDialog: mockFreeTrialDialog,
    closeModal: closeModalMock,
  }),
}));

vi.mock('@/hooks/use-mentors', () => ({
  useMentorsWithPagination: () => ({
    mentors: mockMentors,
    isLoading: mockIsLoading,
    isFetching: mockIsFetching,
    currentPage: mockCurrentPage,
    totalPages: mockTotalPages,
    searchQuery: mockSearchQuery,
    setSearchQuery: setSearchQueryMock,
    handlePageChange: handlePageChangeMock,
  }),
}));

vi.mock('@/lib/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils')>();
  return {
    ...actual,
    isLoggedIn: () => mockIsLoggedIn,
  };
});

vi.mock('@/components/ibl-pagination', () => ({
  default: ({
    currentPage,
    totalPages,
    onPageChange,
    disabled,
  }: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    disabled: boolean;
  }) => (
    <div data-testid="ibl-pagination">
      <span data-testid="current-page">{currentPage}</span>
      <span data-testid="total-pages">{totalPages}</span>
      <button
        data-testid="next-page"
        disabled={disabled}
        onClick={() => onPageChange(currentPage + 1)}
      >
        Next
      </button>
    </div>
  ),
}));

vi.mock('@/components/spinner', () => ({
  Spinner: ({ className }: { className?: string }) => (
    <div data-testid="spinner" className={className} />
  ),
}));

// ============================================================================
// HELPERS
// ============================================================================

const sampleMentors = [
  {
    id: '1',
    name: 'Mentor Alpha',
    unique_id: 'mentor-alpha',
    slug: 'mentor-alpha',
    profile_image: 'https://example.com/alpha.png',
    description: 'Alpha description',
  },
  {
    id: '2',
    name: 'Mentor Beta',
    unique_id: 'mentor-beta',
    slug: 'mentor-beta',
    profile_image: null,
    description: 'Beta description',
  },
];

function createTestStore() {
  return configureStore({
    reducer: { analytics: analyticsReducer },
  });
}

function renderModal(
  props: Partial<React.ComponentProps<typeof MyMentorsModal>> = {},
) {
  const store = createTestStore();
  const result = render(
    <Provider store={store}>
      <MyMentorsModal isOpen={true} onClose={onCloseMock} {...props} />
    </Provider>,
  );
  return { ...result, store };
}

// ============================================================================
// TESTS
// ============================================================================

describe('MyMentorsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = '/platform/tenant123/mentor456';
    mockMentorId = 'mentor456';
    mockIsLoggedIn = true;
    mockUserIsStudent = false;
    mockIsFetching = false;
    mockIsLoading = false;
    mockIsModalOpen = false;
    mockFreeTrialDialog = null;
    mockMentors = sampleMentors;
    mockCurrentPage = 1;
    mockTotalPages = 3;
    mockSearchQuery = '';
  });

  // --------------------------------------------------------------------------
  // Rendering
  // --------------------------------------------------------------------------

  it('renders the dialog with title', () => {
    renderModal();
    expect(screen.getByText('My Mentors')).toBeInTheDocument();
  });

  it('does not render dialog content when closed', () => {
    renderModal({ isOpen: false });
    expect(screen.queryByText('My Mentors')).not.toBeInTheDocument();
  });

  it('renders the search input', () => {
    renderModal();
    expect(screen.getByPlaceholderText('Search mentors')).toBeInTheDocument();
  });

  it('renders mentor cards', () => {
    renderModal();
    expect(screen.getByText('Mentor Alpha')).toBeInTheDocument();
    expect(screen.getByText('Mentor Beta')).toBeInTheDocument();
    expect(screen.getByText('Alpha description')).toBeInTheDocument();
    expect(screen.getByText('Beta description')).toBeInTheDocument();
  });

  it('renders empty list when no mentors', () => {
    mockMentors = [];
    renderModal();
    expect(screen.queryByText('Mentor Alpha')).not.toBeInTheDocument();
  });

  it('renders avatar fallback text for mentors', () => {
    renderModal();
    // Radix Avatar in jsdom shows the fallback text
    const fallbacks = screen.getAllByText('AI');
    expect(fallbacks).toHaveLength(sampleMentors.length);
  });

  it('renders pagination component', () => {
    renderModal();
    expect(screen.getByTestId('ibl-pagination')).toBeInTheDocument();
    expect(screen.getByTestId('current-page')).toHaveTextContent('1');
    expect(screen.getByTestId('total-pages')).toHaveTextContent('3');
  });

  // --------------------------------------------------------------------------
  // Loading / Fetching states
  // --------------------------------------------------------------------------

  it('shows spinner when fetching', () => {
    mockIsFetching = true;
    renderModal();
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('shows search icon when not fetching', () => {
    mockIsFetching = false;
    renderModal();
    expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
  });

  it('disables pagination when fetching', () => {
    mockIsFetching = true;
    renderModal();
    expect(screen.getByTestId('next-page')).toBeDisabled();
  });

  it('disables pagination when loading', () => {
    mockIsLoading = true;
    renderModal();
    expect(screen.getByTestId('next-page')).toBeDisabled();
  });

  it('enables pagination when not loading or fetching', () => {
    mockIsLoading = false;
    mockIsFetching = false;
    renderModal();
    expect(screen.getByTestId('next-page')).not.toBeDisabled();
  });

  // --------------------------------------------------------------------------
  // Create button visibility
  // --------------------------------------------------------------------------

  it('shows Create button when logged in, not student, and not hidden', () => {
    mockIsLoggedIn = true;
    mockUserIsStudent = false;
    renderModal();
    expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument();
  });

  it('hides Create button when not logged in', () => {
    mockIsLoggedIn = false;
    renderModal();
    expect(
      screen.queryByRole('button', { name: /create/i }),
    ).not.toBeInTheDocument();
  });

  it('hides Create button when user is student', () => {
    mockUserIsStudent = true;
    renderModal();
    expect(
      screen.queryByRole('button', { name: /create/i }),
    ).not.toBeInTheDocument();
  });

  it('hides Create button when hideCreateButton is true', () => {
    renderModal({ hideCreateButton: true });
    expect(
      screen.queryByRole('button', { name: /create/i }),
    ).not.toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // Create button interaction
  // --------------------------------------------------------------------------

  it('calls executeWithTrialCheck with openCreateMentorModal on Create click', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /create/i }));
    expect(executeWithTrialCheckMock).toHaveBeenCalledWith(
      openCreateMentorModalMock,
    );
  });

  // --------------------------------------------------------------------------
  // Search interaction
  // --------------------------------------------------------------------------

  it('calls setSearchQuery on search input change', () => {
    renderModal();
    const input = screen.getByPlaceholderText('Search mentors');
    fireEvent.change(input, { target: { value: 'test query' } });
    expect(setSearchQueryMock).toHaveBeenCalledWith('test query');
  });

  // --------------------------------------------------------------------------
  // Pagination interaction
  // --------------------------------------------------------------------------

  it('calls handlePageChange when pagination is clicked', () => {
    renderModal();
    fireEvent.click(screen.getByTestId('next-page'));
    expect(handlePageChangeMock).toHaveBeenCalledWith(2);
  });

  // --------------------------------------------------------------------------
  // Mentor click — analytics view
  // --------------------------------------------------------------------------

  it('dispatches setSelectedMentor and closes on mentor click in analytics view', () => {
    mockPathname = '/platform/tenant123/mentor456/analytics';
    const { store } = renderModal();
    fireEvent.click(screen.getByText('Mentor Alpha'));
    const state = store.getState();
    expect(state.analytics.selectedMentor).toEqual({
      slug: 'mentor-alpha',
      name: 'Mentor Alpha',
      profileImage: 'https://example.com/alpha.png',
      unique_id: 'mentor-alpha',
      id: '1',
    });
    expect(onCloseMock).toHaveBeenCalled();
  });

  it('dispatches mentor db id from mentor.id on analytics click', () => {
    mockPathname = '/platform/tenant123/mentor456/analytics';
    const { store } = renderModal();
    fireEvent.click(screen.getByText('Mentor Beta'));
    expect(store.getState().analytics.selectedMentor?.id).toBe('2');
  });

  it('dispatches id as undefined when mentor has no id in analytics view', () => {
    mockPathname = '/platform/tenant123/mentor456/analytics';
    mockMentors = [
      {
        // no `id` field — simulates a stale/partial mentor record
        name: 'Idless Mentor',
        unique_id: 'idless',
        slug: 'idless',
        profile_image: '',
        description: 'no id',
      },
    ];
    const { store } = renderModal();
    fireEvent.click(screen.getByText('Idless Mentor'));
    expect(store.getState().analytics.selectedMentor?.id).toBeUndefined();
  });

  it('does not call navigateToMentor in analytics view', () => {
    mockPathname = '/platform/tenant123/mentor456/analytics';
    renderModal();
    fireEvent.click(screen.getByText('Mentor Alpha'));
    expect(navigateToMentorMock).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // Mentor click — normal navigation (different mentor)
  // --------------------------------------------------------------------------

  it('navigates to a different mentor and closes modal', () => {
    mockMentorId = 'some-other-mentor';
    renderModal();
    fireEvent.click(screen.getByText('Mentor Alpha'));
    expect(navigateToMentorMock).toHaveBeenCalledWith('mentor-alpha');
    expect(onCloseMock).toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // Mentor click — same mentor, on projects page
  // --------------------------------------------------------------------------

  it('navigates to same mentor when on a projects page', () => {
    mockMentorId = 'mentor-alpha';
    mockPathname = '/platform/tenant123/mentor-alpha/projects/some-project';
    renderModal();
    fireEvent.click(screen.getByText('Mentor Alpha'));
    expect(navigateToMentorMock).toHaveBeenCalledWith('mentor-alpha');
    expect(onCloseMock).toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // Mentor click — same mentor, NOT on projects page
  // --------------------------------------------------------------------------

  it('does not navigate when clicking same mentor outside projects page', () => {
    mockMentorId = 'mentor-alpha';
    mockPathname = '/platform/tenant123/mentor-alpha/chat';
    renderModal();
    fireEvent.click(screen.getByText('Mentor Alpha'));
    expect(navigateToMentorMock).not.toHaveBeenCalled();
    expect(onCloseMock).toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // FreeTrialDialog rendering
  // --------------------------------------------------------------------------

  it('renders FreeTrialDialog when isModalOpen is true and component exists', () => {
    mockIsModalOpen = true;
    mockFreeTrialDialog = ({
      onClose,
    }: {
      isOpen: boolean;
      onClose: () => void;
    }) => (
      <div data-testid="free-trial-dialog">
        Free Trial
        <button onClick={onClose}>Close Trial</button>
      </div>
    );
    renderModal();
    expect(screen.getByTestId('free-trial-dialog')).toBeInTheDocument();
  });

  it('does not render FreeTrialDialog when isModalOpen is false', () => {
    mockIsModalOpen = false;
    mockFreeTrialDialog = () => (
      <div data-testid="free-trial-dialog">Free Trial</div>
    );
    renderModal();
    expect(screen.queryByTestId('free-trial-dialog')).not.toBeInTheDocument();
  });

  it('does not render FreeTrialDialog when component is null', () => {
    mockIsModalOpen = true;
    mockFreeTrialDialog = null;
    renderModal();
    expect(screen.queryByTestId('free-trial-dialog')).not.toBeInTheDocument();
  });

  it('passes closeModal to FreeTrialDialog onClose', () => {
    mockIsModalOpen = true;
    mockFreeTrialDialog = ({
      onClose,
    }: {
      isOpen: boolean;
      onClose: () => void;
    }) => (
      <button data-testid="close-trial" onClick={onClose}>
        Close
      </button>
    );
    renderModal();
    fireEvent.click(screen.getByTestId('close-trial'));
    expect(closeModalMock).toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // Dialog onOpenChange
  // --------------------------------------------------------------------------

  it('calls onClose when dialog is closed via onOpenChange', () => {
    renderModal();
    // Radix Dialog calls onOpenChange(false) when closing — simulate via the close button
    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);
    expect(onCloseMock).toHaveBeenCalled();
  });
});
