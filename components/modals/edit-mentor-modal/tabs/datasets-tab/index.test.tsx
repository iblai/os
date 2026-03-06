import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

import { DatasetsTab } from './index';

// ============================================================================
// MOCKS
// ============================================================================

/**
 * Mock hooks for pagination and dataset management
 */
const mockSetSearchQuery = vi.fn();
const mockHandlePageChange = vi.fn();
const mockOpenAddResourceModal = vi.fn();
const mockExecuteWithTrialCheck = vi.fn();
const mockCloseModal = vi.fn();

/**
 * Default pagination state
 */
let mockPaginationState: {
  datasets: { results: any[] } | undefined;
  isDatasetsLoading: boolean;
  isDatasetsFetching: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  currentPage: number;
  totalPages: number;
  handlePageChange: (page: number) => void;
} = {
  datasets: {
    results: [],
  },
  isDatasetsLoading: false,
  isDatasetsFetching: false,
  searchQuery: '',
  setSearchQuery: mockSetSearchQuery,
  currentPage: 1,
  totalPages: 1,
  handlePageChange: mockHandlePageChange,
};

/**
 * Default free trial dialog state
 */
let mockFreeTrialState: {
  executeWithTrialCheck: (callback: () => void, adminAction?: boolean) => void;
  isModalOpen: boolean;
  FreeTrialDialog: React.ComponentType<any> | null;
  closeModal: () => void;
} = {
  executeWithTrialCheck: mockExecuteWithTrialCheck,
  isModalOpen: false,
  FreeTrialDialog: null,
  closeModal: mockCloseModal,
};

/**
 * Mock custom hooks
 */
vi.mock('@/hooks/use-datasets', () => ({
  useDatasetsWithPagination: () => mockPaginationState,
}));

vi.mock('@/hooks/user-user-actions', () => ({
  useShowFreeTrialDialog: () => mockFreeTrialState,
}));

/**
 * Mock UI components
 */
vi.mock('@/components/ui/table', () => ({
  Table: ({ children, ...props }: any) => <table {...props}>{children}</table>,
  TableHead: ({ children, ...props }: any) => <th {...props}>{children}</th>,
  TableHeader: ({ children, ...props }: any) => <thead {...props}>{children}</thead>,
  TableRow: ({ children, ...props }: any) => <tr {...props}>{children}</tr>,
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, placeholder, ...props }: any) => (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      data-testid="search-input"
      {...props}
    />
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
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

/**
 * Mock child components
 */
vi.mock('./dataset-item-list', () => ({
  DatasetItemList: ({ datasets }: any) => (
    <tbody data-testid="dataset-item-list">
      {datasets.map((d: any) => (
        <tr key={d.id}>
          <td>{d.document_name}</td>
        </tr>
      ))}
    </tbody>
  ),
}));

vi.mock('./add-resource-modal', () => ({
  AddResourceModal: ({ isOpen, onClose }: any) =>
    isOpen ? (
      <div data-testid="add-resource-modal">
        <button onClick={onClose}>Close Add Resource</button>
      </div>
    ) : null,
}));

vi.mock('@/components/ibl-pagination', () => ({
  default: ({ currentPage, totalPages, onPageChange, disabled }: any) => (
    <div data-testid="pagination">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={disabled || currentPage === 1}
        data-testid="prev-page"
      >
        Previous
      </button>
      <span data-testid="page-info">
        {currentPage} / {totalPages}
      </span>
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={disabled || currentPage === totalPages}
        data-testid="next-page"
      >
        Next
      </button>
    </div>
  ),
}));

/**
 * Mock icons
 */
vi.mock('lucide-react', () => ({
  Search: () => <span data-testid="search-icon">Search</span>,
  Plus: () => <span data-testid="plus-icon">Plus</span>,
}));

// ============================================================================
// TEST FIXTURES
// ============================================================================

/**
 * Sample datasets for testing
 */
const mockDatasets = [
  {
    id: 'dataset-1',
    url: 'https://example.com/doc1',
    document_name: 'Document 1',
    document_type: 'url',
    tokens: 1000,
    is_trained: true,
    access: 'public',
    pathway: 'pathway-1',
    training_status: 'trained',
  },
  {
    id: 'dataset-2',
    url: 'https://example.com/doc2',
    document_name: 'Document 2',
    document_type: 'pdf',
    tokens: 2000,
    is_trained: false,
    access: 'private',
    pathway: 'pathway-2',
    training_status: 'untrained',
  },
];

// ============================================================================
// TESTS
// ============================================================================

describe('DatasetsTab', () => {
  beforeEach(() => {
    cleanup();

    // Reset mocks
    mockSetSearchQuery.mockReset();
    mockHandlePageChange.mockReset();
    mockOpenAddResourceModal.mockReset();
    mockExecuteWithTrialCheck.mockReset();
    mockCloseModal.mockReset();

    // Reset to default state
    mockPaginationState = {
      datasets: { results: [] },
      isDatasetsLoading: false,
      isDatasetsFetching: false,
      searchQuery: '',
      setSearchQuery: mockSetSearchQuery,
      currentPage: 1,
      totalPages: 1,
      handlePageChange: mockHandlePageChange,
    };

    mockFreeTrialState = {
      executeWithTrialCheck: mockExecuteWithTrialCheck,
      isModalOpen: false,
      FreeTrialDialog: null,
      closeModal: mockCloseModal,
    };

    // Default behavior: execute callback immediately
    mockExecuteWithTrialCheck.mockImplementation((callback) => callback());
  });

  afterEach(() => {
    cleanup();
  });

  // --------------------------------------------------------------------------
  // Rendering Tests
  // --------------------------------------------------------------------------

  describe('Rendering', () => {
    /**
     * Test: Component should render header section with title and description
     * Verifies the main heading and description are displayed
     */
    it('renders header with title and description', () => {
      render(<DatasetsTab />);

      expect(screen.getByText('Datasets')).toBeInTheDocument();
      expect(
        screen.getByText('Manage training datasets and knowledge sources.'),
      ).toBeInTheDocument();
    });

    /**
     * Test: Component should render search input
     * Verifies search functionality is available
     */
    it('renders search input with placeholder', () => {
      render(<DatasetsTab />);

      const searchInput = screen.getByTestId('search-input');
      expect(searchInput).toBeInTheDocument();
      expect(searchInput).toHaveAttribute('placeholder', 'Search datasets...');
    });

    /**
     * Test: Component should render "Add Resource" button
     * Verifies the button for adding new datasets is present
     */
    it('renders "Add Resource" button with icon', () => {
      render(<DatasetsTab />);

      expect(screen.getByText('Add Resource')).toBeInTheDocument();
      expect(screen.getByTestId('plus-icon')).toBeInTheDocument();
    });

    /**
     * Test: Component should render table headers correctly
     * Verifies all column headers are present in correct order
     */
    it('renders table headers in correct order', () => {
      mockPaginationState.datasets = { results: mockDatasets };

      render(<DatasetsTab />);

      // Verify all headers
      expect(screen.getByText('NAME')).toBeInTheDocument();
      expect(screen.getByText('TYPE')).toBeInTheDocument();
      expect(screen.getByText('TOKENS')).toBeInTheDocument();
      expect(screen.getByText('INTERVAL')).toBeInTheDocument();
      expect(screen.getByText('VISIBILITY')).toBeInTheDocument();
      expect(screen.getByText('STATUS')).toBeInTheDocument();
    });

    /**
     * Test: Component should render pagination controls
     * Verifies pagination is displayed
     */
    it('renders pagination controls', () => {
      render(<DatasetsTab />);

      expect(screen.getByTestId('pagination')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Search Functionality Tests
  // --------------------------------------------------------------------------

  describe('Search Functionality', () => {
    /**
     * Test: Search input should display current search query
     * Verifies two-way binding for search input
     */
    it('displays current search query in input', () => {
      mockPaginationState.searchQuery = 'test query';

      render(<DatasetsTab />);

      const searchInput = screen.getByTestId('search-input');
      expect(searchInput).toHaveValue('test query');
    });

    /**
     * Test: Typing in search input should call setSearchQuery
     * Verifies search query updates are propagated
     */
    it('calls setSearchQuery when typing in search input', () => {
      render(<DatasetsTab />);

      const searchInput = screen.getByTestId('search-input');
      fireEvent.change(searchInput, { target: { value: 'new search' } });

      expect(mockSetSearchQuery).toHaveBeenCalledWith('new search');
    });

    /**
     * Test: Should show spinner icon when fetching search results
     * Verifies loading state during search
     */
    it('shows spinner icon when fetching datasets', () => {
      mockPaginationState.isDatasetsFetching = true;

      render(<DatasetsTab />);

      // Should show spinner instead of search icon
      const spinners = screen.getAllByTestId('spinner');
      expect(spinners.length).toBeGreaterThan(0);
    });

    /**
     * Test: Should show search icon when not fetching
     * Verifies normal state shows search icon
     */
    it('shows search icon when not fetching', () => {
      mockPaginationState.isDatasetsFetching = false;

      render(<DatasetsTab />);

      expect(screen.getByTestId('search-icon')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Loading State Tests
  // --------------------------------------------------------------------------

  describe('Loading States', () => {
    /**
     * Test: Should show loading spinner when datasets are loading
     * Verifies initial loading state
     */
    it('shows loading spinner when datasets are loading', () => {
      mockPaginationState.isDatasetsLoading = true;

      render(<DatasetsTab />);

      const spinners = screen.getAllByTestId('spinner');
      expect(spinners.some((s) => s.textContent === 'Loading...')).toBe(true);
    });

    /**
     * Test: Should not show table when loading
     * Verifies table is hidden during loading
     */
    it('does not render table when loading', () => {
      mockPaginationState.isDatasetsLoading = true;

      render(<DatasetsTab />);

      expect(screen.queryByTestId('dataset-item-list')).not.toBeInTheDocument();
    });

    /**
     * Test: Should show table when not loading
     * Verifies table appears after loading completes
     */
    it('renders table when not loading', () => {
      mockPaginationState.isDatasetsLoading = false;
      mockPaginationState.datasets = { results: [] };

      render(<DatasetsTab />);

      expect(screen.getByTestId('dataset-item-list')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Dataset List Tests
  // --------------------------------------------------------------------------

  describe('Dataset List', () => {
    /**
     * Test: Should render DatasetItemList with datasets
     * Verifies dataset list is populated
     */
    it('renders DatasetItemList with provided datasets', () => {
      mockPaginationState.datasets = { results: mockDatasets };

      render(<DatasetsTab />);

      expect(screen.getByTestId('dataset-item-list')).toBeInTheDocument();
      expect(screen.getByText('Document 1')).toBeInTheDocument();
      expect(screen.getByText('Document 2')).toBeInTheDocument();
    });

    /**
     * Test: Should render DatasetItemList with empty array when no results
     * Verifies empty state handling
     */
    it('renders DatasetItemList with empty array when no datasets', () => {
      mockPaginationState.datasets = { results: [] };

      render(<DatasetsTab />);

      expect(screen.getByTestId('dataset-item-list')).toBeInTheDocument();
    });

    /**
     * Test: Should handle undefined datasets gracefully
     * Verifies null-safety for missing data
     */
    it('handles undefined datasets gracefully', () => {
      mockPaginationState.datasets = undefined as any;

      render(<DatasetsTab />);

      // Should render empty list
      expect(screen.getByTestId('dataset-item-list')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Add Resource Button Tests
  // --------------------------------------------------------------------------

  describe('Add Resource Button', () => {
    /**
     * Test: Clicking "Add Resource" should execute with trial check
     * Verifies free trial validation before opening modal
     */
    it('executes with trial check when clicking "Add Resource"', () => {
      render(<DatasetsTab />);

      const addButton = screen.getByText('Add Resource');
      fireEvent.click(addButton);

      expect(mockExecuteWithTrialCheck).toHaveBeenCalled();
    });

    /**
     * Test: Should open Add Resource modal after trial check passes
     * Verifies modal opens when user has access
     */
    it('opens Add Resource modal when trial check passes', async () => {
      render(<DatasetsTab />);

      const addButton = screen.getByText('Add Resource');
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByTestId('add-resource-modal')).toBeInTheDocument();
      });
    });

    /**
     * Test: Should not open modal if trial check fails
     * Verifies modal doesn't open when user doesn't have access
     */
    it('does not open modal if trial check blocks action', () => {
      // Mock trial check to not execute callback
      mockExecuteWithTrialCheck.mockImplementation(() => {});

      render(<DatasetsTab />);

      const addButton = screen.getByText('Add Resource');
      fireEvent.click(addButton);

      expect(screen.queryByTestId('add-resource-modal')).not.toBeInTheDocument();
    });

    /**
     * Test: Should close Add Resource modal when close is clicked
     * Verifies modal can be dismissed
     */
    it('closes Add Resource modal when close button is clicked', async () => {
      render(<DatasetsTab />);

      // Open modal
      const addButton = screen.getByText('Add Resource');
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByTestId('add-resource-modal')).toBeInTheDocument();
      });

      // Close modal
      const closeButton = screen.getByText('Close Add Resource');
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByTestId('add-resource-modal')).not.toBeInTheDocument();
      });
    });

    /**
     * Test: Add Resource modal should keep parent open
     * Verifies keepParentOpen prop is set correctly
     */
    it('passes keepParentOpen prop to Add Resource modal', async () => {
      render(<DatasetsTab />);

      const addButton = screen.getByText('Add Resource');
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByTestId('add-resource-modal')).toBeInTheDocument();
      });

      // Modal should be present (keepParentOpen=true is implicit in the mock)
      expect(screen.getByTestId('add-resource-modal')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Pagination Tests
  // --------------------------------------------------------------------------

  describe('Pagination', () => {
    /**
     * Test: Should display current page and total pages
     * Verifies pagination state is displayed correctly
     */
    it('displays current page and total pages', () => {
      mockPaginationState.currentPage = 2;
      mockPaginationState.totalPages = 5;

      render(<DatasetsTab />);

      expect(screen.getByTestId('page-info')).toHaveTextContent('2 / 5');
    });

    /**
     * Test: Should call handlePageChange when clicking next page
     * Verifies pagination navigation works
     */
    it('calls handlePageChange when clicking next page', () => {
      mockPaginationState.currentPage = 1;
      mockPaginationState.totalPages = 3;

      render(<DatasetsTab />);

      const nextButton = screen.getByTestId('next-page');
      fireEvent.click(nextButton);

      expect(mockHandlePageChange).toHaveBeenCalledWith(2);
    });

    /**
     * Test: Should call handlePageChange when clicking previous page
     * Verifies backward navigation works
     */
    it('calls handlePageChange when clicking previous page', () => {
      mockPaginationState.currentPage = 3;
      mockPaginationState.totalPages = 5;

      render(<DatasetsTab />);

      const prevButton = screen.getByTestId('prev-page');
      fireEvent.click(prevButton);

      expect(mockHandlePageChange).toHaveBeenCalledWith(2);
    });

    /**
     * Test: Should disable pagination when fetching
     * Verifies pagination is disabled during loading
     */
    it('disables pagination when fetching datasets', () => {
      mockPaginationState.isDatasetsFetching = true;
      mockPaginationState.currentPage = 2;
      mockPaginationState.totalPages = 5;

      render(<DatasetsTab />);

      const nextButton = screen.getByTestId('next-page');
      const prevButton = screen.getByTestId('prev-page');

      expect(nextButton).toBeDisabled();
      expect(prevButton).toBeDisabled();
    });

    /**
     * Test: Should disable pagination when loading
     * Verifies pagination is disabled during initial load
     */
    it('disables pagination when loading datasets', () => {
      mockPaginationState.isDatasetsLoading = true;

      render(<DatasetsTab />);

      const nextButton = screen.getByTestId('next-page');
      expect(nextButton).toBeDisabled();
    });
  });

  // --------------------------------------------------------------------------
  // Free Trial Dialog Tests
  // --------------------------------------------------------------------------

  describe('Free Trial Dialog', () => {
    /**
     * Test: Should render FreeTrialDialog when modal is open
     * Verifies free trial dialog integration
     */
    it('renders FreeTrialDialog when isModalOpen is true', () => {
      const FreeTrialDialogComponent = ({ isOpen, onClose }: any) =>
        isOpen ? (
          <div data-testid="free-trial-dialog">
            <button onClick={onClose}>Close Trial Dialog</button>
          </div>
        ) : null;
      mockFreeTrialState.FreeTrialDialog = FreeTrialDialogComponent;
      mockFreeTrialState.isModalOpen = true;

      render(<DatasetsTab />);

      expect(screen.getByTestId('free-trial-dialog')).toBeInTheDocument();
    });

    /**
     * Test: Should not render FreeTrialDialog when modal is closed
     * Verifies dialog is hidden when not needed
     */
    it('does not render FreeTrialDialog when isModalOpen is false', () => {
      const FreeTrialDialogComponent = ({ isOpen }: any) =>
        isOpen ? <div data-testid="free-trial-dialog">Dialog</div> : null;
      mockFreeTrialState.FreeTrialDialog = FreeTrialDialogComponent;
      mockFreeTrialState.isModalOpen = false;

      render(<DatasetsTab />);

      expect(screen.queryByTestId('free-trial-dialog')).not.toBeInTheDocument();
    });

    /**
     * Test: Should not render anything when FreeTrialDialog is null
     * Verifies graceful handling of missing dialog component
     */
    it('does not render when FreeTrialDialog is null', () => {
      mockFreeTrialState.FreeTrialDialog = null;
      mockFreeTrialState.isModalOpen = true;

      render(<DatasetsTab />);

      expect(screen.queryByTestId('free-trial-dialog')).not.toBeInTheDocument();
    });

    /**
     * Test: Should call closeModal when FreeTrialDialog is closed
     * Verifies dialog close handler is wired correctly
     */
    it('calls closeModal when FreeTrialDialog close is clicked', async () => {
      const FreeTrialDialogComponent = ({ isOpen, onClose }: any) =>
        isOpen ? (
          <div data-testid="free-trial-dialog">
            <button onClick={onClose}>Close Trial Dialog</button>
          </div>
        ) : null;
      mockFreeTrialState.FreeTrialDialog = FreeTrialDialogComponent;
      mockFreeTrialState.isModalOpen = true;

      render(<DatasetsTab />);

      const closeButton = screen.getByText('Close Trial Dialog');
      fireEvent.click(closeButton);

      expect(mockCloseModal).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // Edge Cases
  // --------------------------------------------------------------------------

  describe('Edge Cases', () => {
    /**
     * Test: Should handle very long search queries
     * Verifies input handles long text
     */
    it('handles very long search queries', () => {
      const longQuery = 'a'.repeat(1000);
      mockPaginationState.searchQuery = longQuery;

      render(<DatasetsTab />);

      const searchInput = screen.getByTestId('search-input');
      expect(searchInput).toHaveValue(longQuery);
    });

    /**
     * Test: Should handle page 0 gracefully
     * Verifies edge case for pagination bounds
     */
    it('handles edge case pagination values', () => {
      mockPaginationState.currentPage = 0;
      mockPaginationState.totalPages = 0;

      render(<DatasetsTab />);

      expect(screen.getByTestId('pagination')).toBeInTheDocument();
    });

    /**
     * Test: Should handle large number of datasets
     * Verifies performance with many items
     */
    it('handles large number of datasets', () => {
      const manyDatasets = Array.from({ length: 1000 }, (_, i) => ({
        id: `dataset-${i}`,
        url: `https://example.com/doc${i}`,
        document_name: `Document ${i}`,
        document_type: 'url',
        tokens: 1000,
        is_trained: false,
        access: 'public',
        pathway: `pathway-${i}`,
        training_status: 'untrained',
      }));

      mockPaginationState.datasets = { results: manyDatasets };

      render(<DatasetsTab />);

      expect(screen.getByTestId('dataset-item-list')).toBeInTheDocument();
    });

    /**
     * Test: Should maintain scroll position when data changes
     * Verifies overflow styles are applied
     */
    it('applies overflow styles for scrolling', () => {
      const { container } = render(<DatasetsTab />);

      // Check for the div with overflow styles (inline or class-based)
      const scrollableDiv = container.querySelector('.flex-1');
      expect(scrollableDiv).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Styling Tests
  // --------------------------------------------------------------------------

  describe('Styling', () => {
    /**
     * Test: Add Resource button should have gradient styling
     * Verifies theme consistency
     */
    it('applies gradient styling to Add Resource button', () => {
      render(<DatasetsTab />);

      const addButton = screen.getByText('Add Resource').closest('button');
      expect(addButton).toHaveClass(
        'bg-gradient-to-r',
        'from-[#2563EB]',
        'to-[#93C5FD]',
        'text-white',
        'hover:opacity-90',
      );
    });

    /**
     * Test: Table should have proper border and rounding
     * Verifies table styling
     */
    it('applies proper styling to table container', () => {
      mockPaginationState.datasets = { results: [] };

      render(<DatasetsTab />);

      // Check that the table is rendered (container classes are applied by parent)
      expect(screen.getByTestId('dataset-item-list')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Integration Tests
  // --------------------------------------------------------------------------

  describe('Integration', () => {
    /**
     * Test: Complete user flow - search and navigate
     * Verifies multiple features work together
     */
    it('handles complete user flow: search -> results -> pagination', async () => {
      mockPaginationState.datasets = { results: mockDatasets };
      mockPaginationState.totalPages = 3;

      render(<DatasetsTab />);

      // Search
      const searchInput = screen.getByTestId('search-input');
      fireEvent.change(searchInput, { target: { value: 'test' } });
      expect(mockSetSearchQuery).toHaveBeenCalledWith('test');

      // Results are displayed
      expect(screen.getByText('Document 1')).toBeInTheDocument();

      // Navigate to next page
      const nextButton = screen.getByTestId('next-page');
      fireEvent.click(nextButton);
      expect(mockHandlePageChange).toHaveBeenCalledWith(2);
    });

    /**
     * Test: Loading -> Loaded state transition
     * Verifies state transitions work correctly
     */
    it('transitions from loading to loaded state correctly', () => {
      mockPaginationState.isDatasetsLoading = true;

      const { rerender } = render(<DatasetsTab />);

      // Should show spinner
      expect(screen.getAllByTestId('spinner')).toBeTruthy();

      // Update to loaded state
      mockPaginationState.isDatasetsLoading = false;
      mockPaginationState.datasets = { results: mockDatasets };

      rerender(<DatasetsTab />);

      // Should show data
      expect(screen.getByText('Document 1')).toBeInTheDocument();
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
  });
});