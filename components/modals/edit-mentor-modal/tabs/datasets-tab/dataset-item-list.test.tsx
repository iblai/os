import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { DatasetItemList } from './dataset-item-list';
import type { Dataset } from './dataset-item';

// ============================================================================
// MOCKS
// ============================================================================

/**
 * Mock the DatasetItem component to avoid testing its internal logic
 * We just need to verify that it renders with the correct props
 */
vi.mock('./dataset-item', () => ({
  DatasetItem: ({ dataset }: { dataset: Dataset }) => (
    <tr data-testid={`dataset-item-${dataset.id}`}>
      <td>{dataset.document_name}</td>
    </tr>
  ),
}));

/**
 * Mock UI table components
 */
vi.mock('@/components/ui/table', () => ({
  TableBody: ({ children }: { children: React.ReactNode }) => (
    <tbody data-testid="table-body">{children}</tbody>
  ),
  TableCell: ({ children, ...props }: any) => <td {...props}>{children}</td>,
  TableRow: ({ children, ...props }: any) => <tr {...props}>{children}</tr>,
}));

// ============================================================================
// TEST FIXTURES
// ============================================================================

/**
 * Sample dataset data for testing
 */
const mockDatasets: Dataset[] = [
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
  {
    id: 'dataset-3',
    url: 'https://example.com/doc3',
    document_name: 'Document 3',
    document_type: 'url',
    tokens: 1500,
    is_trained: false,
    access: 'public',
    pathway: 'pathway-3',
    training_status: 'pending',
  },
];

// ============================================================================
// TESTS
// ============================================================================

describe('DatasetItemList', () => {
  // --------------------------------------------------------------------------
  // Rendering Tests
  // --------------------------------------------------------------------------

  describe('Rendering with datasets', () => {
    /**
     * Test: Component should render a TableBody wrapper
     * Verifies that the component uses the correct table structure
     */
    it('renders TableBody wrapper', () => {
      render(<DatasetItemList datasets={mockDatasets} />);

      expect(screen.getByTestId('table-body')).toBeInTheDocument();
    });

    /**
     * Test: Component should render all provided datasets
     * Verifies that each dataset in the array results in a DatasetItem
     */
    it('renders all datasets when provided', () => {
      render(<DatasetItemList datasets={mockDatasets} />);

      // Check that each dataset is rendered
      expect(screen.getByTestId('dataset-item-dataset-1')).toBeInTheDocument();
      expect(screen.getByTestId('dataset-item-dataset-2')).toBeInTheDocument();
      expect(screen.getByTestId('dataset-item-dataset-3')).toBeInTheDocument();
    });

    /**
     * Test: Component should render correct number of DatasetItems
     * Verifies that no extra items are rendered
     */
    it('renders the correct number of DatasetItems', () => {
      render(<DatasetItemList datasets={mockDatasets} />);

      const datasetItems = screen.getAllByTestId(/^dataset-item-/);
      expect(datasetItems).toHaveLength(mockDatasets.length);
    });

    /**
     * Test: Each DatasetItem should have a unique key
     * Verifies that the key prop is set correctly (dataset.id)
     * Note: Keys are not directly testable, but we can verify unique IDs
     */
    it('renders each dataset with unique identifier', () => {
      render(<DatasetItemList datasets={mockDatasets} />);

      const items = screen.getAllByTestId(/^dataset-item-/);
      const ids = items.map((item) => item.getAttribute('data-testid'));
      const uniqueIds = new Set(ids);

      // All IDs should be unique
      expect(uniqueIds.size).toBe(items.length);
    });
  });

  // --------------------------------------------------------------------------
  // Empty State Tests
  // --------------------------------------------------------------------------

  describe('Empty state', () => {
    /**
     * Test: Should show "No datasets found" when array is empty
     * Verifies the empty state message for empty arrays
     */
    it('displays "No datasets found" message when datasets array is empty', () => {
      render(<DatasetItemList datasets={[]} />);

      expect(screen.getByText('No datasets found')).toBeInTheDocument();
    });

    /**
     * Test: Empty message should span correct number of columns
     * Verifies that the colSpan is set correctly (6 columns)
     */
    it('renders empty message with correct colspan', () => {
      const { container } = render(<DatasetItemList datasets={[]} />);

      const emptyCell = container.querySelector('td[colspan="6"]');
      expect(emptyCell).toBeInTheDocument();
      expect(emptyCell).toHaveTextContent('No datasets found');
    });

    /**
     * Test: Empty message should be centered
     * Verifies that styling classes are applied for centered text
     */
    it('applies correct styling classes to empty state', () => {
      const { container } = render(<DatasetItemList datasets={[]} />);

      const emptyCell = container.querySelector('td');
      expect(emptyCell).toHaveClass('p-4', 'text-center', 'text-[#646464]');
    });

    /**
     * Test: Should not render DatasetItems when array is empty
     * Verifies no dataset items are rendered in empty state
     */
    it('does not render any DatasetItems when datasets is empty', () => {
      render(<DatasetItemList datasets={[]} />);

      const datasetItems = screen.queryAllByTestId(/^dataset-item-/);
      expect(datasetItems).toHaveLength(0);
    });
  });

  // --------------------------------------------------------------------------
  // Edge Cases
  // --------------------------------------------------------------------------

  describe('Edge cases', () => {
    /**
     * Test: Should handle single dataset correctly
     * Verifies that the component works with minimal data
     */
    it('handles single dataset in array', () => {
      const singleDataset = [mockDatasets[0]];
      render(<DatasetItemList datasets={singleDataset} />);

      expect(screen.getByTestId('dataset-item-dataset-1')).toBeInTheDocument();
      expect(screen.queryByText('No datasets found')).not.toBeInTheDocument();
    });

    /**
     * Test: Should handle large dataset arrays
     * Verifies performance with many items
     */
    it('handles large number of datasets', () => {
      // Create 100 mock datasets
      const manyDatasets: Dataset[] = Array.from({ length: 100 }, (_, i) => ({
        id: `dataset-${i}`,
        url: `https://example.com/doc${i}`,
        document_name: `Document ${i}`,
        document_type: 'url',
        tokens: 1000,
        is_trained: i % 2 === 0,
        access: 'public',
        pathway: `pathway-${i}`,
        training_status: 'trained',
      }));

      render(<DatasetItemList datasets={manyDatasets} />);

      const datasetItems = screen.getAllByTestId(/^dataset-item-/);
      expect(datasetItems).toHaveLength(100);
    });

    /**
     * Test: Should handle datasets with minimal required fields
     * Verifies component doesn't break with sparse data
     */
    it('handles datasets with minimal fields', () => {
      const minimalDatasets: Dataset[] = [
        {
          id: 'minimal-1',
          url: 'https://example.com',
          document_name: 'Minimal',
          document_type: 'url',
          tokens: 0,
          is_trained: false,
          access: 'public',
          pathway: '',
          training_status: 'untrained',
        },
      ];

      render(<DatasetItemList datasets={minimalDatasets} />);

      expect(screen.getByTestId('dataset-item-minimal-1')).toBeInTheDocument();
    });

    /**
     * Test: Should preserve dataset order
     * Verifies that datasets are rendered in the order provided
     */
    it('maintains order of datasets as provided', () => {
      render(<DatasetItemList datasets={mockDatasets} />);

      const datasetItems = screen.getAllByTestId(/^dataset-item-/);

      // Verify order matches input order
      expect(datasetItems[0]).toHaveAttribute('data-testid', 'dataset-item-dataset-1');
      expect(datasetItems[1]).toHaveAttribute('data-testid', 'dataset-item-dataset-2');
      expect(datasetItems[2]).toHaveAttribute('data-testid', 'dataset-item-dataset-3');
    });

    /**
     * Test: Should handle undefined/null datasets gracefully
     * Verifies defensive programming with optional chaining
     */
    it('handles null/undefined datasets array gracefully', () => {
      // Test with undefined
      const { rerender } = render(<DatasetItemList datasets={undefined as any} />);
      expect(screen.getByText('No datasets found')).toBeInTheDocument();

      // Test with null
      rerender(<DatasetItemList datasets={null as any} />);
      expect(screen.getByText('No datasets found')).toBeInTheDocument();
    });

    /**
     * Test: Should re-render when datasets prop changes
     * Verifies that component updates correctly when data changes
     */
    it('updates when datasets prop changes', () => {
      const { rerender } = render(<DatasetItemList datasets={[mockDatasets[0]]} />);

      expect(screen.getByTestId('dataset-item-dataset-1')).toBeInTheDocument();
      expect(screen.queryByTestId('dataset-item-dataset-2')).not.toBeInTheDocument();

      // Update with different datasets
      rerender(<DatasetItemList datasets={[mockDatasets[1], mockDatasets[2]]} />);

      expect(screen.queryByTestId('dataset-item-dataset-1')).not.toBeInTheDocument();
      expect(screen.getByTestId('dataset-item-dataset-2')).toBeInTheDocument();
      expect(screen.getByTestId('dataset-item-dataset-3')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Data Validation Tests
  // --------------------------------------------------------------------------

  describe('Data validation', () => {
    /**
     * Test: Should handle datasets with duplicate IDs
     * Note: React will warn about duplicate keys, but component should still render
     */
    it('handles datasets with duplicate IDs (React will warn)', () => {
      const duplicateDatasets: Dataset[] = [
        { ...mockDatasets[0], id: 'duplicate' },
        { ...mockDatasets[1], id: 'duplicate' },
      ];

      // Suppress console warnings for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<DatasetItemList datasets={duplicateDatasets} />);

      // Both should still render (though React will warn)
      const items = screen.getAllByTestId('dataset-item-duplicate');
      expect(items).toHaveLength(2);

      consoleSpy.mockRestore();
    });

    /**
     * Test: Should handle datasets with various training statuses
     * Verifies component works with all possible training_status values
     */
    it('handles all possible training status values', () => {
      const statusDatasets: Dataset[] = [
        { ...mockDatasets[0], id: 'trained', training_status: 'trained' },
        { ...mockDatasets[0], id: 'untrained', training_status: 'untrained' },
        { ...mockDatasets[0], id: 'pending', training_status: 'pending' },
        { ...mockDatasets[0], id: 'failed', training_status: 'failed' },
      ];

      render(<DatasetItemList datasets={statusDatasets} />);

      expect(screen.getByTestId('dataset-item-trained')).toBeInTheDocument();
      expect(screen.getByTestId('dataset-item-untrained')).toBeInTheDocument();
      expect(screen.getByTestId('dataset-item-pending')).toBeInTheDocument();
      expect(screen.getByTestId('dataset-item-failed')).toBeInTheDocument();
    });
  });
});
