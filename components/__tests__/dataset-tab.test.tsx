import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { DatasetTab } from '../dataset-tab';

// AddResourceModal pulls in heavy data-layer/upload deps; stub it so the test
// just verifies open/close wiring driven by DatasetTab's local state.
vi.mock(
  '../modals/edit-mentor-modal/tabs/datasets-tab/add-resource-modal',
  () => ({
    AddResourceModal: ({
      isOpen,
      onClose,
    }: {
      isOpen: boolean;
      onClose: () => void;
      keepParentOpen?: boolean;
    }) =>
      isOpen ? (
        <div data-testid="add-resource-modal">
          <button onClick={onClose}>close-modal</button>
        </div>
      ) : null,
  }),
);

describe('DatasetTab', () => {
  beforeEach(() => {
    cleanup();
  });

  it('renders the heading, add-resource button and empty-state text', () => {
    render(<DatasetTab />);

    expect(screen.getByText('Dataset')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /add resource/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('No resources added yet')).toBeInTheDocument();
  });

  it('does not render the modal initially', () => {
    render(<DatasetTab />);
    expect(screen.queryByTestId('add-resource-modal')).not.toBeInTheDocument();
  });

  it('opens the modal when the add-resource button is clicked', () => {
    render(<DatasetTab />);

    fireEvent.click(screen.getByRole('button', { name: /add resource/i }));
    expect(screen.getByTestId('add-resource-modal')).toBeInTheDocument();
  });

  it('closes the modal via the modal onClose callback', () => {
    render(<DatasetTab />);

    fireEvent.click(screen.getByRole('button', { name: /add resource/i }));
    expect(screen.getByTestId('add-resource-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByText('close-modal'));
    expect(screen.queryByTestId('add-resource-modal')).not.toBeInTheDocument();
  });
});
