import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VoiceTermsModal } from '../voice-terms-modal';

describe('VoiceTermsModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onAgree: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog with accessible title and description', () => {
    render(<VoiceTermsModal {...defaultProps} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('Voice Terms and Conditions')).toBeInTheDocument();
    expect(
      screen.getByText('Review and accept the terms for using voice-powered mentorAI'),
    ).toBeInTheDocument();
  });

  it('renders the visual heading', () => {
    render(<VoiceTermsModal {...defaultProps} />);

    expect(screen.getByText('Creating a mentorAI powered with voice')).toBeInTheDocument();
  });

  it('renders all three rules', () => {
    render(<VoiceTermsModal {...defaultProps} />);

    expect(
      screen.getByText("Don't record third parties voice without their consent"),
    ).toBeInTheDocument();
    expect(screen.getByText("Don't use copyrighted voices")).toBeInTheDocument();
    expect(
      screen.getByText("Don't use voices in deepfakes, bullying, frauds, or scams"),
    ).toBeInTheDocument();
  });

  it('renders the agree button', () => {
    render(<VoiceTermsModal {...defaultProps} />);

    expect(screen.getByText('Agree & Continue')).toBeInTheDocument();
  });

  it('calls onAgree when agree button is clicked', () => {
    render(<VoiceTermsModal {...defaultProps} />);

    fireEvent.click(screen.getByText('Agree & Continue'));

    expect(defaultProps.onAgree).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when dialog is dismissed via Escape key', () => {
    render(<VoiceTermsModal {...defaultProps} />);

    // Radix Dialog fires onOpenChange(false) on Escape
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
