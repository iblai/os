'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { OnboardingWizard } from '@iblai/iblai-js/web-containers';

import { Spinner } from '@/components/spinner';
import { hideInitialLoader } from '@/lib/initial-loader';
import { useOnboardingAccess } from '@/hooks/use-onboarding';
import { useUsername } from '@/hooks/use-user';
import { OnboardingCreateAgentStep } from '@/components/onboarding/onboarding-create-agent-step';

/**
 * The `/onboarding` route renders the SDK onboarding wizard
 * (`@iblai/iblai-js/web-containers`). The app supplies identity (tenant +
 * username) and the create-agent final step; the wizard persists the answers
 * itself (under the user's platform metadata `onboarding` key) since no
 * `onAnswersSubmit` is passed. On completion it redirects to an agent's explore
 * page. It performs NO automatic redirects into onboarding; access gating is
 * wired up elsewhere. While the current tenant resolves, a brief loader shows.
 */
export default function OnboardingPage() {
  const { tenantKey } = useOnboardingAccess();
  const username = useUsername();
  const router = useRouter();

  useEffect(() => {
    hideInitialLoader();
  }, []);

  if (!tenantKey) {
    return (
      <div className="flex h-dvh w-screen items-center justify-center">
        <Spinner className="h-14 w-14" />
      </div>
    );
  }

  return (
    <OnboardingWizard
      tenant={tenantKey}
      username={username ?? ''}
      onComplete={(agentId) =>
        router.push(
          agentId
            ? `/platform/${tenantKey}/${agentId}/explore`
            : `/platform/${tenantKey}/explore`,
        )
      }
      renderFinalStep={(context) => <OnboardingCreateAgentStep {...context} />}
    />
  );
}
