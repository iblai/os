'use client';

import { useEffect, useState } from 'react';
import { isMobileOS } from '@/lib/utils';

export function useIsMobileOS(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    setIsMobile(isMobileOS());
  }, []);
  return isMobile;
}
