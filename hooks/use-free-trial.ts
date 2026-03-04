import { config } from "@/lib/config";
import { useCurrentTenant } from "./use-user";

import { useGetAllTenants } from "./use-user";

export const useFreeTrial = () => {
  const { currentTenant } = useCurrentTenant();
  const allTenants = useGetAllTenants();

  const userOnFreeTrial = () => {
    return (
      currentTenant?.key === config.mainTenantKey() && //USER IS ON MAIN TENANT
      !currentTenant?.is_admin && //USER IS NOT ADMIN
      allTenants?.length === 1
    ); //USER IS ON ONLY ONE TENANT
  };

  return {
    userOnFreeTrial,
  };
};
