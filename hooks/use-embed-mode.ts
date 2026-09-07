import { useSearchParams } from 'next/navigation';

import { isEmbedMode } from '@/lib/embed-context';

export function useEmbedMode() {
  const searchParams = useSearchParams();
  if (searchParams.get('embed') === 'true') return true;
  // `useSearchParams()` can momentarily return empty params (e.g. a
  // statically-prerendered first paint or a mid-navigation render), and a
  // client-side navigation can land on a path that no longer carries the embed
  // param at all. Fall back to the live URL, then to the persisted embed
  // context, so embed mode stays correct for the iframe's whole lifetime.
  if (typeof window !== 'undefined') return isEmbedMode();
  return false;
}
