'use client';

import { SubscriptionTopBanner } from '@iblai/iblai-js/web-containers';
import { useIsPreviewMode } from '@/hooks/use-is-preview-mode';

/** The credits banner across the top of the app; off while previewing an agent. */
export function SubscriptionWrapper() {
  const isPreviewMode = useIsPreviewMode();
  return <SubscriptionTopBanner hidden={isPreviewMode} />;
}
