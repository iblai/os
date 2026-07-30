import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import {
  GRADING_PROMPT_MAX_LENGTH,
  GradingPromptEditor,
} from '../grading-prompt-editor';

describe('GradingPromptEditor', () => {
  it('renders the textarea with the provided value', () => {
    render(<GradingPromptEditor value="Grade strictly." onChange={vi.fn()} />);
    const textarea = screen.getByTestId(
      'grading-prompt-textarea',
    ) as HTMLTextAreaElement;
    expect(textarea.value).toBe('Grade strictly.');
  });

  it('renders the default placeholder when none is provided', () => {
    render(<GradingPromptEditor value="" onChange={vi.fn()} />);
    expect(
      screen.getByPlaceholderText(/Describe how the mentor should grade/i),
    ).toBeInTheDocument();
  });

  it('uses a custom placeholder when provided', () => {
    render(
      <GradingPromptEditor
        value=""
        onChange={vi.fn()}
        placeholder="My placeholder"
      />,
    );
    expect(screen.getByPlaceholderText('My placeholder')).toBeInTheDocument();
  });

  it('shows the character count using the maxLength constant', () => {
    render(<GradingPromptEditor value="hello" onChange={vi.fn()} />);
    expect(screen.getByTestId('grading-prompt-char-count')).toHaveTextContent(
      `5 / ${GRADING_PROMPT_MAX_LENGTH}`,
    );
  });

  it('calls onChange when the user types', () => {
    const onChange = vi.fn();
    render(<GradingPromptEditor value="" onChange={onChange} />);
    fireEvent.change(screen.getByTestId('grading-prompt-textarea'), {
      target: { value: 'new prompt' },
    });
    expect(onChange).toHaveBeenCalledWith('new prompt');
  });

  it('disables the textarea when disabled is true', () => {
    render(<GradingPromptEditor value="" onChange={vi.fn()} disabled />);
    expect(screen.getByTestId('grading-prompt-textarea')).toBeDisabled();
  });

  it('uses a custom id when provided', () => {
    render(<GradingPromptEditor value="" onChange={vi.fn()} id="custom-id" />);
    const textarea = screen.getByTestId('grading-prompt-textarea');
    expect(textarea).toHaveAttribute('id', 'custom-id');
  });

  it('caps the textarea at the documented maxLength', () => {
    render(<GradingPromptEditor value="" onChange={vi.fn()} />);
    expect(screen.getByTestId('grading-prompt-textarea')).toHaveAttribute(
      'maxlength',
      String(GRADING_PROMPT_MAX_LENGTH),
    );
  });
});
