import {
  Dialog,
  DialogTitle,
  DialogHeader,
  DialogContent,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('freeTrialDialog');
  const dispatch = useAppDispatch();
  const topBannerOptions = useAppSelector(
    (state) => state.topBanner.topBannerOptions,
  );
  const subscriptionStatus = useAppSelector(
    (state) => state.subscription.subscriptionStatus,
  );
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
  const { bannerButtonTriggerCallback } =
    useSubscriptionHandlerV2(subscriptionFlow);

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
            <p>{t('freePackageLine1')}</p>
            <p>{t('freePackageLine2')}</p>
            <p>
              {t('freePackageLine3Before')}{' '}
              <a
                className="cursor-pointer text-[#2563EB]"
                href="mailto:support@iblai.zendesk.com"
              >
                {t('contactOurTeam')}
              </a>{' '}
              {t('freePackageLine3After')}
            </p>
          </>
        );
      case SUBSCRIPTION_USER_CAPABILITIES.STUDENT_UNDER_PAID_PACKAGE:
        return (
          <>
            <p>{t('studentPackageLine1')}</p>
            <p>{t('studentPackageLine2')}</p>
            <p>
              {t('studentPackageLine3Before')}{' '}
              <a
                className="cursor-pointer text-[#2563EB]"
                href="mailto:support@iblai.zendesk.com"
              >
                {t('contactSupport')}
              </a>
              .
            </p>
          </>
        );
      case SUBSCRIPTION_USER_CAPABILITIES.PAID_PACKAGE:
        return (
          <>
            <p>{t('paidPackageLine1')}</p>
            <p>{t('paidPackageLine2')}</p>
            <p>
              {t('paidPackageLine3Before')}{' '}
              <a
                className="cursor-pointer text-[#2563EB]"
                href="mailto:support@iblai.zendesk.com"
              >
                {t('contactOurSalesTeam')}
              </a>{' '}
              {t('paidPackageLine3After')}
            </p>
          </>
        );
      default:
        return (
          <>
            <p>{t('defaultLine1')}</p>
            <p>{t('defaultLine2')}</p>
            <p>
              {t('defaultLine3Before')}{' '}
              <a
                className="cursor-pointer text-[#2563EB]"
                href="mailto:support@iblai.zendesk.com"
              >
                {t('contactOurPartnershipsTeam')}
              </a>
            </p>
          </>
        );
    }
  };

  const handleButtonClick = () => {
    const callback = bannerButtonTriggerCallback(
      subscriptionStatus.callToAction || '',
    );
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
        <div className="my-3 space-y-3 text-sm text-gray-600">
          {getDialogContent()}
        </div>
        <DialogFooter>
          <Button
            onClick={() => handleButtonClick()}
            className="ibl-button-primary cursor-pointer"
          >
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
