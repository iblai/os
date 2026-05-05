'use client';

import { Phone, Monitor, StopCircle } from 'lucide-react';

type ChatActionType = 'voice-call' | 'screen-share';

interface ChatActionBlockingOverlayProps {
  isOpen: boolean;
  actionType: ChatActionType;
  onStopScreenShare?: () => void;
}

export function ChatActionBlockingOverlay({
  isOpen,
  actionType,
  onStopScreenShare,
}: ChatActionBlockingOverlayProps) {
  if (!isOpen) return null;

  const isVoiceCall = actionType === 'voice-call';
  const actionLabel = isVoiceCall ? 'voice call' : 'screen sharing';
  const ActionIcon = isVoiceCall ? Phone : Monitor;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      style={{ zIndex: 9999 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="blocking-overlay-title"
      aria-describedby="blocking-overlay-description"
    >
      <div className="mx-4 max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
        {/* Icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-100">
          <ActionIcon className="h-10 w-10 text-blue-600" />
        </div>

        {/* Title */}
        <h2
          id="blocking-overlay-title"
          className="mb-3 text-xl font-semibold text-gray-900"
        >
          {isVoiceCall ? 'Voice Call Active' : 'Screen Sharing Active'}
        </h2>

        {/* Description */}
        <p id="blocking-overlay-description" className="mb-6 text-gray-600">
          Your {actionLabel} session is now active. Please return to the
          original window to continue your conversation with your agent.
        </p>

        {/* Action Buttons */}
        <div className="mb-4 flex flex-col gap-3">
          {/* Stop Screen Share Button */}
          {!isVoiceCall && onStopScreenShare && (
            <button
              onClick={onStopScreenShare}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3 font-medium text-white transition-colors hover:bg-red-700"
            >
              <StopCircle className="h-5 w-5" />
              <span>Stop Screen Sharing</span>
            </button>
          )}
        </div>

        {/* Instructions */}
        {/* <div className="flex items-center justify-center gap-2 rounded-lg bg-blue-50 px-4 py-3 text-blue-700">
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm font-medium">
            Switch back to the previous window
          </span>
        </div> */}

        {/* Additional help text */}
        <p className="mt-4 text-xs text-gray-500">
          This window will handle your {actionLabel} in the background. You can
          close this window when you&apos;re done.
        </p>
      </div>
    </div>
  );
}
