import { getPlatform } from '@iblai/iblai-js/web-utils';

export const useOS = () => {
  let os: string | null = null;

  try {
    const platform = getPlatform();
    if (platform && typeof platform.getOS === 'function') {
      os = platform.getOS();
    }
  } catch {
    os = null;
  }

  const isAppleDevice = os === 'macos' || os === 'ios';

  return {
    os,
    isAppleDevice,
  };
};
