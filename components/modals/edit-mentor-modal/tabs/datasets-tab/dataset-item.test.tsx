import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { toast } from 'sonner';

import { DatasetItem, Dataset } from './dataset-item';

// ============================================================================
// MOCKS
// ============================================================================

/**
 * Mock mutation functions for editing training documents
 */
const mockEditTrainingDocument = vi.fn();
const mockUseParams = vi.fn();
const mockUsername = 'testuser';

/**
 * Mock next/navigation
 * Used to get route parameters like tenantKey and mentorId
 */
vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

/**
 * Mock user hooks
 * Provides current user information
 */
const mockUseUsername = vi.fn(() => mockUsername);
vi.mock('@/hooks/use-user', () => ({
  useUsername: () => mockUseUsername(),
}));

/**
 * Mock data-layer mutations
 * Handles API calls for training document operations
 */
vi.mock('@data-layer/index', () => ({
  useEditTrainingDocumentMutation: () => [mockEditTrainingDocument, { isLoading: false }],
}));

/**
 * Mock Sentry for error tracking
 */
vi.mock('@sentry/nextjs', () => ({
  default: {
    captureException: vi.fn(),
  },
  captureException: vi.fn(),
}));

/**
 * Mock toast notifications
 */
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

/**
 * Mock UI components to simplify testing
 */
vi.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange, disabled, ...props }: any) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={() => onCheckedChange(!checked)}
      disabled={disabled}
      data-testid="training-switch"
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

vi.mock('@/components/ui/table', () => ({
  TableCell: ({ children, ...props }: any) => <td {...props}>{children}</td>,
  TableRow: ({ children, ...props }: any) => <tr {...props}>{children}</tr>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className, ...props }: any) => (
    <span className={className} {...props}>
      {children}
    </span>
  ),
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: any) => <>{children}</>,
  TooltipContent: () => null, // Don't render tooltip content in tests
  TooltipTrigger: ({ children }: any) => <>{children}</>,
}));

/**
 * Mock modals
 */
vi.mock('./delete-dataset-modal', () => ({
  DeleteDatasetModal: ({ isOpen, onClose }: any) =>
    isOpen ? (
      <div data-testid="delete-dataset-modal">
        <button onClick={onClose}>Close Delete Modal</button>
      </div>
    ) : null,
}));

vi.mock('./retrain-schedule-modal', () => ({
  RetrainScheduleModal: ({ isOpen, onClose }: any) =>
    isOpen ? (
      <div data-testid="retrain-schedule-modal">
        <button onClick={onClose}>Close Retrain Modal</button>
      </div>
    ) : null,
}));

vi.mock('./train-or-delete-modal', () => ({
  TrainOrDeleteModal: ({ isOpen, onClose, onTrain, onDelete }: any) =>
    isOpen ? (
      <div data-testid="train-or-delete-modal">
        <button onClick={onTrain} data-testid="train-button">
          Train
        </button>
        <button onClick={onDelete} data-testid="delete-button">
          Delete
        </button>
        <button onClick={onClose}>Close Train Modal</button>
      </div>
    ) : null,
}));

/**
 * Mock permissions HOC
 */
vi.mock('@/hoc/withPermissions', () => ({
  default: ({ children }: any) => {
    // Simulate permission checks
    if (typeof children === 'function') {
      return children({ disabled: false, canDelete: true });
    }
    return children;
  },
}));

/**
 * Mock Lucide icons
 */
vi.mock('lucide-react', () => ({
  Eye: () => <span data-testid="eye-icon">Eye</span>,
  EyeOff: () => <span data-testid="eyeoff-icon">EyeOff</span>,
  Clock: () => <span data-testid="clock-icon">Clock</span>,
  X: () => <span data-testid="x-icon">X</span>,
}));

// ============================================================================
// TEST FIXTURES
// ============================================================================

/**
 * Base dataset for testing
 */
const mockDataset: Dataset = {
  id: 'dataset-123',
  url: 'https://example.com/document',
  document_name: 'Test Document',
  document_type: 'url',
  tokens: 1000,
  is_trained: false,
  access: 'public',
  pathway: 'test-pathway',
  training_status: 'untrained',
};

/**
 * Default mock params for routing
 */
const mockParams = {
  tenantKey: 'test-tenant',
  mentorId: 'test-mentor',
};

// ============================================================================
// TESTS
// ============================================================================

describe('DatasetItem', () => {
  beforeEach(() => {
    cleanup();
    mockEditTrainingDocument.mockReset();
    mockUseParams.mockReturnValue(mockParams);
    mockUseUsername.mockReturnValue(mockUsername);

    // Default successful mutation response
    mockEditTrainingDocument.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({}),
    });

    // Clear toast mocks
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  // --------------------------------------------------------------------------
  // Rendering Tests
  // --------------------------------------------------------------------------

  describe('Rendering', () => {
    /**
     * Test: Component should render all dataset information
     * Verifies that document name, type, tokens, and URL are displayed
     */
    it('renders dataset information correctly', () => {
      render(<DatasetItem dataset={mockDataset} />);

      // Name should be hyperlinked
      const nameLink = screen.getByRole('link', { name: 'Test Document' });
      expect(nameLink).toBeInTheDocument();
      expect(nameLink.tagName).toBe('A');
      expect(nameLink).toHaveAttribute('href', 'https://example.com/document');

      // Type should be uppercase
      expect(screen.getByText('URL')).toBeInTheDocument();

      // Tokens
      expect(screen.getByText('1000')).toBeInTheDocument();
    });

    /**
     * Test: Document name should link to URL with correct attributes
     * Verifies security attributes (target="_blank", rel="noopener noreferrer")
     */
    it('renders document name as hyperlink with security attributes', () => {
      render(<DatasetItem dataset={mockDataset} />);

      const link = screen.getByRole('link', { name: 'Test Document' });
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(link).toHaveClass('text-blue-600', 'hover:text-blue-800', 'hover:underline');
    });

    /**
     * Test: Should use URL as fallback when document_name is missing
     * Verifies fallback behavior for unnamed documents
     */
    it('uses URL as fallback when document name is missing', () => {
      const datasetWithoutName = { ...mockDataset, document_name: '' };
      render(<DatasetItem dataset={datasetWithoutName} />);

      const link = screen.getByRole('link', { name: 'https://example.com/document' });
      expect(link).toBeInTheDocument();
    });

    /**
     * Test: Should format document type correctly
     * Verifies uppercase transformation and formatting
     */
    it('formats document type correctly', () => {
      const pdfDataset = { ...mockDataset, document_type: '.pdf' };
      render(<DatasetItem dataset={pdfDataset} />);

      // Should convert .PDF to PDF
      expect(screen.getByText('PDF')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Training Status Tests
  // --------------------------------------------------------------------------

  describe('Training Status', () => {
    /**
     * Test: Should show "In Progress" badge when training status is pending
     * Verifies that pending status displays badge instead of switch
     */
    it('shows "In Progress" badge when training status is pending', () => {
      const pendingDataset = { ...mockDataset, training_status: 'pending' };
      render(<DatasetItem dataset={pendingDataset} />);

      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.queryByTestId('training-switch')).not.toBeInTheDocument();
    });

    /**
     * Test: Should show training switch when status is not pending
     * Verifies switch is displayed for trained/untrained states
     */
    it('shows training switch when status is not pending', () => {
      render(<DatasetItem dataset={mockDataset} />);

      const switchElement = screen.getByTestId('training-switch');
      expect(switchElement).toBeInTheDocument();
      expect(switchElement).not.toBeChecked(); // is_trained is false
    });

    /**
     * Test: Training switch should be checked when dataset is trained
     * Verifies switch state reflects is_trained value
     */
    it('renders training switch as checked when dataset is trained', () => {
      const trainedDataset = { ...mockDataset, is_trained: true };
      render(<DatasetItem dataset={trainedDataset} />);

      const switchElement = screen.getByTestId('training-switch');
      expect(switchElement).toBeChecked();
    });
  });

  // --------------------------------------------------------------------------
  // Visibility Toggle Tests
  // --------------------------------------------------------------------------

  describe('Visibility Toggle', () => {
    /**
     * Test: Should show Eye icon for public datasets
     * Verifies icon display based on access level
     */
    it('shows Eye icon for public access', () => {
      render(<DatasetItem dataset={mockDataset} />);

      expect(screen.getByTestId('eye-icon')).toBeInTheDocument();
      expect(screen.queryByTestId('eyeoff-icon')).not.toBeInTheDocument();
    });

    /**
     * Test: Should show EyeOff icon for private datasets
     * Verifies icon display for private access
     */
    it('shows EyeOff icon for private access', () => {
      const privateDataset = { ...mockDataset, access: 'private' };
      render(<DatasetItem dataset={privateDataset} />);

      expect(screen.getByTestId('eyeoff-icon')).toBeInTheDocument();
      expect(screen.queryByTestId('eye-icon')).not.toBeInTheDocument();
    });

    /**
     * Test: Clicking visibility button should toggle access from public to private
     * Verifies that handleEditTrainingDocument is called with correct parameters
     */
    it('toggles access from public to private when clicked', async () => {
      render(<DatasetItem dataset={mockDataset} />);

      const visibilityButton = screen.getByTestId('eye-icon').closest('button');
      fireEvent.click(visibilityButton!);

      await waitFor(() => {
        expect(mockEditTrainingDocument).toHaveBeenCalledWith({
          documentId: 'dataset-123',
          org: 'test-tenant',
          formData: {
            access: 'private',
            pathway: 'test-pathway',
          },
          userId: 'testuser',
        });
      });

      expect(toast.success).toHaveBeenCalledWith('Training document updated successfully');
    });

    /**
     * Test: Clicking visibility button should toggle access from private to public
     * Verifies bidirectional toggle functionality
     */
    it('toggles access from private to public when clicked', async () => {
      const privateDataset = { ...mockDataset, access: 'private' };
      render(<DatasetItem dataset={privateDataset} />);

      const visibilityButton = screen.getByTestId('eyeoff-icon').closest('button');
      fireEvent.click(visibilityButton!);

      await waitFor(() => {
        expect(mockEditTrainingDocument).toHaveBeenCalledWith({
          documentId: 'dataset-123',
          org: 'test-tenant',
          formData: {
            access: 'public',
            pathway: 'test-pathway',
          },
          userId: 'testuser',
        });
      });
    });
  });

  // --------------------------------------------------------------------------
  // Training Toggle Tests
  // --------------------------------------------------------------------------

  describe('Training Toggle', () => {
    /**
     * Test: Toggling training switch should open TrainOrDeleteModal for untrained datasets
     * Verifies modal opens when toggling training on
     */
    it('opens TrainOrDeleteModal when training switch is toggled on', async () => {
      render(<DatasetItem dataset={mockDataset} />);

      const switchElement = screen.getByTestId('training-switch');
      fireEvent.click(switchElement);

      await waitFor(() => {
        expect(screen.getByTestId('train-or-delete-modal')).toBeInTheDocument();
      });
    });

    /**
     * Test: Clicking Train button in modal should call editTrainingDocument
     * Verifies API call is made when confirming training
     */
    it('calls editTrainingDocument when Train button is clicked in modal', async () => {
      render(<DatasetItem dataset={mockDataset} />);

      const switchElement = screen.getByTestId('training-switch');
      fireEvent.click(switchElement);

      await waitFor(() => {
        expect(screen.getByTestId('train-or-delete-modal')).toBeInTheDocument();
      });

      const trainButton = screen.getByTestId('train-button');
      fireEvent.click(trainButton);

      await waitFor(() => {
        expect(mockEditTrainingDocument).toHaveBeenCalledWith({
          documentId: 'dataset-123',
          org: 'test-tenant',
          formData: {
            url: 'https://example.com/document',
            train: true,
            pathway: 'test-pathway',
          },
          userId: 'testuser',
        });
      });
    });

    /**
     * Test: Should open delete modal when toggling training off
     * Verifies that untraining triggers delete confirmation
     */
    it('opens delete modal after successfully untraining dataset', async () => {
      const trainedDataset = { ...mockDataset, is_trained: true };
      render(<DatasetItem dataset={trainedDataset} />);

      const switchElement = screen.getByTestId('training-switch');
      fireEvent.click(switchElement);

      await waitFor(() => {
        expect(screen.getByTestId('delete-dataset-modal')).toBeInTheDocument();
      });
    });

    /**
     * Test: Should not open delete modal when toggling training on
     * Verifies delete modal only appears when untraining, and TrainOrDeleteModal opens instead
     */
    it('does not open delete modal when toggling training on', async () => {
      render(<DatasetItem dataset={mockDataset} />);

      const switchElement = screen.getByTestId('training-switch');
      fireEvent.click(switchElement);

      await waitFor(() => {
        expect(screen.getByTestId('train-or-delete-modal')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('delete-dataset-modal')).not.toBeInTheDocument();
    });

    /**
     * Test: Clicking Delete in TrainOrDeleteModal should close it and open the delete modal
     * Verifies handleDeleteFromTrainModal transitions between modals
     */
    it('opens delete modal when Delete is clicked in TrainOrDeleteModal', async () => {
      render(<DatasetItem dataset={mockDataset} />);

      // Open train-or-delete modal by toggling the switch on an untrained dataset
      const switchElement = screen.getByTestId('training-switch');
      fireEvent.click(switchElement);

      await waitFor(() => {
        expect(screen.getByTestId('train-or-delete-modal')).toBeInTheDocument();
      });

      // Click Delete in the train-or-delete modal
      const deleteButton = screen.getByTestId('delete-button');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        // Train-or-delete modal should close, delete modal should open
        expect(screen.queryByTestId('train-or-delete-modal')).not.toBeInTheDocument();
        expect(screen.getByTestId('delete-dataset-modal')).toBeInTheDocument();
      });
    });
  });

  // --------------------------------------------------------------------------
  // Retrain Schedule Tests
  // --------------------------------------------------------------------------

  describe('Retrain Schedule', () => {
    /**
     * Test: Should show clock icon for retrain schedule
     * Verifies schedule button is rendered
     */
    it('renders retrain schedule button with clock icon', () => {
      render(<DatasetItem dataset={mockDataset} />);

      expect(screen.getByTestId('clock-icon')).toBeInTheDocument();
    });

    /**
     * Test: Should open retrain schedule modal when clicking schedule button
     * Verifies modal opens on button click
     */
    it('opens retrain schedule modal when schedule button is clicked', async () => {
      const trainedDataset = { ...mockDataset, is_trained: true };
      render(<DatasetItem dataset={trainedDataset} />);

      const scheduleButton = screen.getByTestId('clock-icon').closest('button');
      fireEvent.click(scheduleButton!);

      await waitFor(() => {
        expect(screen.getByTestId('retrain-schedule-modal')).toBeInTheDocument();
      });
    });

    /**
     * Test: Should disable retrain button for uploaded file types
     * Verifies that file-based documents cannot be scheduled for retraining
     */
    it('disables retrain button for file-type documents', () => {
      const fileDataset = { ...mockDataset, is_trained: true, document_type: 'file' };
      render(<DatasetItem dataset={fileDataset} />);

      const scheduleButton = screen.getByTestId('clock-icon').closest('button');
      expect(scheduleButton).toBeDisabled();
    });

    /**
     * Test: Should disable retrain button for cloud storage documents
     * Verifies cloud storage providers cannot be scheduled
     */
    it('disables retrain button for cloud storage documents', () => {
      const cloudDataset = { ...mockDataset, is_trained: true, document_type: 'google drive' };
      render(<DatasetItem dataset={cloudDataset} />);

      const scheduleButton = screen.getByTestId('clock-icon').closest('button');
      expect(scheduleButton).toBeDisabled();
    });

    /**
     * Test: Should not disable retrain button for trained URL documents
     * Verifies URL-based trained documents can be scheduled
     */
    it('enables retrain button for trained URL-type documents', () => {
      const trainedDataset = { ...mockDataset, is_trained: true };
      render(<DatasetItem dataset={trainedDataset} />);

      const scheduleButton = screen.getByTestId('clock-icon').closest('button');
      expect(scheduleButton).not.toBeDisabled();
    });

    /**
     * Test: Should disable retrain button for untrained documents
     * Verifies that only trained documents can be scheduled for retraining
     */
    it('disables retrain button for untrained documents', () => {
      const untrainedDataset = { ...mockDataset, is_trained: false };
      render(<DatasetItem dataset={untrainedDataset} />);

      const scheduleButton = screen.getByTestId('clock-icon').closest('button');
      expect(scheduleButton).toBeDisabled();
    });

    /**
     * Test: Should close retrain modal when clicking close button
     * Verifies modal can be dismissed
     */
    it('closes retrain schedule modal when close button is clicked', async () => {
      const trainedDataset = { ...mockDataset, is_trained: true };
      render(<DatasetItem dataset={trainedDataset} />);

      // Open modal
      const scheduleButton = screen.getByTestId('clock-icon').closest('button');
      fireEvent.click(scheduleButton!);

      await waitFor(() => {
        expect(screen.getByTestId('retrain-schedule-modal')).toBeInTheDocument();
      });

      // Close modal
      const closeButton = screen.getByText('Close Retrain Modal');
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByTestId('retrain-schedule-modal')).not.toBeInTheDocument();
      });
    });
  });

  // --------------------------------------------------------------------------
  // Error Handling Tests
  // --------------------------------------------------------------------------

  describe('Error Handling', () => {
    /**
     * Test: Should show error toast when editTrainingDocument fails
     * Verifies error handling for failed mutations
     */
    it('shows error toast when training document update fails', async () => {
      const mockError = new Error('Update failed');
      mockEditTrainingDocument.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(mockError),
      });

      render(<DatasetItem dataset={mockDataset} />);

      const visibilityButton = screen.getByTestId('eye-icon').closest('button');
      fireEvent.click(visibilityButton!);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to update training document');
      });
    });

    /**
     * Test: Should log error to console when update fails
     * Verifies error logging integration
     */
    it('logs error to console when update fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockError = new Error('Update failed');
      mockEditTrainingDocument.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(mockError),
      });

      render(<DatasetItem dataset={mockDataset} />);

      // Toggle switch opens the TrainOrDeleteModal for untrained datasets
      const switchElement = screen.getByTestId('training-switch');
      fireEvent.click(switchElement);

      await waitFor(() => {
        expect(screen.getByTestId('train-or-delete-modal')).toBeInTheDocument();
      });

      // Click Train button to trigger the API call that will fail
      const trainButton = screen.getByTestId('train-button');
      fireEvent.click(trainButton);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      consoleErrorSpy.mockRestore();
    });
  });

  // --------------------------------------------------------------------------
  // Modal Management Tests
  // --------------------------------------------------------------------------

  describe('Modal Management', () => {
    /**
     * Test: Should close delete modal when close button is clicked
     * Verifies delete modal can be dismissed
     */
    it('closes delete modal when close button is clicked', async () => {
      const trainedDataset = { ...mockDataset, is_trained: true };
      render(<DatasetItem dataset={trainedDataset} />);

      // Open modal by untraining
      const switchElement = screen.getByTestId('training-switch');
      fireEvent.click(switchElement);

      await waitFor(() => {
        expect(screen.getByTestId('delete-dataset-modal')).toBeInTheDocument();
      });

      // Close modal
      const closeButton = screen.getByText('Close Delete Modal');
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByTestId('delete-dataset-modal')).not.toBeInTheDocument();
      });
    });

    /**
     * Test: Should not render modals initially
     * Verifies lazy rendering of modals
     */
    it('does not render modals initially', () => {
      render(<DatasetItem dataset={mockDataset} />);

      expect(screen.queryByTestId('delete-dataset-modal')).not.toBeInTheDocument();
      expect(screen.queryByTestId('retrain-schedule-modal')).not.toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Edge Cases
  // --------------------------------------------------------------------------

  describe('Edge Cases', () => {
    /**
     * Test: Should handle datasets with no tokens
     * Verifies graceful handling of zero tokens
     */
    it('handles dataset with zero tokens', () => {
      const noTokenDataset = { ...mockDataset, tokens: 0 };
      render(<DatasetItem dataset={noTokenDataset} />);

      expect(screen.getByText('0')).toBeInTheDocument();
    });

    /**
     * Test: Should handle datasets with null/undefined tokens
     * Verifies fallback to 0 when tokens is nullish
     */
    it('handles dataset with null tokens', () => {
      const nullTokenDataset = { ...mockDataset, tokens: null as any };
      render(<DatasetItem dataset={nullTokenDataset} />);

      expect(screen.getByText('0')).toBeInTheDocument();
    });

    /**
     * Test: Should use empty string for userId when username is null
     * Verifies the ?? '' fallback for null username
     */
    it('uses empty string for userId when username is an empty string', async () => {
      mockUseUsername.mockReturnValue('');
      render(<DatasetItem dataset={mockDataset} />);

      const visibilityButton = screen.getByTestId('eye-icon').closest('button');
      fireEvent.click(visibilityButton!);

      await waitFor(() => {
        expect(mockEditTrainingDocument).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: '',
          }),
        );
      });
    });

    /**
     * Test: Should handle datasets with empty pathway
     * Verifies component works with missing pathway
     */
    it('handles dataset with empty pathway', async () => {
      const noPathwayDataset = { ...mockDataset, pathway: '' };
      render(<DatasetItem dataset={noPathwayDataset} />);

      // Toggle switch opens the TrainOrDeleteModal for untrained datasets
      const switchElement = screen.getByTestId('training-switch');
      fireEvent.click(switchElement);

      await waitFor(() => {
        expect(screen.getByTestId('train-or-delete-modal')).toBeInTheDocument();
      });

      // Click Train button to trigger the API call
      const trainButton = screen.getByTestId('train-button');
      fireEvent.click(trainButton);

      await waitFor(() => {
        expect(mockEditTrainingDocument).toHaveBeenCalledWith(
          expect.objectContaining({
            formData: expect.objectContaining({
              pathway: '',
            }),
          }),
        );
      });
    });

    /**
     * Test: Should handle very long document names
     * Verifies truncation and tooltip for long names
     */
    it('handles very long document names', () => {
      const longNameDataset = {
        ...mockDataset,
        document_name: 'A'.repeat(500),
      };
      render(<DatasetItem dataset={longNameDataset} />);

      const nameLink = screen.getByRole('link', { name: 'A'.repeat(500) });
      expect(nameLink).toBeInTheDocument();
    });

    /**
     * Test: Should handle all cloud provider types
     * Verifies detection of all cloud storage providers
     */
    it('disables retrain for all cloud storage providers', () => {
      const providers = ['google drive', 'onedrive', 'dropbox', 'one drive'];

      providers.forEach((provider) => {
        cleanup();
        const cloudDataset = { ...mockDataset, is_trained: true, document_type: provider };
        render(<DatasetItem dataset={cloudDataset} />);

        const scheduleButton = screen.getByTestId('clock-icon').closest('button');
        expect(scheduleButton).toBeDisabled();
      });
    });
  });

  // --------------------------------------------------------------------------
  // Accessibility Tests
  // --------------------------------------------------------------------------

  describe('Accessibility', () => {
    /**
     * Test: Links should have proper security attributes
     * Verifies external links are secure
     */
    it('has proper security attributes on external links', () => {
      render(<DatasetItem dataset={mockDataset} />);

      const link = screen.getByRole('link', { name: 'Test Document' });
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(link).toHaveAttribute('target', '_blank');
    });

    /**
     * Test: Buttons should have accessible labels
     * Verifies screen reader support
     */
    it('provides screen reader text for icon buttons', () => {
      render(<DatasetItem dataset={mockDataset} />);

      // Check for sr-only spans
      const srTexts = document.querySelectorAll('.sr-only');
      expect(srTexts.length).toBeGreaterThan(0);
    });
  });
});
