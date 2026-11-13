'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';
import {
  CreateAgentModal,
  type CreateAgentInitialValues,
  type CreatedAgent,
} from '@iblai/iblai-js/web-containers';
import { useShowFreeTrialDialog } from '@iblai/iblai-js/web-utils';

import { useTenantKey } from '@/hooks/use-tenants';
import { useUsername } from '@/hooks/use-user';
import { useNavigate } from '@/hooks/user-navigate';
import { config } from '@/lib/config';
import {
  DEFAULT_PROMPTS,
  MENTOR_VISIBILITY,
  MODEL_AGENTS,
} from '@/lib/constants';

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
 * The app's Create Agent dialog: the SDK's form with this app's identity,
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
  // Set when a create navigated away, so the close the SDK modal fires right
  // after it is dropped: the caller's onClose would navigate again (the "+"
  // menu's drops the modal param on the OLD route, /create-mentor goes back).
  const navigatedAfterCreate = React.useRef(false);

  const handleBeforeCreate = () => {
    let proceed = false;
    executeWithTrialCheck(() => {
      proceed = true;
    });
    return proceed;
  };

  const handleCreated = (mentor: CreatedAgent) => {
    toast.success('Agent created successfully');
    if (mentor?.unique_id) {
      navigatedAfterCreate.current = true;
      navigateToMentor(
        mentor.unique_id,
        undefined,
        isCreateMentorPage ? tenantKey || undefined : undefined,
      );
    }
  };

  const handleError = (error: unknown) => {
    const errorMessage =
      (error as { error?: { error?: string } } | null)?.error?.error ||
      'Failed to create agent';
    toast.error(errorMessage);
    console.error(JSON.stringify({ tenant: tenantKey, error }));
  };

  const handleClose = () => {
    if (navigatedAfterCreate.current) {
      navigatedAfterCreate.current = false;
      return;
    }
    onClose();
  };

  return (
    <>
      <CreateAgentModal
        isOpen={isOpen}
        onClose={handleClose}
        org={tenantKey}
        username={username ?? ''}
        initialValues={initialValues}
        showBaseModel={config.showBaseMentor()}
        modelOptions={MODEL_AGENTS}
        visibilityOptions={MENTOR_VISIBILITY}
        defaultPrompts={DEFAULT_AGENT_PROMPTS}
        onBeforeCreate={handleBeforeCreate}
        onCreated={handleCreated}
        onError={handleError}
      />
      {isFreeTrialModalOpen && FreeTrialDialog && (
        <FreeTrialDialog
          isOpen={isFreeTrialModalOpen}
          onClose={closeFreeTrialModal}
        />
      )}
    </>
  );
}
