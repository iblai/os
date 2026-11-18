'use client';

import { useSearchParams } from 'next/navigation';

import { isChromeExtensionClient } from '@/lib/embed-client';
import { useInExtensionPanel } from '@/hooks/use-in-extension-panel';

/**
 * Whether this app is running inside the ibl.ai Chrome extension.
 *
 * The panel says so with `client=chrome-extension`, sent through
 * `<agent-ai extraparams>`. Panels installed before that are recognised by
 * their Cowork flag, which only the extension sets today — right in practice,
 * the wrong question in principle, and it goes once those have updated.
 *
 * Decisions that belong to the surface rather than to a feature — no
 * organization switching, an agent the organization bound to the panel — ask
 * this, never the Cowork flag.
 */
export function useInChromeExtension(): boolean {
  const searchParams = useSearchParams();
  const coworkPanel = useInExtensionPanel();

  return isChromeExtensionClient(searchParams) || coworkPanel;
}
