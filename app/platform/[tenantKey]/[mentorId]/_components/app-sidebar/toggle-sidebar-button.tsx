'use client';

import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

export function ToggleSidebarButton() {
  const { toggleSidebar, open, isMobile } = useSidebar();

  return (
    <Button
      size="icon"
      variant="ghost"
      className={cn('z-10 grid cursor-pointer place-items-center')}
      onClick={toggleSidebar}
    >
      <span className="sr-only">
        {open || isMobile ? 'Close sidebar' : 'Open sidebar'}
      </span>
      <Image
        src="/icons/close-sidebar.svg"
        alt="Toggle Sidebar"
        width={20}
        height={20}
        className="transform text-gray-500 duration-200 hover:rotate-180 hover:transition-transform"
      />
    </Button>
  );
}
