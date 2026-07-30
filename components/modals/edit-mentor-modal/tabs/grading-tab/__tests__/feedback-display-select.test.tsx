import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import {
  FEEDBACK_MODE_OPTIONS,
  FeedbackDisplaySelect,
} from '../feedback-display-select';

describe('FeedbackDisplaySelect', () => {
  it('exposes the three options matching the FeedbackMode contract', () => {
    expect(FEEDBACK_MODE_OPTIONS.map((o) => o.value)).toEqual([
      'per_criteria',
      'overall',
      'both',
    ]);
  });

  it('renders the trigger with an accessible label', () => {
    render(<FeedbackDisplaySelect value="both" onChange={vi.fn()} />);
    expect(screen.getByTestId('feedback-display-trigger')).toBeInTheDocument();
    expect(screen.getByLabelText('Feedback display')).toBeInTheDocument();
  });

  it('calls onChange when an option is picked', () => {
    const onChange = vi.fn();
    render(<FeedbackDisplaySelect value="both" onChange={onChange} />);
    fireEvent.keyDown(screen.getByTestId('feedback-display-trigger'), {
      key: 'Enter',
    });
    fireEvent.click(screen.getByTestId('feedback-display-option-per_criteria'));
    expect(onChange).toHaveBeenCalledWith('per_criteria');
  });

  it('disables the trigger when disabled is true', () => {
    render(<FeedbackDisplaySelect value="both" onChange={vi.fn()} disabled />);
    expect(screen.getByTestId('feedback-display-trigger')).toBeDisabled();
  });

  it('uses a custom id when provided', () => {
    render(
      <FeedbackDisplaySelect
        value="both"
        onChange={vi.fn()}
        id="my-feedback"
      />,
    );
    expect(screen.getByTestId('feedback-display-trigger')).toHaveAttribute(
      'id',
      'my-feedback',
    );
  });
});
