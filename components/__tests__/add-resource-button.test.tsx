import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { AddResourceButton } from '../add-resource-button';

const { mockAddResourceModal } = vi.hoisted(() => ({
  mockAddResourceModal: vi.fn(),
}));

vi.mock(
  '@/components/modals/edit-mentor-modal/tabs/datasets-tab/add-resource-modal',
  () => ({
    AddResourceModal: (props: { isOpen: boolean; onClose: () => void }) => {
      mockAddResourceModal(props);
      return props.isOpen ? (
        <div data-testid="add-resource-modal">
          <button data-testid="modal-close" onClick={props.onClose}>
            close
          </button>
        </div>
      ) : null;
    },
  }),
);

describe('AddResourceButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the button with translated label', () => {
    render(<AddResourceButton />);
    expect(
      screen.getByRole('button', { name: /Add Resource/i }),
    ).toBeInTheDocument();
  });

  it('renders the modal closed by default', () => {
    render(<AddResourceButton />);
    expect(screen.queryByTestId('add-resource-modal')).not.toBeInTheDocument();
    expect(mockAddResourceModal).toHaveBeenCalledWith(
      expect.objectContaining({ isOpen: false }),
    );
  });

  it('opens the modal when the button is clicked', () => {
    render(<AddResourceButton />);
    fireEvent.click(screen.getByRole('button', { name: /Add Resource/i }));
    expect(screen.getByTestId('add-resource-modal')).toBeInTheDocument();
  });

  it('closes the modal via the onClose callback', () => {
    render(<AddResourceButton />);
    fireEvent.click(screen.getByRole('button', { name: /Add Resource/i }));
    expect(screen.getByTestId('add-resource-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('modal-close'));
    expect(screen.queryByTestId('add-resource-modal')).not.toBeInTheDocument();
  });
});
