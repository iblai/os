'use client';

import { toast } from 'sonner';
import {
  useCreateGraderCriterionMutation,
  useCreateMentorGraderConfigurationMutation,
  useDeleteGraderCriterionMutation,
  useGetMentorGraderConfigurationQuery,
  useListGraderCriteriaQuery,
  useUpdateGraderCriterionMutation,
  useUpdateMentorGraderConfigurationMutation,
  type FeedbackMode,
  type GraderCriterion,
  type GradingMode,
  type MentorGraderConfiguration,
} from '@iblai/iblai-js/data-layer';

// A criterion in the form. Persisted criteria carry their server `id`; new
// rows added in the editor have `id: undefined` until they're POSTed.
export type CriterionDraft = {
  id?: number;
  name: string;
  criteria: string;
  points: number;
};

export type GraderConfigurationFormValues = {
  grader_instructions: string;
  feedback_mode: FeedbackMode;
  grading_mode: GradingMode;
  criteria: CriterionDraft[];
};

type UseGraderConfigurationArgs = {
  org: string;
  mentorId: string;
};

type UseGraderConfigurationResult = {
  configuration: MentorGraderConfiguration | undefined;
  criteria: GraderCriterion[] | undefined;
  isLoading: boolean;
  isSaving: boolean;
  isReady: boolean;
  save: (form: GraderConfigurationFormValues) => Promise<boolean>;
};

export function isHttpStatus(error: unknown, status: number): boolean {
  if (!error || typeof error !== 'object') return false;
  const maybeStatus = (error as { status?: unknown }).status;
  return typeof maybeStatus === 'number' && maybeStatus === status;
}

export function useGraderConfiguration({
  org,
  mentorId,
}: UseGraderConfigurationArgs): UseGraderConfigurationResult {
  const skip = !org || !mentorId;

  const {
    data: configuration,
    isLoading: configLoading,
    isFetching: configFetching,
    error: configError,
  } = useGetMentorGraderConfigurationQuery({ org, mentorId }, { skip });

  // The criteria endpoint also 404s while no config exists; once a config is
  // created the same query will start returning the criteria array.
  const {
    data: criteria,
    isLoading: criteriaLoading,
    isFetching: criteriaFetching,
  } = useListGraderCriteriaQuery({ org, mentorId }, { skip });

  const [createConfiguration, { isLoading: isCreatingConfig }] =
    useCreateMentorGraderConfigurationMutation();
  const [updateConfiguration, { isLoading: isUpdatingConfig }] =
    useUpdateMentorGraderConfigurationMutation();
  const [createCriterion, { isLoading: isCreatingCriterion }] =
    useCreateGraderCriterionMutation();
  const [updateCriterion, { isLoading: isUpdatingCriterion }] =
    useUpdateGraderCriterionMutation();
  const [deleteCriterion, { isLoading: isDeletingCriterion }] =
    useDeleteGraderCriterionMutation();

  const configMissing = isHttpStatus(configError, 404);
  const hasExistingConfig = !!configuration && !configMissing;
  const isLoading =
    configLoading || configFetching || criteriaLoading || criteriaFetching;
  const isReady = !skip && !isLoading;
  const isSaving =
    isCreatingConfig ||
    isUpdatingConfig ||
    isCreatingCriterion ||
    isUpdatingCriterion ||
    isDeletingCriterion;

  async function save(form: GraderConfigurationFormValues): Promise<boolean> {
    try {
      // Step 1: persist the singleton config (POST first time, PATCH after).
      if (hasExistingConfig) {
        await updateConfiguration({
          org,
          mentorId,
          formData: {
            grader_instructions: form.grader_instructions,
            feedback_mode: form.feedback_mode,
            grading_mode: form.grading_mode,
          },
        }).unwrap();
      } else {
        await createConfiguration({
          org,
          mentorId,
          formData: {
            grader_instructions: form.grader_instructions,
            feedback_mode: form.feedback_mode,
            grading_mode: form.grading_mode,
          },
        }).unwrap();
      }

      // Step 2: diff the criteria — POST new rows, PATCH changed rows, DELETE
      // removed rows. Backend rejects deleting the *last* criterion (400), so
      // we run deletes after creates to keep the collection non-empty.
      const persistedById = new Map<number, GraderCriterion>(
        (criteria ?? []).map((c) => [c.id, c]),
      );
      const submittedIds = new Set<number>();

      const creates: CriterionDraft[] = [];
      const updates: { id: number; draft: CriterionDraft }[] = [];

      for (const draft of form.criteria) {
        if (draft.id === undefined) {
          creates.push(draft);
          continue;
        }
        submittedIds.add(draft.id);
        const previous = persistedById.get(draft.id);
        if (
          !previous ||
          previous.name !== draft.name ||
          previous.criteria !== draft.criteria ||
          previous.points !== draft.points
        ) {
          updates.push({ id: draft.id, draft });
        }
      }

      const deletions = (criteria ?? [])
        .filter((c) => !submittedIds.has(c.id))
        .map((c) => c.id);

      // Run creates and updates first so we never end up with an empty
      // collection mid-save (which would 400 the next delete).
      for (const draft of creates) {
        await createCriterion({
          org,
          mentorId,
          formData: {
            name: draft.name,
            criteria: draft.criteria,
            points: draft.points,
          },
        }).unwrap();
      }

      for (const { id, draft } of updates) {
        await updateCriterion({
          org,
          mentorId,
          criterionId: id,
          formData: {
            name: draft.name,
            criteria: draft.criteria,
            points: draft.points,
          },
        }).unwrap();
      }

      for (const id of deletions) {
        await deleteCriterion({ org, mentorId, criterionId: id }).unwrap();
      }

      toast.success(
        hasExistingConfig
          ? 'Grading configuration updated'
          : 'Grading configuration created',
      );
      return true;
    } catch (err) {
      toast.error('Failed to save grading configuration');
      console.error('save grading configuration', err);
      return false;
    }
  }

  return {
    configuration: hasExistingConfig ? configuration : undefined,
    criteria: hasExistingConfig ? criteria : undefined,
    isLoading,
    isSaving,
    isReady,
    save,
  };
}
