'use client';

import { useEffect, useState } from 'react';
import AppLayout from '../../_components/app-layout';

export default function WorkflowsLayout({ children }: { children: React.ReactNode }) {
  const [defaultOpen, setDefaultOpen] = useState<boolean>(false);

  useEffect(() => {
    const getCookie = (name: string): string | undefined => {
      if (typeof document === 'undefined') return undefined;
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
      return undefined;
    };

    const sidebarState = getCookie('sidebar_state');
    setDefaultOpen(sidebarState === 'true');
  }, []);

  return <AppLayout defaultOpen={defaultOpen}>{children}</AppLayout>;
}
