'use client';

import { useEffect } from 'react';
import { setupChunkErrorRecovery } from '@/lib/chunk-retry';

/**
 * Installs global chunk load error recovery.
 * Renders nothing — purely a side-effect component.
 * Place early in the component tree (before ServiceWorkerProvider)
 * so it catches chunk errors during SW registration.
 */
export function ChunkErrorRecovery() {
  useEffect(() => {
    return setupChunkErrorRecovery();
  }, []);

  return null;
}
