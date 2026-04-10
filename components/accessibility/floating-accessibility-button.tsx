'use client';

import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { useAccessibility } from '@/contexts/accessibility-contexts';

export function FloatingAccessibilityButton() {
  const { isToolbarOpen, setIsToolbarOpen } = useAccessibility();

  return (
    <Button
      onClick={() => setIsToolbarOpen(!isToolbarOpen)}
      className="h-14 w-14 rounded-full bg-[#38A1E5] shadow-lg transition-all duration-200 hover:scale-105 hover:bg-[#2E8BC7]"
      size="icon"
      aria-label="Open Accessibility Menu"
    >
      <Image
        src="/accessibility-icon.svg"
        alt="Accessibility"
        width={44}
        height={44}
        className="text-white"
      />
    </Button>
  );
}
