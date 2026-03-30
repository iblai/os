import { platform } from '@tauri-apps/plugin-os';
import { isTauriApp } from '@/types/tauri';

export const useOS = () => {
  let isAppleDevice = false;
  try {
    if (isTauriApp()) {
      const os = platform();
      isAppleDevice = os === 'macos' || os === 'ios';
    }
  } catch {
    isAppleDevice = false;
  }

  return {
    isAppleDevice,
  };
};
