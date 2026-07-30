'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

import type {
  FeedbackMode,
  GraderCriterion,
  GradingMode,
  MentorGraderConfiguration,
} from '@iblai/iblai-js/data-layer';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/spinner';
import { useNavigate } from '@/hooks/user-navigate';
import { TenantKeyMentorIdParams } from '@/lib/types';

import { FeedbackDisplaySelect } from './feedback-display-select';
import {
  GRADING_PROMPT_MAX_LENGTH,
  GradingPromptEditor,
} from './grading-prompt-editor';
import { RubricEditor, createEmptyRubricItem } from './rubric-editor';
import {
  useGraderConfiguration,
  type CriterionDraft,
  type GraderConfigurationFormValues,
} from './hooks/use-grader-configuration';

const DEFAULT_GRADING_MODE: GradingMode = 'submission';
const DEFAULT_FEEDBACK_MODE: FeedbackMode = 'both';

function buildEmptyForm(): GraderConfigurationFormValues {
  return {
    grader_instructions: '',
    grading_mode: DEFAULT_GRADING_MODE,
    feedback_mode: DEFAULT_FEEDBACK_MODE,
    criteria: [createEmptyRubricItem()],
  };
}

export function buildFormFromConfiguration(
  configuration: MentorGraderConfiguration | undefined,
  criteria: GraderCriterion[] | undefined,
): GraderConfigurationFormValues {
  if (!configuration) return buildEmptyForm();
  const drafts: CriterionDraft[] = (criteria ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    criteria: c.criteria,
    points: c.points,
  }));
  return {
    grader_instructions: configuration.grader_instructions ?? '',
    grading_mode: configuration.grading_mode ?? DEFAULT_GRADING_MODE,
    feedback_mode: configuration.feedback_mode ?? DEFAULT_FEEDBACK_MODE,
    criteria: drafts.length > 0 ? drafts : [createEmptyRubricItem()],
  };
}

export type GradingTabValidationError =
  | 'instructions_required'
  | 'criteria_required'
  | 'criterion_invalid';

export function validateGradingForm(
  form: GraderConfigurationFormValues,
): GradingTabValidationError | null {
  if (!form.grader_instructions.trim()) return 'instructions_required';
  if (form.criteria.length === 0) return 'criteria_required';
  const hasInvalid = form.criteria.some(
    (item) => !item.name.trim() || !item.criteria.trim() || !(item.points > 0),
  );
  if (hasInvalid) return 'criterion_invalid';
  return null;
}

const VALIDATION_MESSAGES: Record<GradingTabValidationError, string> = {
  instructions_required: 'Grading prompt is required.',
  criteria_required: 'Add at least one rubric item.',
  criterion_invalid:
    'Each rubric item needs a name, criteria text, and points greater than zero.',
};

export function GradingTab() {
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const { getMentorId } = useNavigate();
  const activeMentorId = getMentorId() || mentorId;

  const { configuration, criteria, isLoading, isSaving, isReady, save } =
    useGraderConfiguration({
      org: tenantKey,
      mentorId: activeMentorId,
    });

  const initialForm = useMemo(
    () => buildFormFromConfiguration(configuration, criteria),
    [configuration, criteria],
  );

  const [form, setForm] = useState<GraderConfigurationFormValues>(initialForm);
  const [validationError, setValidationError] =
    useState<GradingTabValidationError | null>(null);

  useEffect(() => {
    setForm(initialForm);
    setValidationError(null);
  }, [initialForm]);

  const updateForm = (patch: Partial<GraderConfigurationFormValues>) => {
    setForm((current) => ({ ...current, ...patch }));
  };

  const handleSave = async () => {
    const error = validateGradingForm(form);
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError(null);
    await save(form);
  };

  return (
    <>
      <div className="hidden h-[73px] flex-shrink-0 items-center border-b border-gray-200 bg-white p-4 lg:flex">
        <div>
          <h3 className="mb-1 text-base font-medium text-gray-900">Grading</h3>
          <p className="text-xs text-gray-700">
            Configure rubric-based grading for this mentor.
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div
          className="flex-1 space-y-6 px-3 pt-3 lg:p-4"
          style={{ overflowY: 'auto', overflowX: 'hidden' }}
        >
          {isLoading ? (
            <div
              role="status"
              aria-label="Loading grading configuration"
              data-testid="grading-tab-loading"
              className="flex items-center justify-center py-12"
            >
              <Spinner className="h-12 w-12" />
            </div>
          ) : (
            <div className="space-y-6" data-testid="grading-form">
              <GradingPromptEditor
                value={form.grader_instructions}
                onChange={(grader_instructions) =>
                  updateForm({ grader_instructions })
                }
                disabled={isSaving}
              />

              <FeedbackDisplaySelect
                value={form.feedback_mode}
                onChange={(feedback_mode) => updateForm({ feedback_mode })}
                disabled={isSaving}
              />

              <RubricEditor
                value={form.criteria}
                onChange={(criteria) => updateForm({ criteria })}
                disabled={isSaving}
              />

              {validationError ? (
                <p
                  className="text-sm text-red-600"
                  data-testid="grading-form-error"
                  role="alert"
                >
                  {VALIDATION_MESSAGES[validationError]}
                </p>
              ) : null}
            </div>
          )}
        </div>
        <div className="flex flex-shrink-0 justify-end border-t border-gray-200 bg-white px-3 py-4">
          <Button
            type="button"
            disabled={!isReady || isSaving}
            onClick={handleSave}
            className="bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-sm text-white hover:text-white hover:opacity-90"
            data-testid="grading-save-button"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </>
  );
}

export const __testing = {
  buildEmptyForm,
  GRADING_PROMPT_MAX_LENGTH,
  VALIDATION_MESSAGES,
};
