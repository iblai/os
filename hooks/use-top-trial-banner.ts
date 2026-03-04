import { setOpenPricingModal } from "@/features/subscription/subscription-slice";
import { TRIGGERS } from "@/features/top-banner/constants";
import { TopTrialBannerProps } from "@/lib/types";
import { useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
export const useTopTrialBanner = ({
  parentContainer,
  onUpgrade,
  loading,
}: TopTrialBannerProps) => {
  const dispatch = useDispatch();
  const [visible, setVisible] = useState(true);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isLoading, setLoading] = useState(loading);
  const bannerRef = useRef<HTMLDivElement>(null);
  const prevParentHeight = useRef<string | null>(null);
  const parentElRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setLoading(loading);
  }, [loading]);

  useEffect(() => {
    if (!visible) return;
    const parentEl = document.querySelector(parentContainer) as HTMLElement;
    if (!parentEl) return;
    parentElRef.current = parentEl as HTMLElement;

    function updateParentHeight() {
      if (!bannerRef.current || !parentEl) return;
      const bannerHeight = bannerRef.current.offsetHeight;
      parentEl.style.height = `calc(100vh - ${bannerHeight}px)`;
    }

    // Save previous height to restore on unmount
    prevParentHeight.current = parentEl.style.height;
    updateParentHeight();

    // Listen for resize
    const resizeObserver = new window.ResizeObserver(updateParentHeight);
    if (bannerRef.current) {
      resizeObserver.observe(bannerRef.current);
    }
    window.addEventListener("resize", updateParentHeight);

    return () => {
      if (resizeObserver && bannerRef.current) {
        resizeObserver.unobserve(bannerRef.current);
      }
      window.removeEventListener("resize", updateParentHeight);
      // Restore previous height
      if (parentElRef.current && prevParentHeight.current !== null) {
        parentElRef.current.style.height = prevParentHeight.current;
      }
    };
  }, [parentContainer, visible]);

  const handlePricingModalTrigger = () => {
    dispatch(setOpenPricingModal(true));
  };

  const bannerButtonTriggerHandler = () => {
    switch (onUpgrade) {
      case TRIGGERS.PRICING_MODAL:
        handlePricingModalTrigger();
        break;
      case TRIGGERS.SUBSCRIBE_USER:
        alert("in");
        break;
      default:
      //do nothing
    }
  };

  return {
    bannerButtonTriggerHandler,
    visible,
    setVisible,
    showTooltip,
    setShowTooltip,
    bannerRef,
    parentElRef,
    isLoading,
    setLoading,
  };
};
