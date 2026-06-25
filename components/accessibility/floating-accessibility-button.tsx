'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { useAccessibility } from '@/contexts/accessibility-contexts';

export function FloatingAccessibilityButton() {
  const t = useTranslations('accessibilityFloatingAccessibilityButton');
  const { isToolbarOpen, setIsToolbarOpen } = useAccessibility();

  return (
    <Button
      onClick={() => setIsToolbarOpen(!isToolbarOpen)}
      className="h-14 w-14 rounded-full bg-[#38A1E5] shadow-lg transition-all duration-200 hover:scale-105 hover:bg-[#2E8BC7]"
      size="icon"
      aria-label={t('openAccessibilityMenu')}
    >
      <Image
        src="/accessibility-icon.svg"
        alt={t('accessibilityIconAlt')}
        width={44}
        height={44}
        className="text-white"
      />
    </Button>
  );
}
