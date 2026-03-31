import { platform } from '@tauri-apps/plugin-os';
import { isTauriApp } from '@/types/tauri';

export const useOS = () => {
  let isAppleDevice = false;
  const isTauri = isTauriApp();
  console.log('[useOS] isTauriApp:', isTauri);
  try {
    if (isTauri) {
      const os = platform();
      console.log('[useOS] platform:', os);
      isAppleDevice = os === 'macos' || os === 'ios';
    }
  } catch (error) {
    console.error('[useOS] Error detecting platform:', error);
    isAppleDevice = false;
  }

  console.log('[useOS] isAppleDevice:', isAppleDevice);
  return {
    isAppleDevice,
  };
};
