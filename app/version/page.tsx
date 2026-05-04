'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { Version } from '@/components/version';
import { appVersion } from '@/lib/version';
import { hideInitialLoader } from '@/lib/initial-loader';

const logo = (
  <Image
    src="/iblai-logo.png"
    alt="ibl.ai"
    width={43}
    height={19}
    className="mx-2 mb-1 h-4 w-auto"
  />
);
export default function AppVersion() {
  useEffect(() => {
    hideInitialLoader();
  }, []);

  return <Version appName="Agent" appVersion={appVersion} poweredBy={logo} />;
}
