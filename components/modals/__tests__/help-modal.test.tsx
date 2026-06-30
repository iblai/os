import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { HelpModal } from '../help-modal';

// Controllable viewport so we exercise both the mobile and desktop className
// branches of the Modal wrapper.
let mockIsMobile = false;
vi.mock('react-responsive', () => ({
  useMediaQuery: () => mockIsMobile,
}));

describe('HelpModal', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockIsMobile = false;
  });

  it('does not render content when closed', () => {
    render(<HelpModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByText('Help')).not.toBeInTheDocument();
  });

  it('renders heading, popular resources section and all resource items', () => {
    render(<HelpModal isOpen onClose={vi.fn()} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Help')).toBeInTheDocument();
    expect(screen.getByText('Popular Resources')).toBeInTheDocument();

    // All seven help resources render their translated labels.
    expect(screen.getByText('Create A Study Buddy Agent')).toBeInTheDocument();
    expect(screen.getByText('Teaching Assistant Agent')).toBeInTheDocument();
    expect(screen.getByText('Lesson Planner')).toBeInTheDocument();
    expect(screen.getByText('Training From a Website')).toBeInTheDocument();
    expect(screen.getByText('Multi-language Support')).toBeInTheDocument();
    expect(screen.getByText('Customer Support')).toBeInTheDocument();
    expect(
      screen.getByText('Exploring Course Subjects and Topics'),
    ).toBeInTheDocument();

    expect(screen.getByText('Report a problem')).toBeInTheDocument();
  });

  it('calls onClose when the close (X) button is clicked', () => {
    const onClose = vi.fn();
    render(<HelpModal isOpen onClose={onClose} />);

    // The first/only icon button in the header is the close button.
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('applies mobile sizing when the viewport is small', () => {
    mockIsMobile = true;
    render(<HelpModal isOpen onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('h-full');
    expect(dialog.className).toContain('w-full');
  });

  it('applies desktop sizing on a wide viewport', () => {
    mockIsMobile = false;
    render(<HelpModal isOpen onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('w-[400px]');
  });
});
