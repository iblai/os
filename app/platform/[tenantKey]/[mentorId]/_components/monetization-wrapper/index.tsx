'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useCurrentTenant } from '@/hooks/use-user';
import type { TenantKeyMentorIdParams } from '@/lib/types';
import { useAppSelector } from '@/lib/hooks';
import { TopBanner } from '@iblai/iblai-js/web-containers';
import { useIsPreviewMode } from '@/hooks/use-is-preview-mode';
import { PaywallModal } from '@iblai/iblai-js/web-containers';

export function MonetizationWrapper() {
  const isPreviewMode = useIsPreviewMode();
  const { currentTenant } = useCurrentTenant();
  const { mentorId, tenantKey } = useParams<TenantKeyMentorIdParams>();
  const platformKey = currentTenant?.key || tenantKey;
  const { displayMonetizationCheckoutModal, accessCheckResponse } =
    useAppSelector((state) => state.monetization);

  const pricing = accessCheckResponse?.pricing;

  const needsPurchase = displayMonetizationCheckoutModal && !!pricing;

  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (displayMonetizationCheckoutModal) {
      setModalOpen(true);
    } else {
      handleTopBannerClose();
    }
  }, [displayMonetizationCheckoutModal]);

  const [initialStyles, setInitialStyles] = useState<{
    sideBarWrapper?: { maxHeight: string; top: string; position: string };
    mainContentContainer?: { position: string; top: string };
    sidebarContainer?: { top: string; height: string };
    sidebarInset?: { top: string; height: string };
    body?: { overflow: string };
  }>({});

  useEffect(() => {
    const sideBarWrapper = document.querySelector(
      '[data-slot="sidebar-wrapper"]',
    ) as HTMLElement;
    const mainContentContainer = document.querySelector(
      '#main-content-container > div',
    ) as HTMLElement;
    const sidebarContainer = document.querySelector(
      '[data-slot="sidebar-container"]',
    ) as HTMLElement;
    const sidebarInset = document.querySelector(
      '[data-slot="sidebar-inset"]',
    ) as HTMLElement;
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

  const handleTopBannerLoad = useCallback((bannerRef: HTMLDivElement) => {
    if (!bannerRef) return;
    const topBannerContainerHeight = bannerRef.clientHeight;
    const sideBarWrapper = document.querySelector(
      '[data-slot="sidebar-wrapper"]',
    ) as HTMLElement;
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
    const sidebarInset = document.querySelector(
      '[data-slot="sidebar-inset"]',
    ) as HTMLElement;
    if (sidebarInset) {
      sidebarInset.style.height = `calc(100dvh - ${topBannerContainerHeight}px)`;
    }
    const body = document.querySelector('body') as HTMLElement;
    if (body) {
      body.style.overflow = 'hidden';
    }
  }, []);

  const handleTopBannerClose = useCallback(() => {
    const sideBarWrapper = document.querySelector(
      '[data-slot="sidebar-wrapper"]',
    ) as HTMLElement;
    if (sideBarWrapper && initialStyles.sideBarWrapper) {
      sideBarWrapper.style.maxHeight = initialStyles.sideBarWrapper.maxHeight;
      sideBarWrapper.style.top = initialStyles.sideBarWrapper.top;
      sideBarWrapper.style.position = initialStyles.sideBarWrapper.position;
    }
    const mainContentContainer = document.querySelector(
      '#main-content-container > div',
    ) as HTMLElement;
    if (mainContentContainer && initialStyles.mainContentContainer) {
      mainContentContainer.style.position =
        initialStyles.mainContentContainer.position;
      mainContentContainer.style.top = initialStyles.mainContentContainer.top;
    }
    const sidebarContainer = document.querySelector(
      '[data-slot="sidebar-container"]',
    ) as HTMLElement;
    if (sidebarContainer && initialStyles.sidebarContainer) {
      sidebarContainer.style.top = initialStyles.sidebarContainer.top;
      sidebarContainer.style.height = initialStyles.sidebarContainer.height;
    }
    const sidebarInset = document.querySelector(
      '[data-slot="sidebar-inset"]',
    ) as HTMLElement;
    if (sidebarInset && initialStyles.sidebarInset) {
      sidebarInset.style.height = initialStyles.sidebarInset.height;
    }
    const body = document.querySelector('body') as HTMLElement;
    if (body) {
      body.style.overflow = initialStyles.body?.overflow || 'auto';
    }
  }, [initialStyles]);

  const handleModalClose = () => {
    setModalOpen(false);
  };

  const handleBannerButtonClick = () => {
    setModalOpen(true);
  };

  if (isPreviewMode) return null;
  if (!needsPurchase) return null;

  return (
    <>
      <TopBanner
        parentContainerSelector=".mentor-parent-container"
        bannerText="This mentor requires a purchase to use."
        buttonHandler={handleBannerButtonClick}
        buttonLabel="Purchase"
        loading={false}
        onLoad={handleTopBannerLoad}
        onClose={handleTopBannerClose}
      />
      <PaywallModal
        open={modalOpen}
        onClose={handleModalClose}
        pricing={pricing}
        platformKey={platformKey}
        itemId={mentorId}
        itemType="mentor"
      />
    </>
  );
}
