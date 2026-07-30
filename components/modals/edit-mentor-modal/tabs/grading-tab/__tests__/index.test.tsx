import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockUseParams = vi.fn();
const mockGetMentorId = vi.fn();
const mockSave = vi.fn();
let mockHookReturn: {
  configuration: unknown;
  criteria: unknown;
  isLoading: boolean;
  isSaving: boolean;
  isReady: boolean;
  save: typeof mockSave;
};

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({
    getMentorId: () => mockGetMentorId(),
  }),
}));

vi.mock('../hooks/use-grader-configuration', () => ({
  useGraderConfiguration: (args: unknown) => {
    void args;
    return mockHookReturn;
  },
}));

import {
  GradingTab,
  buildFormFromConfiguration,
  validateGradingForm,
} from '../index';

describe('buildFormFromConfiguration', () => {
  it('returns defaults with a seeded rubric item when no configuration is provided', () => {
    expect(buildFormFromConfiguration(undefined, undefined)).toEqual({
      grader_instructions: '',
      grading_mode: 'submission',
      feedback_mode: 'both',
      criteria: [{ name: '', criteria: '', points: 1 }],
    });
  });

  it('maps existing configuration + criteria onto the form', () => {
    expect(
      buildFormFromConfiguration(
        {
          id: 1,
          mentor: 'm',
          grading_mode: 'submission',
          grader_instructions: 'Grade.',
          feedback_mode: 'overall',
          created_at: '',
          updated_at: '',
        },
        [{ id: 7, name: 'C', criteria: 'd', points: 30 }],
      ),
    ).toEqual({
      grader_instructions: 'Grade.',
      grading_mode: 'submission',
      feedback_mode: 'overall',
      criteria: [{ id: 7, name: 'C', criteria: 'd', points: 30 }],
    });
  });

  it('seeds an empty rubric item when criteria are empty', () => {
    const result = buildFormFromConfiguration(
      {
        id: 1,
        mentor: 'm',
        grading_mode: 'submission',
        grader_instructions: 'p',
        feedback_mode: 'both',
        created_at: '',
        updated_at: '',
      },
      [],
    );
    expect(result.criteria).toEqual([{ name: '', criteria: '', points: 1 }]);
  });
});

describe('validateGradingForm', () => {
  const baseForm = {
    grader_instructions: 'p',
    grading_mode: 'submission' as const,
    feedback_mode: 'both' as const,
    criteria: [{ name: 'C', criteria: 'desc', points: 30 }],
  };

  it('returns null when the form is valid', () => {
    expect(validateGradingForm(baseForm)).toBeNull();
  });

  it('flags an empty grader_instructions', () => {
    expect(
      validateGradingForm({ ...baseForm, grader_instructions: '   ' }),
    ).toBe('instructions_required');
  });

  it('flags an empty criteria list', () => {
    expect(validateGradingForm({ ...baseForm, criteria: [] })).toBe(
      'criteria_required',
    );
  });

  it('flags criteria items missing a name', () => {
    expect(
      validateGradingForm({
        ...baseForm,
        criteria: [{ name: '', criteria: 'desc', points: 30 }],
      }),
    ).toBe('criterion_invalid');
  });

  it('flags criteria items missing criteria text', () => {
    expect(
      validateGradingForm({
        ...baseForm,
        criteria: [{ name: 'X', criteria: '', points: 30 }],
      }),
    ).toBe('criterion_invalid');
  });

  it('flags criteria items with non-positive points', () => {
    expect(
      validateGradingForm({
        ...baseForm,
        criteria: [{ name: 'X', criteria: 'desc', points: 0 }],
      }),
    ).toBe('criterion_invalid');
  });
});

describe('GradingTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({
      tenantKey: 'tenant-1',
      mentorId: 'mentor-1',
    });
    mockGetMentorId.mockReturnValue('');
    mockHookReturn = {
      configuration: undefined,
      criteria: undefined,
      isLoading: false,
      isSaving: false,
      isReady: true,
      save: mockSave,
    };
    mockSave.mockResolvedValue(true);
  });

  it('renders the form with a seeded rubric item when there is no existing configuration', () => {
    render(<GradingTab />);
    expect(screen.getByTestId('grading-form')).toBeInTheDocument();
    expect(screen.getByTestId('rubric-item-0')).toBeInTheDocument();
  });

  it('renders the form with the existing configuration + criteria', () => {
    mockHookReturn = {
      ...mockHookReturn,
      configuration: {
        id: 1,
        mentor: 'mentor-1',
        grading_mode: 'submission',
        grader_instructions: 'Grade with care.',
        feedback_mode: 'both',
        created_at: 'now',
        updated_at: 'now',
      },
      criteria: [{ id: 7, name: 'Clarity', criteria: 'd', points: 30 }],
    };
    render(<GradingTab />);
    expect(screen.getByTestId('grading-form')).toBeInTheDocument();
    expect(screen.getByTestId('grading-prompt-textarea')).toHaveValue(
      'Grade with care.',
    );
    expect(screen.getByTestId('rubric-item-name-0')).toHaveValue('Clarity');
  });

  it('shows the loading spinner while either query is in flight', () => {
    mockHookReturn = { ...mockHookReturn, isLoading: true, isReady: false };
    render(<GradingTab />);
    expect(screen.getByTestId('grading-tab-loading')).toBeInTheDocument();
  });

  it('shows a validation error when saving with empty instructions', async () => {
    render(<GradingTab />);
    fireEvent.click(screen.getByTestId('grading-save-button'));
    await waitFor(() => {
      expect(screen.getByTestId('grading-form-error')).toHaveTextContent(
        'Grading prompt is required.',
      );
    });
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('shows the criterion validation error when an item is incomplete', async () => {
    render(<GradingTab />);
    fireEvent.change(screen.getByTestId('grading-prompt-textarea'), {
      target: { value: 'Grade strictly.' },
    });
    fireEvent.click(screen.getByTestId('grading-save-button'));
    await waitFor(() => {
      expect(screen.getByTestId('grading-form-error')).toHaveTextContent(
        /Each rubric item needs a name, criteria text/,
      );
    });
  });

  it('shows the criteria-required error when the rubric is empty', async () => {
    render(<GradingTab />);
    fireEvent.change(screen.getByTestId('grading-prompt-textarea'), {
      target: { value: 'Grade strictly.' },
    });
    fireEvent.click(screen.getByTestId('rubric-item-remove-0'));
    fireEvent.click(screen.getByTestId('grading-save-button'));
    await waitFor(() => {
      expect(screen.getByTestId('grading-form-error')).toHaveTextContent(
        /Add at least one rubric item/,
      );
    });
  });

  it('calls save() with the form values on a valid submit', async () => {
    render(<GradingTab />);
    fireEvent.change(screen.getByTestId('grading-prompt-textarea'), {
      target: { value: 'Grade carefully.' },
    });
    fireEvent.change(screen.getByTestId('rubric-item-name-0'), {
      target: { value: 'Clarity' },
    });
    fireEvent.change(screen.getByTestId('rubric-item-criteria-0'), {
      target: { value: 'Is the answer clear?' },
    });
    fireEvent.click(screen.getByTestId('grading-save-button'));
    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({
          grader_instructions: 'Grade carefully.',
          grading_mode: 'submission',
          feedback_mode: 'both',
          criteria: [
            expect.objectContaining({
              name: 'Clarity',
              criteria: 'Is the answer clear?',
              points: 1,
            }),
          ],
        }),
      );
    });
  });

  it('falls back to the URL mentorId when getMentorId returns falsy', () => {
    mockGetMentorId.mockReturnValue('');
    mockUseParams.mockReturnValue({
      tenantKey: 'tenant-1',
      mentorId: 'mentor-from-url',
    });
    render(<GradingTab />);
    expect(screen.getByText('Grading')).toBeInTheDocument();
  });

  it('uses the modal mentor id over URL when present', () => {
    mockGetMentorId.mockReturnValue('mentor-from-modal');
    render(<GradingTab />);
    expect(screen.getByText('Grading')).toBeInTheDocument();
  });

  it('disables the save button while saving', () => {
    mockHookReturn = {
      ...mockHookReturn,
      isSaving: true,
      configuration: {
        id: 1,
        mentor: 'mentor-1',
        grading_mode: 'submission',
        grader_instructions: 'p',
        feedback_mode: 'both',
        created_at: 'now',
        updated_at: 'now',
      },
      criteria: [{ id: 7, name: 'C', criteria: 'd', points: 30 }],
    };
    render(<GradingTab />);
    expect(screen.getByTestId('grading-save-button')).toBeDisabled();
    expect(screen.getByTestId('grading-save-button')).toHaveTextContent(
      'Saving...',
    );
  });

  it('updates the feedback_mode select when changed', () => {
    render(<GradingTab />);
    fireEvent.keyDown(screen.getByTestId('feedback-display-trigger'), {
      key: 'Enter',
    });
    fireEvent.click(screen.getByTestId('feedback-display-option-overall'));
    expect(screen.getByTestId('feedback-display-trigger')).toBeInTheDocument();
  });
});
