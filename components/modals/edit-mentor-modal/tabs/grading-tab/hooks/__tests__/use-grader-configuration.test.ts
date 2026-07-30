import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const mockGetConfig = vi.fn();
const mockListCriteria = vi.fn();

const mockCreateConfig = vi.fn();
const mockCreateConfigUnwrap = vi.fn();
const mockUpdateConfig = vi.fn();
const mockUpdateConfigUnwrap = vi.fn();

const mockCreateCriterion = vi.fn();
const mockCreateCriterionUnwrap = vi.fn();
const mockUpdateCriterion = vi.fn();
const mockUpdateCriterionUnwrap = vi.fn();
const mockDeleteCriterion = vi.fn();
const mockDeleteCriterionUnwrap = vi.fn();

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetMentorGraderConfigurationQuery: (
    args: unknown,
    options?: { skip?: boolean },
  ) => mockGetConfig(args, options),
  useListGraderCriteriaQuery: (args: unknown, options?: { skip?: boolean }) =>
    mockListCriteria(args, options),
  useCreateMentorGraderConfigurationMutation: () => [
    (args: unknown) => {
      mockCreateConfig(args);
      return { unwrap: mockCreateConfigUnwrap };
    },
    { isLoading: false },
  ],
  useUpdateMentorGraderConfigurationMutation: () => [
    (args: unknown) => {
      mockUpdateConfig(args);
      return { unwrap: mockUpdateConfigUnwrap };
    },
    { isLoading: false },
  ],
  useCreateGraderCriterionMutation: () => [
    (args: unknown) => {
      mockCreateCriterion(args);
      return { unwrap: mockCreateCriterionUnwrap };
    },
    { isLoading: false },
  ],
  useUpdateGraderCriterionMutation: () => [
    (args: unknown) => {
      mockUpdateCriterion(args);
      return { unwrap: mockUpdateCriterionUnwrap };
    },
    { isLoading: false },
  ],
  useDeleteGraderCriterionMutation: () => [
    (args: unknown) => {
      mockDeleteCriterion(args);
      return { unwrap: mockDeleteCriterionUnwrap };
    },
    { isLoading: false },
  ],
}));

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

import {
  isHttpStatus,
  useGraderConfiguration,
  type GraderConfigurationFormValues,
} from '../use-grader-configuration';

const SAMPLE_FORM: GraderConfigurationFormValues = {
  grader_instructions: 'Grade carefully.',
  grading_mode: 'submission',
  feedback_mode: 'both',
  criteria: [{ name: 'Clarity', criteria: 'Is it clear?', points: 30 }],
};

describe('isHttpStatus', () => {
  it('returns true for matching numeric status', () => {
    expect(isHttpStatus({ status: 404 }, 404)).toBe(true);
  });
  it('returns false otherwise', () => {
    expect(isHttpStatus(null, 404)).toBe(false);
    expect(isHttpStatus({ status: '404' }, 404)).toBe(false);
    expect(isHttpStatus({ status: 500 }, 404)).toBe(false);
  });
});

describe('useGraderConfiguration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListCriteria.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
    });
  });

  it('skips both queries when org/mentorId are missing', () => {
    mockGetConfig.mockReturnValue({ data: undefined, isLoading: false });
    renderHook(() => useGraderConfiguration({ org: '', mentorId: 'm' }));
    expect(mockGetConfig).toHaveBeenCalledWith(
      expect.objectContaining({ org: '', mentorId: 'm' }),
      expect.objectContaining({ skip: true }),
    );
    expect(mockListCriteria).toHaveBeenCalledWith(
      expect.objectContaining({ org: '', mentorId: 'm' }),
      expect.objectContaining({ skip: true }),
    );
  });

  it('returns configuration + criteria when both queries succeed', () => {
    mockGetConfig.mockReturnValue({
      data: {
        id: 1,
        mentor: 'm',
        grading_mode: 'submission',
        grader_instructions: 'p',
        feedback_mode: 'both',
        created_at: 'now',
        updated_at: 'now',
      },
      isLoading: false,
      isFetching: false,
    });
    mockListCriteria.mockReturnValue({
      data: [{ id: 7, name: 'C', criteria: 'd', points: 30 }],
      isLoading: false,
      isFetching: false,
    });
    const { result } = renderHook(() =>
      useGraderConfiguration({ org: 'o', mentorId: 'm' }),
    );
    expect(result.current.configuration?.id).toBe(1);
    expect(result.current.criteria?.[0].id).toBe(7);
    expect(result.current.isReady).toBe(true);
  });

  it('treats a 404 on the config as no existing configuration', () => {
    mockGetConfig.mockReturnValue({
      data: undefined,
      error: { status: 404 },
      isLoading: false,
      isFetching: false,
    });
    const { result } = renderHook(() =>
      useGraderConfiguration({ org: 'o', mentorId: 'm' }),
    );
    expect(result.current.configuration).toBeUndefined();
    expect(result.current.criteria).toBeUndefined();
  });

  it('save() POSTs the config and POSTs each new criterion when nothing exists yet', async () => {
    mockGetConfig.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
    });
    mockListCriteria.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
    });
    mockCreateConfigUnwrap.mockResolvedValue({});
    mockCreateCriterionUnwrap.mockResolvedValue({});

    const { result } = renderHook(() =>
      useGraderConfiguration({ org: 'o', mentorId: 'm' }),
    );
    let ok = false;
    await act(async () => {
      ok = await result.current.save(SAMPLE_FORM);
    });

    expect(ok).toBe(true);
    expect(mockCreateConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        org: 'o',
        mentorId: 'm',
        formData: expect.objectContaining({
          grader_instructions: 'Grade carefully.',
          feedback_mode: 'both',
          grading_mode: 'submission',
        }),
      }),
    );
    expect(mockCreateCriterion).toHaveBeenCalledWith(
      expect.objectContaining({
        org: 'o',
        mentorId: 'm',
        formData: { name: 'Clarity', criteria: 'Is it clear?', points: 30 },
      }),
    );
    expect(mockUpdateConfig).not.toHaveBeenCalled();
    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Grading configuration created',
    );
  });

  it('save() PATCHes the config when one already exists', async () => {
    mockGetConfig.mockReturnValue({
      data: {
        id: 1,
        mentor: 'm',
        grading_mode: 'submission',
        grader_instructions: 'old',
        feedback_mode: 'both',
        created_at: 'now',
        updated_at: 'now',
      },
      isLoading: false,
      isFetching: false,
    });
    mockListCriteria.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
    });
    mockUpdateConfigUnwrap.mockResolvedValue({});
    mockCreateCriterionUnwrap.mockResolvedValue({});

    const { result } = renderHook(() =>
      useGraderConfiguration({ org: 'o', mentorId: 'm' }),
    );
    await act(async () => {
      await result.current.save(SAMPLE_FORM);
    });
    expect(mockUpdateConfig).toHaveBeenCalled();
    expect(mockCreateConfig).not.toHaveBeenCalled();
    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Grading configuration updated',
    );
  });

  it('save() PATCHes only changed criteria and DELETEs the rest', async () => {
    const persisted = [
      { id: 7, name: 'Clarity', criteria: 'old', points: 30 },
      { id: 8, name: 'Accuracy', criteria: 'sec', points: 70 },
    ];
    mockGetConfig.mockReturnValue({
      data: {
        id: 1,
        mentor: 'm',
        grading_mode: 'submission',
        grader_instructions: 'p',
        feedback_mode: 'both',
        created_at: 'now',
        updated_at: 'now',
      },
      isLoading: false,
      isFetching: false,
    });
    mockListCriteria.mockReturnValue({
      data: persisted,
      isLoading: false,
      isFetching: false,
    });
    mockUpdateConfigUnwrap.mockResolvedValue({});
    mockUpdateCriterionUnwrap.mockResolvedValue({});
    mockDeleteCriterionUnwrap.mockResolvedValue({});
    mockCreateCriterionUnwrap.mockResolvedValue({});

    const form: GraderConfigurationFormValues = {
      grader_instructions: 'p',
      grading_mode: 'submission',
      feedback_mode: 'both',
      criteria: [
        // changed: criteria text edited
        { id: 7, name: 'Clarity', criteria: 'new', points: 30 },
        // new row (no id)
        { name: 'Style', criteria: 'fresh', points: 20 },
        // id 8 was removed
      ],
    };

    const { result } = renderHook(() =>
      useGraderConfiguration({ org: 'o', mentorId: 'm' }),
    );
    await act(async () => {
      await result.current.save(form);
    });

    expect(mockUpdateCriterion).toHaveBeenCalledWith(
      expect.objectContaining({
        criterionId: 7,
        formData: { name: 'Clarity', criteria: 'new', points: 30 },
      }),
    );
    expect(mockCreateCriterion).toHaveBeenCalledWith(
      expect.objectContaining({
        formData: { name: 'Style', criteria: 'fresh', points: 20 },
      }),
    );
    expect(mockDeleteCriterion).toHaveBeenCalledWith(
      expect.objectContaining({ criterionId: 8 }),
    );
  });

  it('save() reports an error toast and returns false on failure', async () => {
    mockGetConfig.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
    });
    mockListCriteria.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
    });
    mockCreateConfigUnwrap.mockRejectedValue(new Error('boom'));
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() =>
      useGraderConfiguration({ org: 'o', mentorId: 'm' }),
    );
    let ok = true;
    await act(async () => {
      ok = await result.current.save(SAMPLE_FORM);
    });
    expect(ok).toBe(false);
    expect(mockToastError).toHaveBeenCalledWith(
      'Failed to save grading configuration',
    );
    expect(consoleErr).toHaveBeenCalled();
    consoleErr.mockRestore();
  });

  it('exposes isLoading=true while either query is fetching', async () => {
    mockGetConfig.mockReturnValue({
      data: undefined,
      isLoading: true,
      isFetching: false,
    });
    const { result } = renderHook(() =>
      useGraderConfiguration({ org: 'o', mentorId: 'm' }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(true));
  });
});
