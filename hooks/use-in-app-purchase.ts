import { invoke } from '@tauri-apps/api/core';
import { TAURI_COMMANDS } from '@/types/tauri';

export const useInAppPurchase = async () => {
  const allowed = await invoke<boolean>(TAURI_COMMANDS.ALLOW_IN_APP_PURCHASE);

  return {
    allowed,
  };
};
