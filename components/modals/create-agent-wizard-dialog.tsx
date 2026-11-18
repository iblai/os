'use client';

import React from 'react';
import {
  CreateAgentWizard,
  CREATE_AGENT_WIZARD_STEPS,
  type CreateAgentWizardProps,
  type CreateAgentWizardStep,
} from '@iblai/iblai-js/web-containers';

import { Spinner } from '@/components/spinner';
import { useHydrateMentorRbac } from '@/hooks/use-hydrate-mentor-rbac';
import { useMentorSegments } from '@/hooks/use-mentor-segments';
import { MODALS } from '@/lib/constants';
import { LLMTab } from './edit-mentor-modal/llm-tab';
import { PromptsTab } from './edit-mentor-modal/tabs/prompts-tab';
import { SkillsTab } from './edit-mentor-modal/tabs/skills-tab';
import { McpTab } from './edit-mentor-modal/tabs/mcp-tab';
import { AgentDatasetsTabWrapper } from './edit-mentor-modal/tabs/datasets-tab/agent-datasets-tab';

const STEP_TABS: Record<CreateAgentWizardStep, string> = {
  llm: MODALS.EDIT_MENTOR.tabs.llm,
  prompts: MODALS.EDIT_MENTOR.tabs.prompts,
  skills: MODALS.EDIT_MENTOR.tabs.skills,
  datasets: MODALS.EDIT_MENTOR.tabs.datasets,
  mcp: MODALS.EDIT_MENTOR.tabs.mcp,
};

/**
 * The wizard's steps for the new agent, hidden by the same rules that hide
 * Edit Agent's tabs. All steps are listed until the agent exists and its
 * settings and permissions have loaded.
 */
export function useCreateAgentWizardSteps(
  mentorId: string | null,
  tenantKey: string,
) {
  const { filteredSegments, isLoading, mentorSettings } = useMentorSegments({
    mentorId,
    tenantKey,
  });
  // @ts-ignore mentor_id lives on the public settings shape but isn't typed
  const mentorDbId = mentorSettings?.mentor_id as number | undefined;
  const isRbacHydrated = useHydrateMentorRbac({
    enabled: !!mentorId,
    mentorDbId,
    tenantKey,
  });
  const isReady = !!mentorId && !isLoading && (!mentorDbId || isRbacHydrated);

  const steps = React.useMemo(
    () =>
      isReady
        ? CREATE_AGENT_WIZARD_STEPS.filter((step) =>
            filteredSegments.some((s) => s.value === STEP_TABS[step]),
          )
        : CREATE_AGENT_WIZARD_STEPS,
    [isReady, filteredSegments],
  );

  return { steps, isReady };
}

function WizardTab({
  step,
  mentorId,
  tenantKey,
}: {
  step: CreateAgentWizardStep;
  mentorId: string;
  tenantKey: string;
}) {
  switch (step) {
    case 'llm':
      return <LLMTab mentorId={mentorId} tenantKey={tenantKey} />;
    case 'prompts':
      return <PromptsTab mentorId={mentorId} tenantKey={tenantKey} />;
    case 'skills':
      return <SkillsTab mentorId={mentorId} tenantKey={tenantKey} />;
    case 'datasets':
      // The wizard's page keeps its own URL, so paging stays in local state.
      return (
        <AgentDatasetsTabWrapper
          mentorId={mentorId}
          tenantKey={tenantKey}
          syncToUrl={false}
        />
      );
    case 'mcp':
      return <McpTab mentorId={mentorId} tenantKey={tenantKey} />;
  }
}

export type CreateAgentWizardDialogProps = Omit<
  CreateAgentWizardProps,
  'isOpen' | 'steps' | 'renderStep'
>;

/**
 * Create Agent as the SDK wizard, with each step rendering the same tab
 * wrapper Edit Agent shows, pinned to the agent the wizard just created.
 */
export function CreateAgentWizardDialog({
  onCreated,
  ...props
}: CreateAgentWizardDialogProps) {
  const [mentorId, setMentorId] = React.useState<string | null>(null);
  const { steps, isReady } = useCreateAgentWizardSteps(mentorId, props.org);
  const onFinishRef = React.useRef(props.onFinish);
  onFinishRef.current = props.onFinish;

  // The steps are known only once the agent exists, after the wizard left its
  // name step, so a person with none of them is finished here, not by the SDK.
  React.useEffect(() => {
    if (mentorId && isReady && steps.length === 0) {
      onFinishRef.current(mentorId);
    }
  }, [mentorId, isReady, steps.length]);

  return (
    <CreateAgentWizard
      {...props}
      isOpen
      steps={steps}
      onCreated={(id) => {
        setMentorId(id);
        onCreated?.(id);
      }}
      renderStep={({ mentorId: stepMentorId, step }) =>
        isReady ? (
          <WizardTab
            step={step}
            mentorId={stepMentorId}
            tenantKey={props.org}
          />
        ) : (
          <Spinner className="min-h-64" />
        )
      }
    />
  );
}
