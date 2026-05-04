import { useTopTrialBanner } from '@/hooks/use-top-trial-banner';
import { TopTrialBannerProps } from '@/lib/types';
import React from 'react';

export function TopTrialBanner({
  parentContainer,
  bannerText = 'Upgrade to create your own agents. No credit card required 😎',
  onUpgrade,
  loading = false,
  tooltipText = 'Upgrade to create your own agents. No credit card required 😎',
}: TopTrialBannerProps) {
  const {
    visible,
    setVisible,
    bannerButtonTriggerHandler,
    showTooltip,
    setShowTooltip,
    bannerRef,
    isLoading,
  } = useTopTrialBanner({
    parentContainer,
    onUpgrade,
    loading,
    tooltipText,
  });

  if (!visible) return null;

  return (
    <div
      ref={bannerRef}
      className="relative z-50 flex min-h-[48px] w-full items-center justify-center bg-gradient-to-r from-blue-700 to-blue-400 px-2 py-2 text-sm text-white"
    >
      {/* Centered content group, responsive and wrapping, with right padding only at max-w-500px */}
      <div className="xs:max-w-[500px] mx-auto flex w-full items-center justify-center gap-2 pr-2 text-center md:pr-12">
        {/* Info Icon with Tooltip */}
        <div
          className="relative flex flex-shrink-0 items-center"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <svg
            className="h-5 w-5 cursor-pointer text-white opacity-80"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M12 16v-4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="12" cy="8.5" r="1" fill="currentColor" />
          </svg>
          {showTooltip && (
            <div className="absolute top-full left-1/2 z-50 mt-2 -translate-x-1/2 rounded bg-gray-900 px-3 py-1 text-xs whitespace-nowrap text-white shadow-lg">
              {tooltipText}
            </div>
          )}
        </div>
        <span className="ml-2 max-w-[250px] font-medium break-words text-white sm:max-w-none">
          {bannerText}
        </span>
        {/* Upgrade button: icon-only on mobile, text on md+ */}
        <button
          className="ml-4 block flex-shrink-0 rounded-full border border-white/70 bg-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-white transition hover:bg-white/10 sm:hidden"
          aria-label="Upgrade"
          onClick={isLoading ? () => {} : () => bannerButtonTriggerHandler()}
          disabled={isLoading}
          style={{ position: 'relative', minWidth: '40px', minHeight: '32px' }}
        >
          {loading ? (
            <span className="mx-auto flex h-5 w-5 items-center justify-center">
              <svg
                className="animate-spin"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="white"
                  strokeWidth="4"
                  opacity="0.2"
                />
                <path
                  d="M12 2a10 10 0 0 1 10 10"
                  stroke="white"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          ) : (
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 12h14M12 5l7 7-7 7"
              />
            </svg>
          )}
        </button>
        <button
          className="ml-4 hidden flex-shrink-0 rounded-full border border-white/70 bg-transparent px-4 py-1 text-sm font-medium whitespace-nowrap text-white transition hover:bg-white/10 sm:block"
          onClick={isLoading ? () => {} : () => bannerButtonTriggerHandler()}
          disabled={isLoading}
          style={{ position: 'relative', minWidth: '80px', minHeight: '32px' }}
        >
          {loading ? (
            <span className="mx-auto flex h-5 w-5 items-center justify-center">
              <svg
                className="animate-spin"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="white"
                  strokeWidth="4"
                  opacity="0.2"
                />
                <path
                  d="M12 2a10 10 0 0 1 10 10"
                  stroke="white"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          ) : (
            'Upgrade'
          )}
        </button>
      </div>
      {/* Close button at the right edge */}
      <button
        className="absolute top-1/2 right-0 rounded-full p-1 transition hover:bg-white/20 md:right-4"
        aria-label="Close banner"
        onClick={() => setVisible(false)}
        style={{ transform: 'translateY(-50%)' }}
      >
        <svg
          className="h-5 w-5 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
      {/* Add spinner animation style */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}

export default TopTrialBanner;
