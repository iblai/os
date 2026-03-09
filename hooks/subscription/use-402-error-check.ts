import { useAppDispatch } from '@/lib/hooks';
import { toast } from 'sonner';
import {
  setError402Detected,
  setPricingModalData,
  setOpenPricingModal,
} from '@/features/subscription/subscription-slice';
import { Error402MessageData } from '@iblai/iblai-js/web-utils';
import { getUserEmail } from '@/features/utils';
import { useCallback, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useIsAdmin } from '../use-user';
import { useOS } from '../use-os';
import { AppleRestrictionModal } from '@/components/modals/apple-restriction-modal';

export const use402ErrorCheck = () => {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const isAdmin = useIsAdmin();
  const { isAppleDevice } = useOS();
  const [isAppleRestrictionModalOpen, setIsAppleRestrictionModalOpen] = useState(false);

  const handle402Error = useCallback(
    async (messageData: Error402MessageData) => {
      toast.error(
        messageData.error ||
          messageData.message ||
          'Insufficient balance. Please add credits to continue.',
        {
          //duration: 1000 * 60 * 2, // 2 minutes
          closeButton: true,
        },
      );

      // Show Apple restriction modal for iOS/macOS users
      if (isAppleDevice) {
        setIsAppleRestrictionModalOpen(true);
        return;
      }

      if (isAdmin) {
        // Open the billing tab by injecting profileTab=billing query param
        const params = new URLSearchParams(searchParams.toString());
        params.set('profileTab', 'billing');
        router.push(`${pathname}?${params.toString()}`);
        return;
      }

      // If pricing_table data with publishable_key is available, display the pricing modal
      if (
        messageData.pricing_table?.pricing_table_id &&
        messageData.pricing_table.publishable_key
      ) {
        dispatch(
          setPricingModalData({
            referenceId: messageData.pricing_table.client_reference_id || '',
            customerEmail: getUserEmail() || '',
            publishableKey: messageData.pricing_table.publishable_key,
            pricingTableId: messageData.pricing_table.pricing_table_id,
          }),
        );
        dispatch(setOpenPricingModal(true));
        return;
      } else {

        //students use case
        dispatch(setError402Detected(new Date().toISOString()));
      }
    },
    [dispatch, pathname, router, searchParams, isAppleDevice],
  );

  return {
    handle402Error,
    isAppleRestrictionModalOpen,
    closeAppleRestrictionModal: () => setIsAppleRestrictionModalOpen(false),
    AppleRestrictionModal,
  };
};
