'use client';

import { Menu } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useSidebar } from '@iblai/iblai-js/web-containers/next';

export function OpenSidebarMobileButton() {
  const { toggleSidebar, isMobile } = useSidebar();

  if (!isMobile) return null;

  return (
    <Button variant="ghost" size="icon" onClick={toggleSidebar}>
      <Menu />
    </Button>
  );
}
