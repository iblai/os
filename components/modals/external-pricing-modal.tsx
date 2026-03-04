'use client';

import React from 'react';
import { Modal } from '@/components/ui/modal';
import { useExternalPricingPlan } from '@iblai/iblai-js/web-utils';
import { config } from '@/lib/config';
import { getUserEmail } from '@/features/utils';
import { useAppSelector } from '@/lib/hooks';

interface ExternalPricingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ExternalPricingModal({ isOpen, onClose }: ExternalPricingModalProps) {
  const PRICING_URL = config.externalPricingPageUrl();
  const pricingModalData = useAppSelector((state) => state.subscription.pricingModalData);
  const { pricingBoxIframeRef } = useExternalPricingPlan({
    pricingModalData,
    userEmail: getUserEmail(),
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="mx-auto w-full max-w-[95vw] p-0"
      //maxWidth="1200px"
    >
      <div className="space-y-6">
        <div className="h-[70vh] w-full overflow-hidden rounded-lg border">
          <iframe
            src={PRICING_URL}
            title="IBL Pricing"
            className="h-full w-full border-0"
            allow="payment"
            ref={pricingBoxIframeRef}
          />
        </div>
      </div>
    </Modal>
  );
}
