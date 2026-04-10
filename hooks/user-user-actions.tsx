import { useState } from 'react';
import { FreeTrialDialog as IblFreeTrialDialog } from '@/components/free-trial-dialog';
import { useAppDispatch } from '@/lib/hooks';
import { useAppSelector } from '@/lib/hooks';
import { setOpenAppleRestrictionModal } from '@/features/subscription/subscription-slice';
import { MentorSubscriptionFlowV2 } from '@/hooks/subscription/subscription-flow-v2';
import { config } from '@/lib/config';
import { getUserEmail, getUserName } from '@/features/utils';
import { useUserTenants } from '@/hooks/use-user';
import { useCurrentTenant } from '@/hooks/use-user';
import {
  SUBSCRIPTION_V2_TRIGGERS,
  useSubscriptionHandlerV2,
} from '@iblai/iblai-js/web-utils';
import { useOS } from '@/hooks/use-os';

// Custom hook to handle trial user actions
export const useShowFreeTrialDialog = (
  options = { modalComponent: null, enableFallbackModal: true },
) => {
  const subscriptionStatus = useAppSelector(
    (state) => state.subscription.subscriptionStatus,
  );
  const { currentTenant } = useCurrentTenant();
  const { userTenants } = useUserTenants();
  const dispatch = useAppDispatch();
  const topBannerOptions = useAppSelector(
    (state) => state.topBanner.topBannerOptions,
  );
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { isAppleDevice } = useOS();
  const FreeTrialDialog =
    options.modalComponent ||
    (options.enableFallbackModal ? IblFreeTrialDialog : null);

  const isNewlyUserOnPreFreeOrAdvertisingMode = (isAdminAction: boolean) =>
    (currentTenant?.key === config.mainTenantKey() ||
      currentTenant?.is_advertising) &&
    isAdminAction &&
    !currentTenant?.is_admin;

  const executeWithTrialCheck = (
    actionFn: () => unknown | Promise<unknown>,
    isAdminAction: boolean = true,
  ) => {
    if (
      (subscriptionStatus.creditExhausted && subscriptionStatus.callToAction) ||
      isNewlyUserOnPreFreeOrAdvertisingMode(isAdminAction)
    ) {
      if (isAppleDevice) {
        dispatch(setOpenAppleRestrictionModal(true));
        return null;
      }
      const callback = bannerButtonTriggerCallback(
        subscriptionStatus.callToAction ||
          SUBSCRIPTION_V2_TRIGGERS.PRICING_MODAL,
      );
      callback?.();
      //setIsModalOpen(true);
      return null;
    } else {
      return actionFn();
    }
  };

  return {
    executeWithTrialCheck,
    isModalOpen,
    closeModal: () => setIsModalOpen(false),
    FreeTrialDialog,
    isNewlyUserOnPreFreeOrAdvertisingMode,
  };
};

// Usage example:
// const { executeWithTrialCheck, isModalOpen, closeModal, ModalComponent } = useTrialUserAction();
// const result = executeWithTrialCheck(runSomeFunction, arg1, arg2);
