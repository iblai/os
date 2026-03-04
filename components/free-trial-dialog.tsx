import {
  Dialog,
  DialogTitle,
  DialogHeader,
  DialogContent,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Star } from 'lucide-react';
import { useAppDispatch } from '@/lib/hooks';
import { useAppSelector } from '@/lib/hooks';
import { MentorSubscriptionFlowV2 } from '@/hooks/subscription/subscription-flow-v2';
import { config } from '@/lib/config';
import { getUserEmail, getUserName } from '@/features/utils';
import { useUserTenants } from '@/hooks/use-user';
import { useCurrentTenant } from '@/hooks/use-user';
import { useSubscriptionHandlerV2 } from '@iblai/iblai-js/web-utils';
import {
  SUBSCRIPTION_DIALOG_BTN_LABELS,
  SUBSCRIPTION_DIALOG_TITLES,
} from '@/hooks/subscription/constants';
import { SUBSCRIPTION_USER_CAPABILITIES } from '@/features/subscription/constants';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export function FreeTrialDialog({ isOpen, onClose }: Props) {
  const dispatch = useAppDispatch();
  const topBannerOptions = useAppSelector((state) => state.topBanner.topBannerOptions);
  const subscriptionStatus = useAppSelector((state) => state.subscription.subscriptionStatus);
  const { currentTenant } = useCurrentTenant();
  const { userTenants } = useUserTenants();
  const subscriptionFlow = new MentorSubscriptionFlowV2({
    platformName: config.iblPlatform(),
    currentTenantKey: currentTenant?.key || '',
    username: getUserName(),
    currentTenantOrg: currentTenant?.org || '',
    userTenants,
    isAdmin: currentTenant?.is_admin || false,
    mainTenantKey: config.mainTenantKey(),
    dispatch,
    topBannerOptions,
    userEmail: getUserEmail(),
    mentorUrl: config.mentorUrl(),
  });
  const { bannerButtonTriggerCallback } = useSubscriptionHandlerV2(subscriptionFlow);

  const getDialogTitle = () => {
    return (
      SUBSCRIPTION_DIALOG_TITLES?.[
        subscriptionStatus.userCapability as keyof typeof SUBSCRIPTION_DIALOG_TITLES
      ] || SUBSCRIPTION_DIALOG_TITLES.FREE_TRIAL
    );
  };

  const getDialogContent = () => {
    switch (subscriptionStatus.userCapability) {
      case SUBSCRIPTION_USER_CAPABILITIES.FREE_PACKAGE:
        return (
          <>
            <p>
              You're currently using our free package with basic access to mentors and you've used
              all your credits.
            </p>
            <p>
              Upgrade to unlock unlimited chat time, custom data sources, and advanced mentor
              behaviors.
            </p>
            <p>
              For organizations needing enterprise solutions,{' '}
              <a className="cursor-pointer text-[#2563EB]" href="mailto:support@iblai.zendesk.com">
                contact our team
              </a>{' '}
              for special packages.
            </p>
          </>
        );
      case SUBSCRIPTION_USER_CAPABILITIES.STUDENT_UNDER_PAID_PACKAGE:
        return (
          <>
            <p>
              You're accessing premium features through your institution's subscription and you've
              used all your credits.
            </p>
            <p>
              Enjoy unlimited chat time and access to specialized mentors. Some advanced
              customization options may require additional permissions.
            </p>
            <p>
              For questions about your access or institutional features,{' '}
              <a className="cursor-pointer text-[#2563EB]" href="mailto:support@iblai.zendesk.com">
                contact support
              </a>
              .
            </p>
          </>
        );
      case SUBSCRIPTION_USER_CAPABILITIES.PAID_PACKAGE:
        return (
          <>
            <p>
              You've used all your available credits for this period. Your full access to premium
              features will renew on your next billing cycle.
            </p>
            <p>
              To continue creating custom mentors and accessing advanced features immediately, you
              can purchase additional credits or upgrade to a higher plan.
            </p>
            <p>
              For enterprise solutions or high-volume needs,{' '}
              <a className="cursor-pointer text-[#2563EB]" href="mailto:support@iblai.zendesk.com">
                contact our sales team
              </a>{' '}
              for customized options.
            </p>
          </>
        );
      default:
        return (
          <>
            <p>Upgrade to create your own mentors.</p>
            <p>
              Enjoy unlimited chat time, custom data sources, and create your own specialized
              mentors.
            </p>
            <p>
              For full enterprise control — trusted by leading universities and companies —{' '}
              <a className="cursor-pointer text-[#2563EB]" href="mailto:support@iblai.zendesk.com">
                contact our partnerships team.
              </a>
            </p>
          </>
        );
    }
  };

  const handleButtonClick = () => {
    const callback = bannerButtonTriggerCallback(subscriptionStatus.callToAction || '');
    callback?.();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="ibl-dialog-title space-x-1.5">
            <Button variant="outline" size="icon" className="rounded-full">
              <Star className="ibl-outline-primary" />
            </Button>
            <span>{getDialogTitle()}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="my-3 space-y-3 text-sm text-gray-600">{getDialogContent()}</div>
        <DialogFooter>
          <Button onClick={() => handleButtonClick()} className="ibl-button-primary cursor-pointer">
            {
              SUBSCRIPTION_DIALOG_BTN_LABELS[
                subscriptionStatus.userCapability as keyof typeof SUBSCRIPTION_DIALOG_BTN_LABELS
              ]
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
