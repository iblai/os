import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LearnerModeSwitch } from '../learner-mode-switch';

const { mockUseLearnerMode } = vi.hoisted(() => ({
  mockUseLearnerMode: vi.fn(),
}));

vi.mock('@/hooks/use-user', () => ({
  useLearnerMode: () => mockUseLearnerMode(),
}));

describe('LearnerModeSwitch', () => {
  const toggleLearnerMode = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the switch in checked state when isInstructorMode is true', () => {
    mockUseLearnerMode.mockReturnValue({
      isInstructorMode: true,
      toggleLearnerMode,
    });

    render(<LearnerModeSwitch />);

    const switchEl = screen.getByRole('switch');
    expect(switchEl).toBeInTheDocument();
    expect(switchEl).toHaveAttribute('aria-checked', 'true');
    expect(switchEl).toHaveAttribute('aria-label', 'User mode enabled');
  });

  it('renders the switch in unchecked state when isInstructorMode is false', () => {
    mockUseLearnerMode.mockReturnValue({
      isInstructorMode: false,
      toggleLearnerMode,
    });

    render(<LearnerModeSwitch />);

    const switchEl = screen.getByRole('switch');
    expect(switchEl).toHaveAttribute('aria-checked', 'false');
    expect(switchEl).toHaveAttribute('aria-label', 'User mode disabled');
  });

  it('invokes toggleLearnerMode when the switch is clicked', () => {
    mockUseLearnerMode.mockReturnValue({
      isInstructorMode: false,
      toggleLearnerMode,
    });

    render(<LearnerModeSwitch />);

    fireEvent.click(screen.getByRole('switch'));
    expect(toggleLearnerMode).toHaveBeenCalledTimes(1);
  });
});
