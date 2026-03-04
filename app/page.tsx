'use client';

import { useEffect } from 'react';
import { Spinner } from '@/components/spinner';
import { hideInitialLoader } from '@/lib/initial-loader';

export default function Home() {
  useEffect(() => {
    hideInitialLoader();
  }, []);

  return (
    <div className="flex h-dvh w-screen items-center justify-center">
      <Spinner className="h-14 w-14" />
    </div>
  );
}
