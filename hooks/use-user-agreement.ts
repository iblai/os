import { useState, useCallback } from 'react';
import { useGetDisclaimersQuery, useAgreeToDisclaimerMutation } from '@iblai/iblai-js/data-layer';
import { useUsername } from './use-user';
import { useParams } from 'next/navigation';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { toast } from 'sonner';
import { DEFAULT_DISCLAIMER_CONTENT } from '@/constants/disclaimer';

export function useUserAgreement() {
  const username = useUsername();
  const { mentorId, tenantKey } = useParams<TenantKeyMentorIdParams>();

  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);
  const [userHasAgreedToDisclaimer, setUserHasAgreedToDisclaimer] = useState(false);
  const [pendingSubmitContent, setPendingSubmitContent] = useState<string>('');
  const [isAgreeing, setIsAgreeing] = useState(false);

  const { data: disclaimers, isLoading: isDisclaimersLoading } = useGetDisclaimersQuery(
    {
      org: tenantKey,
      userId: username ?? '',
      params: {
        mentor_id: mentorId,
        scope: 'mentor',
      },
    },
    {
      skip: !mentorId || !tenantKey || !username,
    },
  );

  const [agreeToDisclaimer] = useAgreeToDisclaimerMutation();

  const userAgreementRecord =
    disclaimers?.results?.length && disclaimers?.results?.length > 0
      ? disclaimers?.results[0]
      : null;

  const userAgreement =
    userAgreementRecord ??
    ({
      content: DEFAULT_DISCLAIMER_CONTENT,
      active: false,
    } as const);

  const hasUserAgreement = Boolean(userAgreementRecord?.active);
  const hasUserAgreedToDisclaimer = userAgreementRecord?.has_agreed || userHasAgreedToDisclaimer;

  const handleDisclaimerAgree = useCallback(async () => {
    if (!userAgreementRecord?.id) {
      console.error('No user agreement ID available');
      return;
    }

    try {
      setIsAgreeing(true);

      await agreeToDisclaimer({
        org: tenantKey,
        userId: username ?? '',
        formData: {
          disclaimer: userAgreementRecord.id,
        },
      }).unwrap();

      setUserHasAgreedToDisclaimer(true);
      setShowDisclaimerModal(false);
      toast.success('User Agreement accepted');
    } catch (error) {
      console.error('Failed to agree to user agreement:', error);
      toast.error('Failed to update user agreement status');
      console.error(JSON.stringify({ tenant: tenantKey, error }));
    } finally {
      setIsAgreeing(false);
    }
  }, [userAgreementRecord?.id, agreeToDisclaimer, tenantKey, username]);

  const checkAgreementAndExecute = useCallback(
    (content: string, executeCallback: (content: string) => void) => {
      if (!hasUserAgreement) {
        // No user agreement required, execute immediately
        executeCallback(content);
        return;
      }

      if (!hasUserAgreedToDisclaimer) {
        // User hasn't agreed to disclaimer, show modal
        setPendingSubmitContent(content);
        setShowDisclaimerModal(true);
        return;
      }

      // User has agreed, execute immediately
      executeCallback(content);
    },
    [hasUserAgreement, hasUserAgreedToDisclaimer],
  );

  const executePendingSubmit = useCallback(
    (executeCallback: (content: string) => void) => {
      const content = pendingSubmitContent;
      if (content.length > 0) {
        setPendingSubmitContent('');
        executeCallback(content);
      }
    },
    [pendingSubmitContent],
  );

  return {
    // State
    showDisclaimerModal,
    setShowDisclaimerModal,
    isAgreeing,
    pendingSubmitContent,

    // Data
    userAgreement,
    hasUserAgreement,
    hasUserAgreedToDisclaimer,
    isDisclaimersLoading,

    // Actions
    handleDisclaimerAgree,
    checkAgreementAndExecute,
    executePendingSubmit,
  };
}
