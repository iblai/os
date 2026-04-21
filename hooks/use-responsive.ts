'use client';

import { useState, useEffect } from 'react';

// Custom hook for responsive design that considers container width
export const useResponsive = (containerRef?: React.RefObject<HTMLElement>) => {
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [screenSize, setScreenSize] = useState<'sm' | 'md' | 'lg' | 'xl'>('xl');

  useEffect(() => {
    const checkScreenSize = () => {
      // Get the actual available width considering sidebars
      const availableWidth = containerRef?.current
        ? containerRef.current.getBoundingClientRect().width
        : window.innerWidth;
      const nextWidth = Math.round(availableWidth);
      setContainerWidth((prevWidth) =>
        prevWidth === nextWidth ? prevWidth : nextWidth,
      );

      // Adjust breakpoints based on actual available space
      let nextScreenSize: 'sm' | 'md' | 'lg' | 'xl';
      if (nextWidth < 640) {
        nextScreenSize = 'sm';
      } else if (nextWidth < 900) {
        // Increased from 768 to account for sidebars
        nextScreenSize = 'md';
      } else if (nextWidth < 1200) {
        // Increased from 1024 to account for sidebars
        nextScreenSize = 'lg';
      } else {
        nextScreenSize = 'xl';
      }

      setScreenSize((prevScreenSize) =>
        prevScreenSize === nextScreenSize ? prevScreenSize : nextScreenSize,
      );
    };

    checkScreenSize();
    const observedElement = containerRef?.current;
    let resizeObserver: ResizeObserver | null = null;
    if (observedElement && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => checkScreenSize());
      resizeObserver.observe(observedElement);
    }

    window.addEventListener('resize', checkScreenSize);

    return () => {
      window.removeEventListener('resize', checkScreenSize);
      resizeObserver?.disconnect();
    };
  }, [containerRef]);

  return {
    isMobile: screenSize === 'sm',
    isTablet: screenSize === 'md',
    isLaptop: screenSize === 'lg',
    isDesktop: screenSize === 'xl',
    screenSize,
    containerWidth,
  };
};
