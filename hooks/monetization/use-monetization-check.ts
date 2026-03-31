import { useCallback } from "react";
import { useAppDispatch } from "@/lib/hooks";
import {
  useLazyCheckAccessQuery,
  type AccessCheckResponse,
} from "@iblai/iblai-js/data-layer";
import {
  showMonetizationCheckoutModal,
  setDisplayMonetizationCheckoutModal,
} from "@/features/monetization/monetization-slice";
import { isLoggedIn } from "@/lib/utils";

export function useMonetizationCheck() {
  const dispatch = useAppDispatch();
  const [checkAccess] = useLazyCheckAccessQuery();

  const checkMentorAccess = useCallback(
    async (platformKey: string, mentorId: string) => {
      if (!isLoggedIn() || !platformKey || !mentorId) return;

      try {
        const result = await checkAccess(
          {
            platform_key: platformKey,
            item_type: "mentor",
            item_id: mentorId,
          },
          false,
        );
        console.log("[MONETIZATION] checkMentorAccess status: ", {
          error: result.isError,
          success: result.isSuccess,
        });
        if (
          result.isError &&
          !result.data?.has_access &&
          result.data?.pricing
        ) {
          dispatch(showMonetizationCheckoutModal(result));
        }
        if (result.isSuccess && result.data?.has_access) {
          handleUnsetDisplayMonetizationCheckoutModal();
        }
      } catch (error: unknown) {}
    },
    [checkAccess, dispatch],
  );

  const handleUnsetDisplayMonetizationCheckoutModal = useCallback(() => {
    dispatch(setDisplayMonetizationCheckoutModal(false));
  }, [dispatch]);

  return { checkMentorAccess, handleUnsetDisplayMonetizationCheckoutModal };
}
