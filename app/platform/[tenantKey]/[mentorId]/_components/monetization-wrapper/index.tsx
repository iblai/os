"use client";

import { useParams } from "next/navigation";
import { isLoggedIn } from "@/lib/utils";
import { useCurrentTenant } from "@/hooks/use-user";
import { useCheckAccessQuery } from "@iblai/iblai-js/data-layer";
import type { TenantKeyMentorIdParams } from "@/lib/types";
import { useAppSelector } from "@/lib/hooks";
import { PaywallModal } from "./paywall-modal";

export function MonetizationWrapper() {
  const { currentTenant } = useCurrentTenant();
  const { mentorId, tenantKey } = useParams<TenantKeyMentorIdParams>();
  const platformKey = currentTenant?.key || tenantKey;
  const { displayMonetizationCheckoutModal, accessCheckResponse } =
    useAppSelector((state) => state.monetization);

  const { data, isLoading } = useCheckAccessQuery(
    {
      platform_key: platformKey,
      item_type: "mentor",
      item_id: mentorId,
    },
    {
      skip: !isLoggedIn() || !platformKey || !mentorId,
    },
  );

  const pricing = accessCheckResponse?.pricing ?? data?.pricing;

  const showModal =
    displayMonetizationCheckoutModal ||
    (data && !data.has_access && data.pricing_available && !!data.pricing);

  if (!showModal || !pricing) {
    if (isLoading) return null;
    return null;
  }

  return (
    <PaywallModal
      pricing={pricing}
      platformKey={platformKey}
      mentorId={mentorId}
    />
  );
}
