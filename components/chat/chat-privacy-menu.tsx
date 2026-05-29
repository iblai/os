'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useSelector } from 'react-redux';
import {
  selectNumberOfActiveChatMessages,
  selectSessionId,
} from '@iblai/iblai-js/web-utils';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useUsername } from '@/hooks/use-user';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { useChatPrivacy } from '@/hooks/use-chat-privacy';
import { TempChatIcon } from './temp-chat-icon';

interface ChatPrivacyToggleProps {
  className?: string;
}

/**
 * Single icon button anchored to the chat top-right. Drives the whole
 * temporary-chat / disable-history flow with four distinct visual states:
 *
 *  1. Empty conversation, **normal mode** → inactive icon (#28a8a0).
 *     Click flips temporary mode on (no confirm — the chat hasn't started).
 *  2. Empty conversation, **temporary mode** → active icon (#6eabdf).
 *     Click flips it back off. Free toggle until the user sends.
 *  3. After-send, session **started as temporary** → label mode. The button
 *     becomes a static "Temporary chat" badge with the active icon. There's
 *     nothing to undo — the user committed to a private session by sending.
 *  4. After-send, session was **normal** at send time → inactive icon.
 *     Click opens a confirm dialog (one-way warning), confirm calls the
 *     disable API. After that the icon flips active, and pressing again
 *     attempts to revert (`disable_chathistory: false`) so the user can
 *     turn temporary mode back off.
 */
export function ChatPrivacyToggle({ className }: ChatPrivacyToggleProps) {
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const username = useUsername();
  const sessionId = useSelector(selectSessionId) as string | undefined;
  const messageCount = useSelector(selectNumberOfActiveChatMessages) as number;

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  // Sticky for the lifetime of the chat surface. Flipped true the moment the
  // user confirms the mid-conversation disable dialog. Distinguishes a
  // session that started private (label mode, state 3) from one that was
  // disabled mid-conversation (state 4 — keeps toggling).
  const [disabledMidConversation, setDisabledMidConversation] =
    React.useState(false);

  const {
    featureEnabled,
    effective,
    startPrivateChat,
    disableChatHistory,
    isStartingPrivateChat,
    isDisablingChatHistory,
  } = useChatPrivacy({
    org: tenantKey,
    userId: username ?? undefined,
    mentor: mentorId,
    session: sessionId || undefined,
  });

  if (!featureEnabled || !tenantKey || !mentorId || !username) return null;

  const isPrivate = effective.mode === 'disabled';
  const hasMessages = messageCount > 0;
  const isBusy = isStartingPrivateChat || isDisablingChatHistory;

  // State 3 — session was private *before* sending the first message and
  // now has messages. Becomes a static label, not a button.
  const isPostSendTemporary =
    isPrivate && hasMessages && !disabledMidConversation;
  // State 0 — the mentor itself has chat history turned off
  // (mentor-level kill switch). `is_locked: true` paired with the disabled
  // mode means the user can't change anything here; we just surface the
  // same "Temporary chat" label so they can see why nothing is being saved.
  const isMentorLocked = effective.is_locked && isPrivate;
  const showStaticLabel = isMentorLocked || isPostSendTemporary;

  /* --- Static "Temporary chat" label (mentor lock OR post-send private) --- */
  if (showStaticLabel) {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm',
          className,
        )}
        aria-label="Temporary chat — this conversation will not be saved to history."
      >
        <TempChatIcon active className="h-5 w-5" />
        <span>Temporary chat</span>
      </div>
    );
  }

  /* --- Button click handler covering states 1, 2, 4 --------------------- */
  const handleClick = async () => {
    if (isBusy) return;

    // State 1 — empty + normal → start a private session.
    if (!isPrivate && !hasMessages) {
      const newId = await startPrivateChat();
      if (newId) {
        toast.success(
          "Temporary chat started. This conversation won't be saved to history.",
        );
      } else {
        toast.error('Could not start a temporary chat. Please try again.');
      }
      return;
    }

    // State 2 — empty + private → revert to normal (free toggle pre-send).
    if (isPrivate && !hasMessages) {
      const ok = await disableChatHistory(false);
      if (ok) {
        toast.success('Temporary chat turned off.');
      } else {
        toast.error('Could not turn temporary chat off. Please try again.');
      }
      return;
    }

    // State 4a — normal + has messages → open confirmation first.
    if (!isPrivate && hasMessages) {
      setConfirmOpen(true);
      return;
    }

    // State 4b — private + has messages + disabledMidConversation flag
    // set → user wants to re-enable history.
    const ok = await disableChatHistory(false);
    if (ok) {
      setDisabledMidConversation(false);
      toast.success('Chat history re-enabled for this conversation.');
    } else {
      toast.error(
        "Couldn't re-enable chat history on this conversation. Start a new chat instead.",
      );
    }
  };

  const handleConfirmMidSession = async () => {
    setConfirmOpen(false);
    const ok = await disableChatHistory(true);
    if (ok) {
      setDisabledMidConversation(true);
      toast.success(
        'Chat history disabled. This conversation has been removed from your history.',
      );
    } else {
      toast.error('Failed to disable chat history. Please try again.');
    }
  };

  const tooltipText = isPrivate
    ? 'Temporary chat is on. Click to turn it off.'
    : hasMessages
      ? 'Disable chat history for this conversation.'
      : "Start a temporary chat that won't be saved to history.";

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleClick}
              disabled={isBusy}
              aria-label={tooltipText}
              aria-pressed={isPrivate}
              className={cn(
                'h-10 w-10 rounded-full border border-gray-200 bg-white shadow-sm hover:bg-gray-50',
                className,
              )}
            >
              {isBusy ? (
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              ) : (
                <TempChatIcon active={isPrivate} className="h-6 w-6" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="ibl-tooltip-content">
            {tooltipText}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable chat history?</AlertDialogTitle>
            <AlertDialogDescription>
              This conversation will be removed from your history and the
              assistant will stop using earlier turns from this chat. You can
              still turn it back on for new messages — but anything already in
              the saved history will not be restored.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDisablingChatHistory}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmMidSession();
              }}
              disabled={isDisablingChatHistory}
            >
              {isDisablingChatHistory ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Disabling…
                </>
              ) : (
                'Disable chat history'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
