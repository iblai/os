'use client';

import { TopBanner } from '@iblai/iblai-js/web-containers';
import { useSubscriptionV2 } from '@/hooks/subscription/use-subscription-v2';
import { useSubscriptionHandlerV2 } from '@iblai/iblai-js/web-utils';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import { useState, useEffect } from 'react';
import { getUserEmail, getUserName } from '@/features/utils';
import { config } from '@/lib/config';
import { useUserTenants } from '@/hooks/use-user';
import { useCurrentTenant } from '@/hooks/use-user';
import { MentorSubscriptionFlowV2 } from '@/hooks/subscription/subscription-flow-v2';
import { useIsPreviewMode } from '@/hooks/use-is-preview-mode';

export function MentorECommerceWrapper() {
  const isPreviewMode = useIsPreviewMode();
  useSubscriptionV2();
  const { currentTenant } = useCurrentTenant();
  const { userTenants } = useUserTenants();
  const dispatch = useAppDispatch();
  const topBannerOptions = useAppSelector((state) => state.topBanner.topBannerOptions);
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
  const { bannerButtonTriggerCallback } = useSubscriptionHandlerV2(subscriptionFlow);
  const [initialStyles, setInitialStyles] = useState<{
    sideBarWrapper?: { maxHeight: string; top: string; position: string };
    mainContentContainer?: { position: string; top: string };
    sidebarContainer?: { top: string; height: string };
    sidebarInset?: { top: string; height: string };
    body?: { overflow: string };
  }>({});

  useEffect(() => {
    const sideBarWrapper = document.querySelector('[data-slot="sidebar-wrapper"]') as HTMLElement;
    const mainContentContainer = document.querySelector(
      '#main-content-container > div',
    ) as HTMLElement;
    const sidebarContainer = document.querySelector(
      '[data-slot="sidebar-container"]',
    ) as HTMLElement;
    const sidebarInset = document.querySelector('[data-slot="sidebar-inset"]') as HTMLElement;
    const body = document.querySelector('body') as HTMLElement;

    setInitialStyles({
      sideBarWrapper: sideBarWrapper
        ? {
            maxHeight: sideBarWrapper.style.maxHeight,
            top: sideBarWrapper.style.top,
            position: sideBarWrapper.style.position,
          }
        : undefined,
      mainContentContainer: mainContentContainer
        ? {
            position: mainContentContainer.style.position,
            top: mainContentContainer.style.top,
          }
        : undefined,
      sidebarContainer: sidebarContainer
        ? {
            top: sidebarContainer.style.top,
            height: sidebarContainer.style.height,
          }
        : undefined,
      sidebarInset: sidebarInset
        ? {
            top: sidebarInset.style.top,
            height: sidebarInset.style.height,
          }
        : undefined,
      body: body
        ? {
            overflow: body.style.overflow,
          }
        : undefined,
    });
  }, []);

  function handleTopBannerLoad(bannerRef: HTMLDivElement) {
    if (bannerRef) {
      const topBannerContainerHeight = bannerRef.clientHeight;
      const sideBarWrapper = document.querySelector('[data-slot="sidebar-wrapper"]') as HTMLElement;
      if (sideBarWrapper) {
        sideBarWrapper.style.maxHeight = `calc(100vh - ${topBannerContainerHeight}px)`;
        sideBarWrapper.style.top = `3px`;
        sideBarWrapper.style.position = `relative`;
      }
      const mainContentContainer = document.querySelector(
        '#main-content-container > div',
      ) as HTMLElement;
      if (mainContentContainer) {
        mainContentContainer.style.position = `relative`;
        mainContentContainer.style.top = `-12px`;
      }
      const sidebarContainer = document.querySelector(
        '[data-slot="sidebar-container"]',
      ) as HTMLElement;
      if (sidebarContainer) {
        sidebarContainer.style.top = `48px`;
        sidebarContainer.style.height = `calc(100% - ${topBannerContainerHeight}px)`;
      }
      const sidebarInset = document.querySelector('[data-slot="sidebar-inset"]') as HTMLElement;
      if (sidebarInset) {
        sidebarInset.style.height = `calc(100dvh - ${topBannerContainerHeight}px)`;
      }
      const body = document.querySelector('body') as HTMLElement;
      if (body) {
        body.style.overflow = 'hidden';
      }
    }
  }

  const handleTopBannerClose = () => {
    const sideBarWrapper = document.querySelector('[data-slot="sidebar-wrapper"]') as HTMLElement;
    if (sideBarWrapper && initialStyles.sideBarWrapper) {
      sideBarWrapper.style.maxHeight = initialStyles.sideBarWrapper.maxHeight;
      sideBarWrapper.style.top = initialStyles.sideBarWrapper.top;
      sideBarWrapper.style.position = initialStyles.sideBarWrapper.position;
    }

    const mainContentContainer = document.querySelector(
      '#main-content-container > div',
    ) as HTMLElement;
    if (mainContentContainer && initialStyles.mainContentContainer) {
      mainContentContainer.style.position = initialStyles.mainContentContainer.position;
      mainContentContainer.style.top = initialStyles.mainContentContainer.top;
    }

    const sidebarContainer = document.querySelector(
      '[data-slot="sidebar-container"]',
    ) as HTMLElement;
    if (sidebarContainer && initialStyles.sidebarContainer) {
      sidebarContainer.style.top = initialStyles.sidebarContainer.top;
      sidebarContainer.style.height = initialStyles.sidebarContainer.height;
    }
    const sidebarInset = document.querySelector('[data-slot="sidebar-inset"]') as HTMLElement;
    if (sidebarInset && initialStyles.sidebarInset) {
      sidebarInset.style.height = initialStyles.sidebarInset.height;
    }
    const body = document.querySelector('body') as HTMLElement;
    if (body) {
      body.style.overflow = initialStyles.body?.overflow || 'auto';
    }
  };

  if (isPreviewMode) return null;

  return (
    <>
      {topBannerOptions?.enabled && (
        <TopBanner
          parentContainerSelector=".mentor-parent-container"
          bannerText={topBannerOptions.bannerText}
          buttonHandler={bannerButtonTriggerCallback(topBannerOptions?.onUpgrade || '')}
          buttonLabel={topBannerOptions?.buttonLabel || 'Upgrade'}
          loading={topBannerOptions.loading}
          tooltipText={topBannerOptions.tooltipText}
          onLoad={handleTopBannerLoad}
          onClose={handleTopBannerClose}
        />
      )}
    </>
  );
}
