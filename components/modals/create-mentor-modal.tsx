'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';
import type { CreateAgentInitialValues } from '@iblai/iblai-js/web-containers';
import { useShowFreeTrialDialog } from '@iblai/iblai-js/web-utils';

import { useTenantKey } from '@/hooks/use-tenants';
import { useUsername } from '@/hooks/use-user';
import { useNavigate } from '@/hooks/user-navigate';
import { config } from '@/lib/config';
import { DEFAULT_PROMPTS, MODEL_AGENTS } from '@/lib/constants';

const CreateAgentWizardDialog = React.lazy(() =>
  import('./create-agent-wizard-dialog').then((m) => ({
    default: m.CreateAgentWizardDialog,
  })),
);

interface CreateMentorModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Optional values used to pre-populate any of the form fields (including the
   * prompts in the Prompts tab). Omitting this keeps the original behaviour.
   */
  initialValues?: CreateAgentInitialValues;
}

const DEFAULT_AGENT_PROMPTS = {
  system: DEFAULT_PROMPTS.DEFAULT_SYSTEM_PROMPT,
  proactive: DEFAULT_PROMPTS.DEFAULT_PROACTIVE_PROMPT,
  guided: DEFAULT_PROMPTS.DEFAULT_GUIDED_PROMPT,
  moderation: DEFAULT_PROMPTS.DEFAULT_MODERATION_PROMPT,
};

/**
 * The app's Create Agent dialog: the SDK's wizard with this app's identity,
 * options, trial gate, toasts and navigation plugged in.
 */
export function CreateMentorModal({
  isOpen,
  onClose,
  initialValues,
}: CreateMentorModalProps) {
  const { tenant } = useTenantKey();
  const tenantKey = tenant ?? '';
  const username = useUsername();
  const { navigateToMentor } = useNavigate();
  const pathname = usePathname();
  const isCreateMentorPage = pathname?.includes('/create-mentor') ?? false;
  const {
    FreeTrialDialog,
    closeModal: closeFreeTrialModal,
    isModalOpen: isFreeTrialModalOpen,
    executeWithTrialCheck,
  } = useShowFreeTrialDialog();
  // Set once the wizard navigated to the new agent, so a close that lands
  // before the route changes is dropped: the caller's onClose would navigate
  // again (the "+" menu's drops the modal param on the OLD route,
  // /create-mentor goes back).
  const navigatedAfterCreate = React.useRef(false);

  const handleBeforeCreate = () => {
    let proceed = false;
    executeWithTrialCheck(() => {
      proceed = true;
    });
    return proceed;
  };

  // Navigating away also closes the wizard: it is open only on the old route.
  const openAgent = (mentorId: string) => {
    navigatedAfterCreate.current = true;
    navigateToMentor(
      mentorId,
      undefined,
      isCreateMentorPage ? tenantKey || undefined : undefined,
    );
  };

  const handleClose = (mentorId: string | null) => {
    if (navigatedAfterCreate.current) return;
    if (mentorId) openAgent(mentorId);
    else onClose();
  };

  const handleError = (error: unknown) => {
    const errorMessage =
      (error as { error?: { error?: string } } | null)?.error?.error ||
      'Failed to create agent';
    toast.error(errorMessage);
    console.error(JSON.stringify({ tenant: tenantKey, error }));
  };

  return (
    <>
      {isOpen && (
        <React.Suspense fallback={null}>
          <CreateAgentWizardDialog
            org={tenantKey}
            username={username ?? ''}
            initialValues={initialValues}
            showBaseModel={config.showBaseMentor()}
            modelOptions={MODEL_AGENTS}
            defaultPrompts={DEFAULT_AGENT_PROMPTS}
            onBeforeCreate={handleBeforeCreate}
            onError={handleError}
            // The wizard keeps the person on the next steps; it opens the
            // new agent only once they finish or close it.
            onCreated={() => toast.success('Agent created successfully')}
            onFinish={openAgent}
            onClose={handleClose}
          />
        </React.Suspense>
      )}
      {isFreeTrialModalOpen && FreeTrialDialog && (
        <FreeTrialDialog
          isOpen={isFreeTrialModalOpen}
          onClose={closeFreeTrialModal}
        />
      )}
    </>
  );
}
