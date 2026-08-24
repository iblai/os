import { invoke } from '@tauri-apps/api/core';
import { isTauriApp, TAURI_COMMANDS } from '@/types/tauri';

export const useInAppPurchase = () => {
  const isInAppPurchaseAllowed = async () => {
    let isInAppPurchaseAllowed = false;
    try {
      if (isTauriApp()) {
        isInAppPurchaseAllowed = await invoke<boolean>(
          TAURI_COMMANDS.ALLOW_IN_APP_PURCHASE,
        );
      }
    } catch (error) {
      console.error(
        '[useInAppPurchase] Error checking in-app purchase:',
        error,
      );
      isInAppPurchaseAllowed = false;
    }
    return isInAppPurchaseAllowed;
  };

  return {
    isInAppPurchaseAllowed,
  };
};
