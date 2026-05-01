'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  useParams,
  useRouter,
  useSearchParams,
  usePathname,
} from 'next/navigation';
import { UserProfileDropdown } from '@iblai/iblai-js/web-containers/next';
import {
  useCurrentTenant,
  useIsAdmin,
  useIsVisiting,
  useUserIsStudent,
  useUsername,
  useUserTenants,
  useVisitingTenant,
} from '@/hooks/use-user';
import { LearnerModeSwitch } from './learner-mode-switch';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { config } from '@/lib/config';
import { getUserEmail, getUserName } from '@/features/utils';
import { MentorSubscriptionFlowV2 } from '@/hooks/subscription/subscription-flow-v2';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import {
  useSubscriptionHandlerV2,
  SUBSCRIPTION_V2_TRIGGERS,
} from '@iblai/iblai-js/web-utils';
import {
  handleLogout,
  handleTenantSwitch,
  isStripeActivated,
  onAccountDeleted,
} from '@/lib/utils';
import { useTenantMetadata, Tenant } from '@iblai/iblai-js/web-utils';
import { UserApp } from '@iblai/iblai-api';
import {
  selectRbacPermissions,
  updateRbacPermissions,
} from '@/features/rbac/rbac-slice';
import { useModelDownload } from '@/hooks/use-model-download';

export function UserProfile() {
  const username = useUsername();
  const email = getUserEmail();
  const userIsAdmin = useIsAdmin();
  const userIsStudent = useUserIsStudent();
  const userIsVisiting = useIsVisiting();
  const params = useParams<TenantKeyMentorIdParams>();
  const tenantKey = params?.tenantKey || '';
  const mentorId = params?.mentorId || '';

  // URL sync for billing tab only
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [activeProfileTab, setActiveProfileTab] = useState<string>('basic');
  const isClosingRef = useRef(false);

  // Open modal from URL param on mount/URL change (billing tab only)
  useEffect(() => {
    // Don't reopen if we're in the process of closing
    if (isClosingRef.current) {
      return;
    }
    const tabParam = searchParams.get('profileTab');
    if (tabParam === 'billing' && !isProfileModalOpen) {
      setActiveProfileTab('billing');
      setIsProfileModalOpen(true);
    }
  }, [searchParams, isProfileModalOpen]);

  // Update URL when switching to/from billing tab
  const handleTabChange = useCallback(
    (tabId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tabId === 'billing') {
        // Set URL param for billing tab
        setActiveProfileTab('billing');
        params.set('profileTab', 'billing');
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      } else {
        // Clear URL param when leaving billing tab
        params.delete('profileTab');
        const newUrl = params.toString()
          ? `${pathname}?${params.toString()}`
          : pathname;
        router.replace(newUrl, { scroll: false });
      }
    },
    [searchParams, pathname, router],
  );

  // Handle modal open/close
  const handleModalOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        // Set flag to prevent useEffect from reopening
        isClosingRef.current = true;
        // Clear profileTab from URL when modal closes
        const params = new URLSearchParams(searchParams.toString());
        params.delete('profileTab');
        const newUrl = params.toString()
          ? `${pathname}?${params.toString()}`
          : pathname;
        router.replace(newUrl, { scroll: false });
        setActiveProfileTab('basic');
        // Reset flag after URL update has propagated
        setTimeout(() => {
          isClosingRef.current = false;
        }, 100);
      }
      setIsProfileModalOpen(open);
    },
    [searchParams, pathname, router],
  );

  const { currentTenant, saveCurrentTenant } = useCurrentTenant();
  const { userTenants = [], saveUserTenants } = useUserTenants();

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
    userEmail: getUserEmail(),
    dispatch,
    topBannerOptions,
    mentorUrl: config.mentorUrl(),
  });
  const {
    getBillingURL,
    getTopUpURL,
    getUserSubscriptionPackage,
    getUserActiveAppLegacy,
    bannerButtonTriggerCallback,
  } = useSubscriptionHandlerV2(subscriptionFlow);

  // Handle upgrade click - triggers the pricing modal
  const handleUpgradeClick = useCallback(() => {
    const triggerPricingModal = bannerButtonTriggerCallback(
      SUBSCRIPTION_V2_TRIGGERS.PRICING_MODAL,
    );
    triggerPricingModal();
    handleModalOpenChange(false);
  }, [bannerButtonTriggerCallback]);

  const [billingURL, setBillingURL] = useState<string>('');
  const [topUpURL, setTopUpURL] = useState<string>('');
  const [currentPlan, setCurrentPlan] = useState<string>('');
  const [userActiveApp, setUserActiveApp] = useState<UserApp | null>(null);

  const { metadata, metadataLoaded } = useTenantMetadata({
    org: tenantKey,
  });

  const rbacPermissions = useAppSelector(selectRbacPermissions);

  // Local LLM download hook for Tauri app
  const {
    isAvailable: isLocalLLMAvailable,
    state: localLLMState,
    ollamaStatus,
    startDownload,
    cancelDownload,
    installOllama,
    installFoundry,
    checkStatus,
    resetState,
    isUsingFoundry,
    foundryModels,
    selectedFoundryModel,
    foundryStatus,
    onSelectFoundryModel,
  } = useModelDownload();

  // TODO: The tenant provider already handles fetching tenant metadata and
  // syncing currentTenant/userTenants for anonymous-viewable mentors. This
  // effect is commented out so we can monitor whether removing the duplicate
  // fetch causes any regressions. If nothing breaks, delete this block.
  // useEffect(() => {
  //   if (!username || !tenantKey || !mentorPublicSettings) {
  //     return;
  //   }
  //
  //   const allowsAnonymousChat = mentorPublicSettings.allow_anonymous === true;
  //   const viewableByAnyone =
  //     mentorPublicSettings.mentor_visibility ===
  //     MentorVisibilityEnum.VIEWABLE_BY_ANYONE;
  //
  //   if (!allowsAnonymousChat || !viewableByAnyone) {
  //     return;
  //   }
  //
  //   const tenantAlreadyAdded = userTenants.some(
  //     (tenant) => tenant.key === tenantKey,
  //   );
  //
  //   if (tenantAlreadyAdded) {
  //     const existingTenant = userTenants.find(
  //       (tenant) => tenant.key === tenantKey,
  //     );
  //     if (existingTenant && currentTenant?.key !== tenantKey) {
  //       saveCurrentTenant(existingTenant);
  //     }
  //     return;
  //   }
  //
  //   if (loadingTenantInfo) {
  //     return;
  //   }
  //
  //   setLoadingTenantInfo(true);
  //   fetchTenantMetadata({ tenantKey })
  //     .unwrap()
  //     .then((metadata) => {
  //       const newTenant: Tenant = {
  //         key: tenantKey,
  //         org: tenantKey,
  //         is_admin: false,
  //         platform_name: metadata?.platform_name || tenantKey,
  //         name: metadata?.platform_name || tenantKey,
  //       };
  //
  //       const updatedTenants = [...userTenants, newTenant];
  //       saveUserTenants(updatedTenants);
  //       saveCurrentTenant(newTenant);
  //     })
  //     .catch((error) => {
  //       console.error('Failed to fetch tenant metadata', error);
  //     })
  //     .finally(() => {
  //       setLoadingTenantInfo(false);
  //     });
  // }, [
  //   currentTenant?.key,
  //   fetchTenantMetadata,
  //   loadingTenantInfo,
  //   mentorId,
  //   mentorPublicSettings,
  //   saveCurrentTenant,
  //   saveUserTenants,
  //   tenantKey,
  //   userTenants,
  //   username,
  // ]);
  const { visitingTenant } = useVisitingTenant();

  const handleGetSubscriptionRelatedData = async () => {
    if (isStripeActivated(currentTenant as Tenant) && currentTenant?.is_admin) {
      getUserActiveAppLegacy().then((app) => {
        setUserActiveApp(app as unknown as UserApp);
      });
      getUserSubscriptionPackage().then((plan) => {
        if (plan) {
          const splittedPlanName = String(plan).split('-');
          setCurrentPlan(splittedPlanName[splittedPlanName.length - 1]);
        }
      });
    }
  };

  const handleProfileClick = () => {
    // Trigger subscription data fetch when profile is opened
    handleGetSubscriptionRelatedData();
  };

  const handleTenantChange = (newTenantKey: string) => {
    handleTenantSwitch(newTenantKey);
  };

  const handleHelpClick = (url: string) => {
    window.open(url, '_blank');
  };

  const handleTenantUpdate = (tenant: Tenant) => {
    saveCurrentTenant(tenant);
    const updatedTenants = userTenants.map((t) => {
      if (t.key === tenant.key) {
        return tenant;
      } else {
        return t;
      }
    });
    saveUserTenants(updatedTenants);
  };

  const handleLoadGroupPermissions = (permissions: Record<string, unknown>) => {
    dispatch(updateRbacPermissions(permissions ?? {}));
  };

  return (
    <UserProfileDropdown
      email={email}
      mainPlatformKey={config.mainTenantKey()}
      // User data
      username={username || undefined}
      userIsAdmin={userIsAdmin}
      userIsStudent={userIsStudent}
      userIsVisiting={userIsVisiting}
      // Tenant data
      tenantKey={tenantKey || undefined}
      visitingTenant={visitingTenant}
      mentorId={mentorId || undefined}
      currentTenant={currentTenant || undefined}
      userTenants={userTenants || []}
      // Configuration
      showProfileTab={true}
      showAccountTab={false}
      showTenantSwitcher={userIsAdmin}
      showHelpLink={true}
      showLogoutButton={true}
      showLearnerModeSwitch={userIsAdmin && tenantKey !== 'main'}
      // Customization
      helpCenterUrl={config.helpCenterUrl()}
      enableGravatarOnProfilePic={
        config.enableGravatarOnProfilePic() !== 'false'
      }
      // Callbacks
      onProfileClick={handleProfileClick}
      onTabChange={handleTabChange}
      onBillingTabRequest={handleGetSubscriptionRelatedData}
      onLogout={handleLogout}
      onTenantChange={handleTenantChange}
      onHelpClick={handleHelpClick}
      // Modal props
      currentPlan={currentPlan}
      userActiveApp={userActiveApp}
      // Custom components
      LearnerModeSwitchComponent={LearnerModeSwitch}
      currentSPA={config.iblPlatform() || 'mentor'}
      // Additional data
      metadata={metadata}
      metadataLoaded={metadataLoaded}
      authURL={config.authUrl()}
      onTenantUpdate={handleTenantUpdate}
      currentPlatformBaseDomain={config.platformBaseDomain()}
      rbacPermissions={rbacPermissions}
      enableRbac={config.enableRBAC()}
      onLoadGroupPermissions={handleLoadGroupPermissions}
      // Local LLM props
      localLLMProps={{
        isAvailable: isLocalLLMAvailable,
        state: localLLMState,
        ollamaStatus,
        isUsingFoundry,
        foundryModels,
        selectedFoundryModel,
        foundryStatus,
        onStartDownload: startDownload,
        onCancelDownload: cancelDownload,
        onInstallOllama: installOllama,
        onInstallFoundry: installFoundry,
        onCheckStatus: checkStatus,
        onResetState: resetState,
        onSelectFoundryModel,
      }}
      // Controlled modal state for URL sync
      isModalOpen={isProfileModalOpen}
      onModalOpenChange={handleModalOpenChange}
      defaultActiveTab={activeProfileTab}
      onAccountDeleted={() => onAccountDeleted()}
      enableMemoryTab={true}
    />
  );
}
