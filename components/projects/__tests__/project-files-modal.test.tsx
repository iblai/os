import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectFilesModal } from '../project-files-modal';

// Mock the datasets hook
const mockSetSearchQuery = vi.fn();
const mockHandlePageChange = vi.fn();
let mockDatasetsState: any = {
  datasets: { results: [{ id: '1' }, { id: '2' }], count: 12 },
  isDatasetsLoading: false,
  isDatasetsFetching: false,
  searchQuery: '',
  setSearchQuery: mockSetSearchQuery,
  currentPage: 1,
  totalPages: 3,
  handlePageChange: mockHandlePageChange,
};
vi.mock('@/hooks/use-datasets', () => ({
  useDatasetsWithPagination: () => mockDatasetsState,
}));

// Mock the free trial dialog hook
const mockExecuteWithTrialCheck = vi.fn((cb: () => void) => cb());
const mockCloseModal = vi.fn();
let mockTrialState: any = {
  executeWithTrialCheck: mockExecuteWithTrialCheck,
  isModalOpen: false,
  FreeTrialDialog: null,
  closeModal: mockCloseModal,
};
vi.mock('@/hooks/user-user-actions', () => ({
  useShowFreeTrialDialog: () => mockTrialState,
}));

// Light stubs for heavy child components
vi.mock(
  '@/components/modals/edit-mentor-modal/tabs/datasets-tab/dataset-item-list',
  () => ({
    DatasetItemList: ({ datasets }: { datasets: any[] }) => (
      <tbody data-testid="dataset-item-list">
        <tr>
          <td>{datasets.length} datasets</td>
        </tr>
      </tbody>
    ),
  }),
);

vi.mock(
  '@/components/modals/edit-mentor-modal/tabs/datasets-tab/add-resource-modal',
  () => ({
    AddResourceModal: ({
      isOpen,
      onClose,
    }: {
      isOpen: boolean;
      onClose: () => void;
    }) => (
      <div data-testid="add-resource-modal">
        <button data-testid="close-add-resource" onClick={onClose}>
          close add resource
        </button>
        {isOpen ? 'add-resource-open' : 'add-resource-closed'}
      </div>
    ),
  }),
);

let lastPaginationProps: any = null;
vi.mock('@/components/ibl-pagination', () => ({
  default: (props: any) => {
    lastPaginationProps = props;
    return (
      <div data-testid="pagination">
        <button
          data-testid="page-change"
          disabled={props.disabled}
          onClick={() => props.onPageChange(2)}
        >
          page {props.currentPage} of {props.totalPages}
        </button>
      </div>
    );
  },
}));

vi.mock('@/components/spinner', () => ({
  Spinner: ({ className }: { className?: string }) => (
    <div data-testid="spinner" className={className}>
      spinner
    </div>
  ),
}));

describe('ProjectFilesModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    lastPaginationProps = null;
    mockDatasetsState = {
      datasets: { results: [{ id: '1' }, { id: '2' }], count: 12 },
      isDatasetsLoading: false,
      isDatasetsFetching: false,
      searchQuery: '',
      setSearchQuery: mockSetSearchQuery,
      currentPage: 1,
      totalPages: 3,
      handlePageChange: mockHandlePageChange,
    };
    mockTrialState = {
      executeWithTrialCheck: mockExecuteWithTrialCheck,
      isModalOpen: false,
      FreeTrialDialog: null,
      closeModal: mockCloseModal,
    };
  });

  describe('rendering', () => {
    it('renders dialog with title and column headers', () => {
      render(<ProjectFilesModal {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Project Files')).toBeInTheDocument();
      expect(screen.getByText('NAME')).toBeInTheDocument();
      expect(screen.getByText('TYPE')).toBeInTheDocument();
      expect(screen.getByText('TOKENS')).toBeInTheDocument();
      expect(screen.getByText('INTERVAL')).toBeInTheDocument();
      expect(screen.getByText('VISIBILITY')).toBeInTheDocument();
      expect(screen.getByText('STATUS')).toBeInTheDocument();
    });

    it('renders the dataset list with results when loaded', () => {
      render(<ProjectFilesModal {...defaultProps} />);

      expect(screen.getByTestId('dataset-item-list')).toBeInTheDocument();
      expect(screen.getByText('2 datasets')).toBeInTheDocument();
    });

    it('renders Add Files button and pagination', () => {
      render(<ProjectFilesModal {...defaultProps} />);

      expect(
        screen.getByRole('button', { name: /Add Files/ }),
      ).toBeInTheDocument();
      expect(screen.getByTestId('pagination')).toBeInTheDocument();
      expect(lastPaginationProps.currentPage).toBe(1);
      expect(lastPaginationProps.totalPages).toBe(3);
    });

    it('renders the search input', () => {
      render(<ProjectFilesModal {...defaultProps} />);

      expect(
        screen.getByPlaceholderText('Search datasets...'),
      ).toBeInTheDocument();
    });

    it('renders empty dataset list when datasets is undefined', () => {
      mockDatasetsState.datasets = undefined;
      render(<ProjectFilesModal {...defaultProps} />);

      expect(screen.getByText('0 datasets')).toBeInTheDocument();
    });
  });

  describe('loading and fetching states', () => {
    it('shows table spinner while datasets are loading', () => {
      mockDatasetsState.isDatasetsLoading = true;
      render(<ProjectFilesModal {...defaultProps} />);

      expect(screen.getByTestId('spinner')).toBeInTheDocument();
      expect(screen.queryByTestId('dataset-item-list')).not.toBeInTheDocument();
    });

    it('shows search spinner while fetching', () => {
      mockDatasetsState.isDatasetsFetching = true;
      render(<ProjectFilesModal {...defaultProps} />);

      // The fetching spinner appears next to the search input
      expect(screen.getByTestId('spinner')).toBeInTheDocument();
    });

    it('disables pagination while fetching', () => {
      mockDatasetsState.isDatasetsFetching = true;
      render(<ProjectFilesModal {...defaultProps} />);

      expect(lastPaginationProps.disabled).toBe(true);
    });
  });

  describe('search interaction', () => {
    it('calls setSearchQuery when typing in the search box', () => {
      render(<ProjectFilesModal {...defaultProps} />);

      fireEvent.change(screen.getByPlaceholderText('Search datasets...'), {
        target: { value: 'hello' },
      });
      expect(mockSetSearchQuery).toHaveBeenCalledWith('hello');
    });
  });

  describe('pagination interaction', () => {
    it('calls handlePageChange when paginating', () => {
      render(<ProjectFilesModal {...defaultProps} />);

      fireEvent.click(screen.getByTestId('page-change'));
      expect(mockHandlePageChange).toHaveBeenCalledWith(2);
    });
  });

  describe('add resource flow', () => {
    it('opens the add resource modal via trial check when Add Files clicked', () => {
      render(<ProjectFilesModal {...defaultProps} />);

      expect(screen.getByText('add-resource-closed')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Add Files/ }));

      expect(mockExecuteWithTrialCheck).toHaveBeenCalled();
      expect(screen.getByText('add-resource-open')).toBeInTheDocument();
    });

    it('does not open the add resource modal when trial check blocks it', () => {
      mockTrialState.executeWithTrialCheck = vi.fn(); // does not invoke callback
      render(<ProjectFilesModal {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Add Files/ }));

      expect(screen.getByText('add-resource-closed')).toBeInTheDocument();
    });

    it('closes the add resource modal via its onClose', () => {
      render(<ProjectFilesModal {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Add Files/ }));
      expect(screen.getByText('add-resource-open')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('close-add-resource'));
      expect(screen.getByText('add-resource-closed')).toBeInTheDocument();
    });
  });

  describe('free trial dialog', () => {
    it('does not render FreeTrialDialog when modal closed or component missing', () => {
      render(<ProjectFilesModal {...defaultProps} />);

      expect(screen.queryByTestId('free-trial-dialog')).not.toBeInTheDocument();
    });

    it('renders FreeTrialDialog when open and component provided', () => {
      const FreeTrialDialog = ({
        isOpen,
        onClose,
      }: {
        isOpen: boolean;
        onClose: () => void;
      }) => (
        <div data-testid="free-trial-dialog">
          <button onClick={onClose}>close trial</button>
          {isOpen ? 'trial-open' : 'trial-closed'}
        </div>
      );
      mockTrialState.isModalOpen = true;
      mockTrialState.FreeTrialDialog = FreeTrialDialog;

      render(<ProjectFilesModal {...defaultProps} />);

      expect(screen.getByTestId('free-trial-dialog')).toBeInTheDocument();
      expect(screen.getByText('trial-open')).toBeInTheDocument();

      fireEvent.click(screen.getByText('close trial'));
      expect(mockCloseModal).toHaveBeenCalled();
    });

    it('does not render FreeTrialDialog when modal open but component is null', () => {
      mockTrialState.isModalOpen = true;
      mockTrialState.FreeTrialDialog = null;

      render(<ProjectFilesModal {...defaultProps} />);

      expect(screen.queryByTestId('free-trial-dialog')).not.toBeInTheDocument();
    });
  });
});
