import { platform } from '@tauri-apps/plugin-os';
import { isTauriApp } from '@/types/tauri';
import { useState, useEffect } from 'react';

export const useOS = () => {
  const [isAppleDevice, setIsAppleDevice] = useState(false);
  useEffect(() => {
    const isTauri = isTauriApp();
    console.log('[useOS] isTauriApp:', isTauri);
    try {
      if (isTauri) {
        const os = platform();
        console.log('[useOS] platform:', os);
        setIsAppleDevice(os === 'macos' || os === 'ios');
      }
    } catch (error) {
      console.error('[useOS] Error detecting platform:', error);
      setIsAppleDevice(false);
    }
  }, []);
  return {
    isAppleDevice,
  };
};
