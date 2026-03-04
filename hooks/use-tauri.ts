/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference path="../types/tauri-api.d.ts" />
/* eslint-enable @typescript-eslint/triple-slash-reference */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { isTauriApp } from '@/types/tauri';

// Type definitions for Tauri APIs
type InvokeFn = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
type ListenFn = <T>(event: string, handler: (event: { payload: T }) => void) => Promise<() => void>;

interface TauriAPIs {
  invoke: InvokeFn;
  listen: ListenFn;
}

/**
 * Dynamically import Tauri APIs to avoid SSR issues
 */
const getTauriAPIs = async (): Promise<TauriAPIs | null> => {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const { listen } = await import('@tauri-apps/api/event');
    return { invoke, listen };
  } catch (error) {
    console.error('Failed to load Tauri APIs:', error);
    return null;
  }
};

/**
 * Synchronously check if Tauri is available (no async needed for global object)
 */
const checkTauriAvailableSync = (): boolean => {
  if (typeof window === 'undefined') return false;

  const inTauri = isTauriApp();
  if (!inTauri) return false;

  // Check for global Tauri object
  const tauriGlobal = (window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__;
  if (!tauriGlobal) return false;

  // Check if invoke is available
  const invoke =
    tauriGlobal.core?.invoke ||
    tauriGlobal.invoke ||
    tauriGlobal.tauri?.invoke ||
    tauriGlobal.plugins?.core?.invoke;

  return !!invoke;
};

/**
 * Synchronously get Tauri APIs from global object
 */
const getTauriAPIsSync = (): TauriAPIs | null => {
  if (typeof window === 'undefined') return null;

  const tauriGlobal = (window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__;
  if (!tauriGlobal) return null;

  const invoke =
    tauriGlobal.core?.invoke ||
    tauriGlobal.invoke ||
    tauriGlobal.tauri?.invoke ||
    tauriGlobal.plugins?.core?.invoke;
  const listen =
    tauriGlobal.event?.listen ||
    tauriGlobal.listen ||
    tauriGlobal.tauri?.listen ||
    tauriGlobal.plugins?.event?.listen;

  if (!invoke) return null;

  return {
    invoke: invoke as InvokeFn,
    listen: listen as ListenFn,
  };
};

/**
 * Hook to access Tauri APIs with SSR safety
 *
 * @returns Object with isAvailable flag and Tauri invoke/listen functions
 */
export function useTauri() {
  // Initialize with SYNCHRONOUS check - this ensures isAvailable is correct from first render
  const [isAvailable, setIsAvailable] = useState(() => checkTauriAvailableSync());
  const [apis, setApis] = useState<TauriAPIs | null>(() => getTauriAPIsSync());

  useEffect(() => {
    // If sync check already succeeded, no need to do anything in useEffect
    if (isAvailable && apis) {
      console.log(
        '[useTauri] ✓ Already initialized synchronously (invoke available from first render)',
      );
      return;
    }

    // Only run fallback if sync check failed
    const inTauri = isTauriApp();
    console.log(
      '[useTauri] Sync check failed, running fallback in useEffect. isTauriApp:',
      inTauri,
    );

    if (inTauri) {
      // Try dynamic import as fallback (unlikely to be needed)
      console.log('[useTauri] Attempting dynamic import fallback...');
      getTauriAPIs()
        .then((result) => {
          console.log('[useTauri] APIs loaded via dynamic import:', !!result);
          if (result) {
            setApis(result);
            setIsAvailable(true);
          }
        })
        .catch((error) => {
          console.error('[useTauri] Dynamic import fallback failed:', error);
        });
    }
  }, [isAvailable, apis]);

  /**
   * Invoke a Tauri command
   */
  const invoke = useCallback(
    async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
      if (!apis?.invoke) {
        throw new Error('Tauri is not available');
      }
      return apis.invoke<T>(command, args);
    },
    [apis],
  );

  /**
   * Listen to a Tauri event
   * Returns an unlisten function that should be called on cleanup
   */
  const listen = useCallback(
    async <T>(event: string, handler: (payload: T) => void): Promise<() => void> => {
      if (!apis?.listen) {
        throw new Error('Tauri is not available');
      }
      return apis.listen<T>(event, (e) => handler(e.payload));
    },
    [apis],
  );

  return {
    isAvailable,
    invoke,
    listen,
  };
}
