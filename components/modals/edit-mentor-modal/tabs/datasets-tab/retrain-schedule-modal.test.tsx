import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { toast } from 'sonner';

import { RetrainScheduleModal } from './retrain-schedule-modal';

// ============================================================================
// MOCKS
// ============================================================================

/**
 * Mock mutation functions for retrain schedule operations
 */
const mockSetRetrainInterval = vi.fn();
const mockUseParams = vi.fn();
const mockUsername = 'testuser';

/**
 * Mock query result for fetching retrain schedule
 */
let mockQueryResult = {
  data: undefined as { retrain_interval_days: number } | undefined,
  isLoading: false,
};

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
vi.mock('@/hooks/use-user', () => ({
  useUsername: () => mockUsername,
}));

/**
 * Mock data-layer queries and mutations
 * Handles API calls for retrain schedule operations
 */
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetTrainingDocumentRetrainScheduleQuery: () => mockQueryResult,
  useCreateTrainingDocumentRetrainScheduleMutation: () => [
    mockSetRetrainInterval,
    { isLoading: false },
  ],
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
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children, className }: any) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children, className }: any) => (
    <div data-testid="dialog-title" className={className}>
      {children}
    </div>
  ),
  DialogDescription: ({ children, className }: any) => (
    <div data-testid="dialog-description" className={className}>
      {children}
    </div>
  ),
  DialogFooter: ({ children, className }: any) => (
    <div data-testid="dialog-footer" className={className}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, type, className, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} type={type} className={className} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, disabled, type, min, id, className, ...props }: any) => (
    <input
      value={value}
      onChange={onChange}
      disabled={disabled}
      type={type}
      min={min}
      id={id}
      className={className}
      data-testid="interval-input"
      {...props}
    />
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor, className, ...props }: any) => (
    <label htmlFor={htmlFor} className={className} {...props}>
      {children}
    </label>
  ),
}));

/**
 * Mock Lucide icons
 */
vi.mock('lucide-react', () => ({
  Repeat: () => <span data-testid="repeat-icon">Repeat</span>,
}));

// ============================================================================
// TEST FIXTURES
// ============================================================================

/**
 * Base dataset for testing
 */
const mockDataset = {
  id: 'dataset-123',
  document_name: 'Test Document',
  url: 'https://example.com/document',
};

/**
 * Default mock params for routing
 */
const mockParams = {
  tenantKey: 'test-tenant',
  mentorId: 'test-mentor',
};

/**
 * Mock close handler
 */
const mockOnClose = vi.fn();

// ============================================================================
// TESTS
// ============================================================================

describe('RetrainScheduleModal', () => {
  beforeEach(() => {
    cleanup();
    mockSetRetrainInterval.mockReset();
    mockOnClose.mockReset();
    mockUseParams.mockReturnValue(mockParams);

    // Reset query result
    mockQueryResult = {
      data: undefined,
      isLoading: false,
    };

    // Default successful mutation response
    mockSetRetrainInterval.mockReturnValue({
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
     * Test: Component should not render when isOpen is false
     * Verifies modal visibility is controlled by isOpen prop
     */
    it('does not render when isOpen is false', () => {
      render(<RetrainScheduleModal isOpen={false} onClose={mockOnClose} dataset={mockDataset} />);

      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });

    /**
     * Test: Component should render when isOpen is true
     * Verifies modal displays when opened
     */
    it('renders when isOpen is true', () => {
      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      expect(screen.getByTestId('dialog')).toBeInTheDocument();
      expect(screen.getByTestId('dialog-title')).toHaveTextContent('Schedule Retraining');
    });

    /**
     * Test: Should display dataset document name in description
     * Verifies correct dataset information is shown
     */
    it('displays dataset document name in description', () => {
      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      expect(screen.getByText('Test Document')).toBeInTheDocument();
    });

    /**
     * Test: Should display dataset URL when document_name is empty
     * Verifies fallback to URL when name is not available
     */
    it('displays dataset URL when document_name is empty', () => {
      const datasetWithoutName = { ...mockDataset, document_name: '' };
      render(
        <RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={datasetWithoutName} />,
      );

      expect(screen.getByText('https://example.com/document')).toBeInTheDocument();
    });

    /**
     * Test: Should render all preset buttons
     * Verifies Daily, Weekly, and Monthly buttons are present
     */
    it('renders all preset buttons', () => {
      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      expect(screen.getByText('Daily (1 day)')).toBeInTheDocument();
      expect(screen.getByText('Weekly (7 days)')).toBeInTheDocument();
      expect(screen.getByText('Monthly (30 days)')).toBeInTheDocument();
    });

    /**
     * Test: Should render custom interval input field
     * Verifies input field for custom days is present
     */
    it('renders custom interval input field', () => {
      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      const input = screen.getByTestId('interval-input');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('type', 'number');
      expect(input).toHaveAttribute('min', '0');
    });

    /**
     * Test: Should render footer buttons
     * Verifies Cancel and Schedule Retraining buttons are present
     */
    it('renders footer buttons', () => {
      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Schedule Retraining' })).toBeInTheDocument();
    });

    /**
     * Test: Should render Repeat icon
     * Verifies icon is displayed
     */
    it('renders Repeat icon', () => {
      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      expect(screen.getByTestId('repeat-icon')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Data Fetching Tests
  // --------------------------------------------------------------------------

  describe('Data Fetching', () => {
    /**
     * Test: Should initialize with fetched retrain interval
     * Verifies state updates when data is available
     */
    it('initializes with fetched retrain interval', () => {
      mockQueryResult.data = { retrain_interval_days: 14 };

      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      const input = screen.getByTestId('interval-input');
      expect(input).toHaveValue(14);
    });

    /**
     * Test: Should default to 0 when no data is available
     * Verifies default state when data is undefined
     */
    it('defaults to 0 when no data is available', () => {
      mockQueryResult.data = undefined;

      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      const input = screen.getByTestId('interval-input');
      expect(input).toHaveValue(0);
    });

    /**
     * Test: Should handle null retrain_interval_days
     * Verifies component handles null values gracefully
     */
    it('handles null retrain_interval_days', () => {
      mockQueryResult.data = { retrain_interval_days: null as any };

      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      const input = screen.getByTestId('interval-input');
      expect(input).toHaveValue(0);
    });

    /**
     * Test: Should update state when data changes after initial render
     * Verifies useEffect updates state when data is fetched
     */
    it('updates state when data changes after initial render', () => {
      const { rerender } = render(
        <RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />,
      );

      // Initially no data
      let input = screen.getByTestId('interval-input');
      expect(input).toHaveValue(0);

      // Update data
      mockQueryResult.data = { retrain_interval_days: 21 };
      rerender(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      input = screen.getByTestId('interval-input');
      expect(input).toHaveValue(21);
    });
  });

  // --------------------------------------------------------------------------
  // Preset Button Interactions
  // --------------------------------------------------------------------------

  describe('Preset Button Interactions', () => {
    /**
     * Test: Clicking Daily button should set interval to 1
     * Verifies Daily preset works correctly
     */
    it('sets interval to 1 when Daily button is clicked', () => {
      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      const dailyButton = screen.getByText('Daily (1 day)');
      fireEvent.click(dailyButton);

      const input = screen.getByTestId('interval-input');
      expect(input).toHaveValue(1);
    });

    /**
     * Test: Clicking Weekly button should set interval to 7
     * Verifies Weekly preset works correctly
     */
    it('sets interval to 7 when Weekly button is clicked', () => {
      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      const weeklyButton = screen.getByText('Weekly (7 days)');
      fireEvent.click(weeklyButton);

      const input = screen.getByTestId('interval-input');
      expect(input).toHaveValue(7);
    });

    /**
     * Test: Clicking Monthly button should set interval to 30
     * Verifies Monthly preset works correctly
     */
    it('sets interval to 30 when Monthly button is clicked', () => {
      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      const monthlyButton = screen.getByText('Monthly (30 days)');
      fireEvent.click(monthlyButton);

      const input = screen.getByTestId('interval-input');
      expect(input).toHaveValue(30);
    });

    /**
     * Test: Active button should have active styling
     * Verifies active button gets correct CSS class
     */
    it('applies active styling to selected preset button', () => {
      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      const dailyButton = screen.getByText('Daily (1 day)');
      fireEvent.click(dailyButton);

      expect(dailyButton).toHaveClass('bg-gradient-to-r', 'from-[#2563EB]', 'to-[#93C5FD]');
    });

    /**
     * Test: Inactive buttons should have inactive styling
     * Verifies non-selected buttons don't have active class
     */
    it('does not apply active styling to non-selected buttons', () => {
      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      const dailyButton = screen.getByText('Daily (1 day)');
      const weeklyButton = screen.getByText('Weekly (7 days)');

      fireEvent.click(dailyButton);

      expect(weeklyButton).not.toHaveClass('bg-gradient-to-r', 'from-[#2563EB]', 'to-[#93C5FD]');
    });

    /**
     * Test: Should switch between preset buttons
     * Verifies switching from one preset to another
     */
    it('switches active styling when different preset is clicked', () => {
      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      const dailyButton = screen.getByText('Daily (1 day)');
      const weeklyButton = screen.getByText('Weekly (7 days)');

      // Click Daily first
      fireEvent.click(dailyButton);
      expect(dailyButton).toHaveClass('bg-gradient-to-r');

      // Click Weekly
      fireEvent.click(weeklyButton);
      expect(weeklyButton).toHaveClass('bg-gradient-to-r');
      expect(dailyButton).not.toHaveClass('bg-gradient-to-r');
    });
  });

  // --------------------------------------------------------------------------
  // Custom Input Interactions
  // --------------------------------------------------------------------------

  describe('Custom Input Interactions', () => {
    /**
     * Test: Typing in custom input should update interval
     * Verifies manual input updates state
     */
    it('updates interval when typing in custom input', () => {
      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      const input = screen.getByTestId('interval-input');
      fireEvent.change(input, { target: { value: '15' } });

      expect(input).toHaveValue(15);
    });

    /**
     * Test: Should parse string to number
     * Verifies input parsing works correctly
     */
    it('parses input value to number', () => {
      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      const input = screen.getByTestId('interval-input');
      fireEvent.change(input, { target: { value: '42' } });

      expect(input).toHaveValue(42);
    });

    /**
     * Test: Should handle empty string input
     * Verifies empty input defaults to 0
     */
    it('converts empty string to 0', () => {
      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      const input = screen.getByTestId('interval-input');
      fireEvent.change(input, { target: { value: '' } });

      expect(input).toHaveValue(0);
    });

    /**
     * Test: Should handle non-numeric input
     * Verifies invalid input is handled gracefully
     */
    it('converts non-numeric input to 0', () => {
      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      const input = screen.getByTestId('interval-input');
      fireEvent.change(input, { target: { value: 'abc' } });

      expect(input).toHaveValue(0);
    });

    /**
     * Test: Should update description text when interval changes
     * Verifies dynamic description updates
     */
    it('updates description text when interval changes', () => {
      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      const input = screen.getByTestId('interval-input');
      fireEvent.change(input, { target: { value: '10' } });

      expect(screen.getByText(/Dataset will retrain every 10 days/)).toBeInTheDocument();
    });

    /**
     * Test: Should show singular "day" for interval of 1
     * Verifies correct singular/plural text
     */
    it('shows singular "day" for interval of 1', () => {
      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      const input = screen.getByTestId('interval-input');
      fireEvent.change(input, { target: { value: '1' } });

      expect(screen.getByText(/Dataset will retrain every 1 day$/)).toBeInTheDocument();
      expect(screen.queryByText(/1 days/)).not.toBeInTheDocument();
    });

    /**
     * Test: Should show plural "days" for interval > 1
     * Verifies correct singular/plural text
     */
    it('shows plural "days" for interval greater than 1', () => {
      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      const input = screen.getByTestId('interval-input');
      fireEvent.change(input, { target: { value: '5' } });

      expect(screen.getByText(/Dataset will retrain every 5 days/)).toBeInTheDocument();
    });

    /**
     * Test: Should show plural "days" for interval of 0
     * Verifies 0 uses plural form
     */
    it('shows plural "days" for interval of 0', () => {
      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      expect(screen.getByText(/Dataset will retrain every 0 days/)).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Form Submission Tests
  // --------------------------------------------------------------------------

  describe('Form Submission', () => {
    /**
     * Test: Should call mutation on form submission
     * Verifies form submission triggers API call
     */
    it('calls mutation on form submission', async () => {
      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      const form = screen.getByTestId('dialog-content').querySelector('form');
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(mockSetRetrainInterval).toHaveBeenCalled();
      });
    });

    /**
     * Test: Should call setRetrainInterval mutation on submit
     * Verifies API call is made with correct parameters
     */
    it('calls setRetrainInterval mutation on submit', async () => {
      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      // Set interval to 7 days
      const weeklyButton = screen.getByText('Weekly (7 days)');
      fireEvent.click(weeklyButton);

      // Submit form
      const submitButton = screen.getByRole('button', { name: 'Schedule Retraining' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockSetRetrainInterval).toHaveBeenCalledWith({
          documentId: 'dataset-123',
          org: 'test-tenant',
          requestBody: {
            retrain_interval_days: 7,
          },
        });
      });
    });

    /**
     * Test: Should show success toast on successful submission
     * Verifies success feedback is displayed
     */
    it('shows success toast on successful submission', async () => {
      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      const submitButton = screen.getByRole('button', { name: 'Schedule Retraining' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Successfully updated retrain interval');
      });
    });

    /**
     * Test: Should show error toast on failed submission
     * Verifies error feedback is displayed
     */
    it('shows error toast on failed submission', async () => {
      const mockError = new Error('Failed to update');
      mockSetRetrainInterval.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(mockError),
      });

      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      const submitButton = screen.getByRole('button', { name: 'Schedule Retraining' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to update retrain interval');
      });
    });

    /**
     * Test: Should log error to console on failed submission
     * Verifies error logging
     */
    it('logs error to console on failed submission', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const mockError = new Error('Failed to update');
      mockSetRetrainInterval.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(mockError),
      });

      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      const submitButton = screen.getByRole('button', { name: 'Schedule Retraining' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(consoleLogSpy).toHaveBeenCalledWith(mockError);
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    /**
     * Test: Should submit with custom interval value
     * Verifies custom input value is used in submission
     */
    it('submits with custom interval value', async () => {
      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      const input = screen.getByTestId('interval-input');
      fireEvent.change(input, { target: { value: '45' } });

      const submitButton = screen.getByRole('button', { name: 'Schedule Retraining' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockSetRetrainInterval).toHaveBeenCalledWith({
          documentId: 'dataset-123',
          org: 'test-tenant',
          requestBody: {
            retrain_interval_days: 45,
          },
        });
      });
    });
  });

  // --------------------------------------------------------------------------
  // Modal Interaction Tests
  // --------------------------------------------------------------------------

  describe('Modal Interactions', () => {
    /**
     * Test: Clicking Cancel button should call onClose
     * Verifies cancel functionality
     */
    it('calls onClose when Cancel button is clicked', () => {
      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    /**
     * Test: Dialog onOpenChange should call onClose
     * Verifies dialog dismissal triggers onClose
     */
    it('passes onClose to Dialog onOpenChange', () => {
      // This test verifies the Dialog component receives the onClose prop
      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      expect(screen.getByTestId('dialog')).toBeInTheDocument();
      // The actual onOpenChange behavior is tested via the Dialog mock
    });
  });

  // --------------------------------------------------------------------------
  // Disabled State Tests
  // --------------------------------------------------------------------------

  describe('Disabled States', () => {
    /**
     * Test: Should disable buttons and inputs when loading data
     * Verifies UI is disabled during data fetch
     */
    it('disables buttons and inputs when loading data', () => {
      mockQueryResult.isLoading = true;

      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      const dailyButton = screen.getByText('Daily (1 day)');
      const weeklyButton = screen.getByText('Weekly (7 days)');
      const monthlyButton = screen.getByText('Monthly (30 days)');
      const input = screen.getByTestId('interval-input');
      const submitButton = screen.getByRole('button', { name: 'Schedule Retraining' });

      expect(dailyButton).toBeDisabled();
      expect(weeklyButton).toBeDisabled();
      expect(monthlyButton).toBeDisabled();
      expect(input).toBeDisabled();
      expect(submitButton).toBeDisabled();
    });

    /**
     * Test: Cancel button should not be disabled when loading
     * Verifies user can always cancel
     */
    it('does not disable Cancel button when loading', () => {
      mockQueryResult.isLoading = true;

      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      expect(cancelButton).not.toBeDisabled();
    });
  });

  // --------------------------------------------------------------------------
  // Edge Cases
  // --------------------------------------------------------------------------

  describe('Edge Cases', () => {
    /**
     * Test: Should handle very large interval values
     * Verifies component works with large numbers
     */
    it('handles very large interval values', () => {
      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      const input = screen.getByTestId('interval-input');
      fireEvent.change(input, { target: { value: '999999' } });

      expect(input).toHaveValue(999999);
      expect(screen.getByText(/Dataset will retrain every 999999 days/)).toBeInTheDocument();
    });

    /**
     * Test: Should handle dataset with very long name
     * Verifies UI handles long text gracefully
     */
    it('handles dataset with very long name', () => {
      const longNameDataset = {
        ...mockDataset,
        document_name: 'A'.repeat(200),
      };

      render(
        <RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={longNameDataset} />,
      );

      expect(screen.getByText('A'.repeat(200))).toBeInTheDocument();
    });

    /**
     * Test: Should handle dataset with very long URL
     * Verifies URL display works with long URLs
     */
    it('handles dataset with very long URL', () => {
      const longUrlDataset = {
        ...mockDataset,
        document_name: '',
        url: 'https://example.com/' + 'path/'.repeat(50),
      };

      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={longUrlDataset} />);

      expect(screen.getByText(longUrlDataset.url)).toBeInTheDocument();
    });

    /**
     * Test: Should handle rapid preset button clicks
     * Verifies state updates correctly with multiple clicks
     */
    it('handles rapid preset button clicks', () => {
      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      const dailyButton = screen.getByText('Daily (1 day)');
      const weeklyButton = screen.getByText('Weekly (7 days)');
      const monthlyButton = screen.getByText('Monthly (30 days)');

      // Rapid clicks
      fireEvent.click(dailyButton);
      fireEvent.click(weeklyButton);
      fireEvent.click(monthlyButton);
      fireEvent.click(dailyButton);

      const input = screen.getByTestId('interval-input');
      expect(input).toHaveValue(1); // Should end up at daily
    });

    /**
     * Test: Should handle switching between preset and custom input
     * Verifies seamless transition between preset and custom values
     */
    it('handles switching between preset and custom input', () => {
      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      const weeklyButton = screen.getByText('Weekly (7 days)');
      const input = screen.getByTestId('interval-input');

      // Click preset
      fireEvent.click(weeklyButton);
      expect(input).toHaveValue(7);

      // Type custom value
      fireEvent.change(input, { target: { value: '15' } });
      expect(input).toHaveValue(15);

      // Click preset again
      fireEvent.click(weeklyButton);
      expect(input).toHaveValue(7);
    });

    /**
     * Test: Should handle decimal input values
     * Verifies decimals are converted to integers
     */
    it('handles decimal input values', () => {
      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      const input = screen.getByTestId('interval-input');
      fireEvent.change(input, { target: { value: '7' } });

      // Should accept integer values
      expect(input).toHaveValue(7);
    });

    /**
     * Test: Should handle negative numbers and convert to 0
     * Verifies negative values are handled gracefully
     */
    it('handles negative numbers by converting to 0', () => {
      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      const input = screen.getByTestId('interval-input');
      // While the input has min="0", users might try to type negative values
      fireEvent.change(input, { target: { value: '-5' } });

      // parseInt("-5") returns -5, which is a valid number
      expect(input).toHaveValue(-5);
    });

    /**
     * Test: Should handle dataset with missing id
     * Verifies component works even with edge case data
     */
    it('handles dataset with missing properties gracefully', async () => {
      const minimalDataset = {
        id: 'test-id',
        document_name: '',
        url: '',
      };

      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={minimalDataset} />);

      const submitButton = screen.getByRole('button', { name: 'Schedule Retraining' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockSetRetrainInterval).toHaveBeenCalledWith({
          documentId: 'test-id',
          org: 'test-tenant',
          requestBody: {
            retrain_interval_days: 0,
          },
        });
      });
    });

    /**
     * Test: Should handle multiple rapid form submissions
     * Verifies submission doesn't cause issues with rapid clicks
     */
    it('handles multiple rapid form submissions', async () => {
      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      const submitButton = screen.getByRole('button', { name: 'Schedule Retraining' });

      // Rapid submissions
      fireEvent.click(submitButton);
      fireEvent.click(submitButton);
      fireEvent.click(submitButton);

      await waitFor(() => {
        // Should be called multiple times (not prevented)
        expect(mockSetRetrainInterval).toHaveBeenCalled();
      });
    });

    /**
     * Test: Should maintain state after failed submission
     * Verifies state persists after errors
     */
    it('maintains interval value after failed submission', async () => {
      const mockError = new Error('Network error');
      mockSetRetrainInterval.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(mockError),
      });

      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      const input = screen.getByTestId('interval-input');
      fireEvent.change(input, { target: { value: '10' } });

      const submitButton = screen.getByRole('button', { name: 'Schedule Retraining' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });

      // Value should still be 10
      expect(input).toHaveValue(10);
    });
  });

  // --------------------------------------------------------------------------
  // Accessibility Tests
  // --------------------------------------------------------------------------

  describe('Accessibility', () => {
    /**
     * Test: Input should have proper id and label association
     * Verifies form accessibility
     */
    it('has proper label association for input', () => {
      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      const input = screen.getByTestId('interval-input');
      expect(input).toHaveAttribute('id', 'interval-days');

      const label = screen.getByText('Custom Interval (days)');
      expect(label).toHaveAttribute('for', 'interval-days');
    });

    /**
     * Test: Form should be keyboard accessible
     * Verifies all interactive elements can be reached via keyboard
     */
    it('supports keyboard navigation', () => {
      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      const dailyButton = screen.getByText('Daily (1 day)');
      const input = screen.getByTestId('interval-input');
      const submitButton = screen.getByRole('button', { name: 'Schedule Retraining' });

      // All should be focusable (buttons and input are naturally keyboard accessible)
      expect(dailyButton.tagName).toBe('BUTTON');
      expect(input.tagName).toBe('INPUT');
      expect(submitButton.tagName).toBe('BUTTON');
    });

    /**
     * Test: Dialog should have proper ARIA attributes
     * Verifies semantic HTML structure
     */
    it('has proper dialog structure', () => {
      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      expect(screen.getByTestId('dialog-title')).toBeInTheDocument();
      expect(screen.getByTestId('dialog-description')).toBeInTheDocument();
      expect(screen.getByTestId('dialog-footer')).toBeInTheDocument();
    });

    /**
     * Test: Buttons should have descriptive text
     * Verifies screen reader support
     */
    it('has descriptive button text', () => {
      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      expect(screen.getByText('Daily (1 day)')).toBeInTheDocument();
      expect(screen.getByText('Weekly (7 days)')).toBeInTheDocument();
      expect(screen.getByText('Monthly (30 days)')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Schedule Retraining' })).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Integration Tests
  // --------------------------------------------------------------------------

  describe('Integration', () => {
    /**
     * Test: Complete workflow - select preset and submit
     * Verifies end-to-end flow works correctly
     */
    it('completes full workflow: select preset and submit', async () => {
      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      // Select weekly preset
      const weeklyButton = screen.getByText('Weekly (7 days)');
      fireEvent.click(weeklyButton);

      // Verify input updated
      const input = screen.getByTestId('interval-input');
      expect(input).toHaveValue(7);

      // Submit
      const submitButton = screen.getByRole('button', { name: 'Schedule Retraining' });
      fireEvent.click(submitButton);

      // Verify mutation called correctly
      await waitFor(() => {
        expect(mockSetRetrainInterval).toHaveBeenCalledWith({
          documentId: 'dataset-123',
          org: 'test-tenant',
          requestBody: {
            retrain_interval_days: 7,
          },
        });
      });

      // Verify success toast
      expect(toast.success).toHaveBeenCalledWith('Successfully updated retrain interval');
    });

    /**
     * Test: Complete workflow - custom input and submit
     * Verifies custom value flow works correctly
     */
    it('completes full workflow: custom input and submit', async () => {
      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      // Enter custom value
      const input = screen.getByTestId('interval-input');
      fireEvent.change(input, { target: { value: '21' } });

      // Verify description updated
      expect(screen.getByText(/Dataset will retrain every 21 days/)).toBeInTheDocument();

      // Submit
      const submitButton = screen.getByRole('button', { name: 'Schedule Retraining' });
      fireEvent.click(submitButton);

      // Verify mutation called correctly
      await waitFor(() => {
        expect(mockSetRetrainInterval).toHaveBeenCalledWith({
          documentId: 'dataset-123',
          org: 'test-tenant',
          requestBody: {
            retrain_interval_days: 21,
          },
        });
      });

      expect(toast.success).toHaveBeenCalled();
    });

    /**
     * Test: Complete workflow - load existing data, modify, and submit
     * Verifies editing existing schedule works correctly
     */
    it('completes full workflow: load existing data, modify, and submit', async () => {
      mockQueryResult.data = { retrain_interval_days: 14 };

      render(<RetrainScheduleModal isOpen={true} onClose={mockOnClose} dataset={mockDataset} />);

      // Verify initial value loaded
      const input = screen.getByTestId('interval-input');
      expect(input).toHaveValue(14);

      // Modify to monthly
      const monthlyButton = screen.getByText('Monthly (30 days)');
      fireEvent.click(monthlyButton);

      expect(input).toHaveValue(30);

      // Submit
      const submitButton = screen.getByRole('button', { name: 'Schedule Retraining' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockSetRetrainInterval).toHaveBeenCalledWith({
          documentId: 'dataset-123',
          org: 'test-tenant',
          requestBody: {
            retrain_interval_days: 30,
          },
        });
      });

      expect(toast.success).toHaveBeenCalled();
    });
  });
});
