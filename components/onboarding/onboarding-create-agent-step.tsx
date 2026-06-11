'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import {
  useCreateMentorMutation,
  useGetMentorsQuery,
} from '@iblai/iblai-js/data-layer';
import {
  StepHeader,
  onboardingPrimaryButtonClass,
  type OnboardingFinalStepContext,
} from '@iblai/iblai-js/web-containers';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  DEFAULT_PROMPTS,
  MENTOR_VISIBILITY_VALUES,
  MODEL_AGENTS,
} from '@/lib/constants';
import { config } from '@/lib/config';

/**
 * OS-local final screen for onboarding: a minimal Name + Description form that
 * creates the first agent with the app's defaults (Students visibility, default
 * prompts, neutral template, no category). It is wired into the SDK
 * `OnboardingWizard` via its `renderFinalStep` slot (the SDK ships no built-in
 * final screen — the create page lives here, in the OS app, only).
 *
 * The create endpoint is slow, so submission is fire-and-forget: the mutation
 * is kicked off and the wizard completes IMMEDIATELY with an existing agent's
 * id (any agent, fetched up front) so the page redirects without waiting —
 * `null` when the tenant has no agents yet. A failed creation surfaces as a
 * deferred toast.
 */
export function OnboardingCreateAgentStep({
  tenant,
  username,
  suggestedAgent,
  goBack,
  complete,
}: OnboardingFinalStepContext) {
  const [name, setName] = useState(suggestedAgent?.name ?? '');
  const [description, setDescription] = useState(
    suggestedAgent?.description ?? '',
  );
  const [createMentor, { isLoading }] = useCreateMentorMutation();

  // Any existing agent's id, fetched up front — what the page redirects to the
  // moment creation is kicked off.
  const { data: existingAgents, isLoading: isLoadingAgents } =
    useGetMentorsQuery(
      { org: tenant, username, limit: 1, offset: 0 },
      { skip: !tenant || !username },
    );
  const anyAgentId: string | null =
    (existingAgents?.results?.[0] as { unique_id?: string } | undefined)
      ?.unique_id ?? null;

  const canCreate = name.trim().length > 0 && !isLoading && !isLoadingAgents;

  const submit = () => {
    if (!canCreate) return;
    // Fire-and-forget: kick the (slow) create off and leave immediately.
    createMentor({
      org: tenant,
      formData: {
        new_mentor_name: name.trim(),
        display_name: name.trim(),
        description: description.trim(),
        template_name: MODEL_AGENTS[0]?.value || config.iblTemplateMentor(),
        metadata: { category: null },
        system_prompt: DEFAULT_PROMPTS.DEFAULT_SYSTEM_PROMPT,
        proactive_prompt: DEFAULT_PROMPTS.DEFAULT_PROACTIVE_PROMPT,
        moderation_system_prompt: DEFAULT_PROMPTS.DEFAULT_MODERATION_PROMPT,
        guided_prompt_instructions: DEFAULT_PROMPTS.DEFAULT_GUIDED_PROMPT,
        mentor_visibility: MENTOR_VISIBILITY_VALUES.STUDENTS,
      },
      // @ts-ignore userId is accepted by the API but absent from the RTK type
      userId: username,
    })
      .unwrap()
      .catch((error: unknown) => {
        const message =
          (error as { error?: { error?: string } })?.error?.error ??
          'Failed to create agent';
        toast.error(message);
      });
    complete(anyAgentId);
  };

  return (
    <div>
      <StepHeader
        icon={Sparkles}
        title="Make your first agent"
        subtitle="Give it a name and a short description — you can refine it later."
      />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="space-y-5"
      >
        <div className="space-y-2">
          <Label
            htmlFor="onboarding-agent-name"
            className="text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Name
          </Label>
          <Input
            id="onboarding-agent-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Campus Assistant"
            autoFocus
            className="h-11"
          />
        </div>
        <div className="space-y-2">
          <Label
            htmlFor="onboarding-agent-description"
            className="text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Description
          </Label>
          <Textarea
            id="onboarding-agent-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What does this agent help with?"
            rows={3}
          />
        </div>
        <button
          type="submit"
          disabled={!canCreate}
          className={onboardingPrimaryButtonClass}
        >
          {isLoading ? 'Creating…' : 'Create agent'}
        </button>
      </form>
      <div className="mt-3">
        <button
          type="button"
          onClick={goBack}
          className="w-full text-center text-sm text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
        >
          Back
        </button>
      </div>
    </div>
  );
}
