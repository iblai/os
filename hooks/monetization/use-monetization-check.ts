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
        const result = await checkAccess({
          platform_key: platformKey,
          item_type: "mentor",
          item_id: mentorId,
        }).unwrap();

        if (!result.has_access && result.pricing) {
          dispatch(showMonetizationCheckoutModal(result));
        } else {
          dispatch(setDisplayMonetizationCheckoutModal(false));
        }
      } catch (error: unknown) {
        const err = error as { status?: number; data?: AccessCheckResponse };
        console.log("[MONETIZATION] Error checking mentor access", {
          error,
        });
        if (err?.status === 402 && err.data?.pricing) {
          dispatch(showMonetizationCheckoutModal(err.data));
        } else {
          dispatch(setDisplayMonetizationCheckoutModal(false));
        }
      }
    },
    [checkAccess, dispatch],
  );

  return { checkMentorAccess };
}
