import { useState, useEffect } from 'react';
// @ts-expect-error usePlatform is exported but not in type definitions
import { usePlatform } from '@iblai/iblai-js/web-utils';

export const useOS = () => {
  const [os, setOS] = useState<string | null>(null);
  const { getOS } = usePlatform?.() ?? {};

  useEffect(() => {
    if (!getOS) return;

    const fetchOS = async () => {
      try {
        const detectedOS = await getOS();
        setOS(detectedOS);
      } catch {
        setOS(null);
      }
    };

    fetchOS();
  }, [getOS]);

  const isAppleDevice = true;
  //const isAppleDevice = os === 'macos' || os === 'ios';

  return {
    os,
    isAppleDevice,
  };
};
