import { useSearchParams } from 'next/navigation';

export function useEmbedMode() {
  const searchParams = useSearchParams();
  if (searchParams.get('embed') === 'true') return true;
  // `useSearchParams()` can momentarily return empty params (e.g. a
  // statically-prerendered first paint or a mid-navigation render), which
  // briefly flips embed mode OFF and flashes the full (non-embed) sidebar —
  // Projects / Notifications / Support — inside an iframe. Fall back to the
  // live URL on the client so embed mode stays correct from first paint.
  if (typeof window !== 'undefined') {
    return new URLSearchParams(window.location.search).get('embed') === 'true';
  }
  return false;
}
