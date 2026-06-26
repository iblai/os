import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { LLMProviderSelectionModal } from '../llm-provider-selection-modal';

// LLMTab is a heavy data-driven tab; replace it with a deterministic marker
// that records the prop it is given so we can assert wiring.
vi.mock('../edit-mentor-modal/tabs', () => ({
  LLMTab: ({
    showConfigurationHeader,
  }: {
    showConfigurationHeader: boolean;
  }) => (
    <div data-testid="llm-tab">header:{String(showConfigurationHeader)}</div>
  ),
}));

describe('LLMProviderSelectionModal', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('does not render content when closed', () => {
    render(<LLMProviderSelectionModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByText('LLM Providers')).not.toBeInTheDocument();
  });

  it('renders the title, sr-only description and the LLM tab without the config header', () => {
    render(<LLMProviderSelectionModal isOpen onClose={vi.fn()} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('LLM Providers')).toBeInTheDocument();
    expect(
      screen.getByText('Select an LLM Provider from the list'),
    ).toBeInTheDocument();

    const tab = screen.getByTestId('llm-tab');
    expect(tab).toHaveTextContent('header:false');
  });

  it('calls onClose when the dialog requests to close (Escape)', () => {
    const onClose = vi.fn();
    render(<LLMProviderSelectionModal isOpen onClose={onClose} />);

    fireEvent.keyDown(screen.getByRole('dialog'), {
      key: 'Escape',
      code: 'Escape',
    });

    expect(onClose).toHaveBeenCalled();
  });
});
