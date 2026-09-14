'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ChatPhase } from '@iblai/iblai-js/web-utils';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { CSS_CLASS_NAMES } from '@/lib/constants';
import { cn } from '@/lib/utils';

/**
 * How long a turn may run without producing answer tokens before we swap in
 * the "still working" reassurance copy. Long agentic turns are exactly the
 * case where users assume the app has hung.
 */
export const LONG_TURN_REASSURANCE_DELAY_MS = 20_000;

/**
 * How long the streamed answer may sit unchanged, while the phase is still
 * `writing`, before the line comes back with the reassurance copy.
 *
 * Deliberately shorter than `LONG_TURN_REASSURANCE_DELAY_MS`: 20s is the budget
 * for a turn that has shown *nothing at all*, whereas 15s covers text that was
 * visibly moving and then stopped — the user is already watching it, so the
 * tolerable silence is shorter.
 */
export const STALLED_STREAM_DELAY_MS = 15_000;

/**
 * Minimum gap between two announcements in the live region. A tool-heavy turn
 * can emit phases far faster than a screen reader can speak them, so the label
 * settles at most once per interval.
 */
export const PHASE_ANNOUNCE_THROTTLE_MS = 2_000;

type Props = {
  /** Current phase of the in-flight turn, straight from `useAdvancedChat`. */
  phase: ChatPhase;
  /**
   * True when a disclosure row in the same bubble already states this exact
   * phase (the reasoning row for `thinking`, the tool row for `tool`). The
   * caller owns those rows so it owns this computation, but the decision to
   * hide lives here — see the note on the component about staying mounted.
   */
  restatedByVisibleRow?: boolean;
  /**
   * The assistant text streamed into this bubble so far. Read only as a
   * token-arrival signal: while it keeps changing the answer is visibly moving,
   * and when it stops changing the turn has stalled. `undefined` for the
   * pre-token placeholder, which has no bubble content at all.
   */
  content?: string;
  className?: string;
};

/**
 * `prefers-reduced-motion: reduce` as a boolean. Read through `matchMedia` (not
 * only the Tailwind `motion-reduce:` variant) so the shimmer can be swapped for
 * flat muted text rather than merely frozen — a stopped gradient behind
 * `color: transparent` glyphs can render the label invisible.
 */
function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(query.matches);

    const onChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return prefersReducedMotion;
}

/**
 * Persistent "the agent is working" indicator anchored at the bottom of the
 * in-progress response's bubble: a quiet line of shimmering text, no icon and
 * no Stop control — the composer owns Stop, and two of them on screen at once
 * read as a bug. Renders nothing once the turn ends: the hook drives every terminal
 * condition (eos, stop, error, typed error, socket close) back to
 * `{ kind: 'idle' }`, so there is no path that leaves this shimmering.
 *
 * Governing principle: show the status line only when nothing else on screen is
 * conveying progress. Every hide case is decided *inside* this component and
 * expressed as a `null` return, never by the caller unmounting it — the stall
 * timer below has to keep running precisely while the line is invisible.
 */
export function WorkingIndicator({
  phase,
  restatedByVisibleRow = false,
  content,
  className,
}: Props) {
  const t = useTranslations('chatWorkingIndicator');
  const prefersReducedMotion = usePrefersReducedMotion();

  const isActive = phase.kind !== 'idle';
  // Answer tokens are arriving, so the user can see progress for themselves —
  // the reassurance copy is only for turns that look stalled.
  const isWriting = phase.kind === 'writing';
  // `writing` alone is not enough to stand down: the phase flips off the socket
  // frame, and there is a brief window before the first token renders into the
  // bubble. Only once there is genuinely something to watch does the text take
  // over as the progress indicator.
  const isStreamOnScreen = isWriting && (content ?? '').trim().length > 0;

  const [showReassurance, setShowReassurance] = useState(false);

  useEffect(() => {
    if (!isActive || isWriting) {
      setShowReassurance(false);
      return;
    }

    const timer = setTimeout(
      () => setShowReassurance(true),
      LONG_TURN_REASSURANCE_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [isActive, isWriting]);

  // The phase sticks at `writing` after the last token — it only moves when
  // some other signal arrives — so a mid-turn grind looks identical to a
  // healthy stream from the phase alone. The content clock is what separates
  // them, and it is why this component must not be unmounted while hidden.
  const isStreamStalled =
    useStalledStream(content, isActive, isWriting) && isStreamOnScreen;

  const label = useThrottledPhaseLabel(phaseLabel(phase, t), isActive);

  // Nothing to add: the turn is over, a visible row already says this, or the
  // answer text is moving on its own.
  if (
    !isActive ||
    restatedByVisibleRow ||
    (isStreamOnScreen && !isStreamStalled)
  ) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="chat-working-indicator"
      // Layout-neutral on purpose: the indicator now lives inside an agent
      // message bubble (either the streaming one or the placeholder), so the
      // surrounding frame owns the spacing and the caller tops it up.
      className={cn(
        'text-sm',
        CSS_CLASS_NAMES.CHAT.WORKING_INDICATOR,
        className,
      )}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-block w-fit',
              prefersReducedMotion
                ? 'text-muted-foreground'
                : 'ibl-text-shimmer motion-reduce:animate-none',
            )}
          >
            {showReassurance || isStreamStalled ? t('stillWorking') : label}
          </span>
        </TooltipTrigger>
        <TooltipContent className="ibl-tooltip-content max-w-xs">
          {t('tooltip')}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

/**
 * True once the streamed content has gone `STALLED_STREAM_DELAY_MS` without
 * changing. The whole string is the dependency rather than its length: content
 * can be rewritten in place (artifact edits) as well as appended to, and any
 * change at all counts as a sign of life.
 *
 * `isWriting` is a dependency too, so the window is measured from whichever
 * came last — the newest token or the moment the turn started writing. Without
 * it, a turn that spent a minute in a tool call would come back from that call
 * already declared stalled.
 */
function useStalledStream(
  content: string | undefined,
  isActive: boolean,
  isWriting: boolean,
): boolean {
  const [isStalled, setIsStalled] = useState(false);

  useEffect(() => {
    // Every fresh token restarts the clock; a finished turn stops it.
    setIsStalled(false);
    if (!isActive) return;

    const timer = setTimeout(() => setIsStalled(true), STALLED_STREAM_DELAY_MS);
    return () => clearTimeout(timer);
  }, [content, isActive, isWriting]);

  return isStalled;
}

/**
 * Maps a phase onto a user-visible label. Every arm goes through i18n and any
 * phase we do not have specific copy for falls back to the generic "Working…".
 */
function phaseLabel(
  phase: ChatPhase,
  t: ReturnType<typeof useTranslations<'chatWorkingIndicator'>>,
): string {
  switch (phase.kind) {
    case 'thinking':
      return t('thinking');
    case 'tool':
      return t('usingTool', { toolName: phase.name });
    case 'writing':
      return t('writing');
    case 'workflow':
      return phase.detail
        ? t('workflowDetail', { detail: phase.detail })
        : t('workflow');
    case 'file':
      if (phase.fileName && phase.total) {
        return t('processingFileProgress', {
          fileName: phase.fileName,
          current: phase.current ?? 1,
          total: phase.total,
        });
      }
      return phase.fileName
        ? t('processingFile', { fileName: phase.fileName })
        : t('working');
    case 'media':
      return phase.medium === 'image'
        ? t('generatingImage')
        : t('generatingVideo');
    default:
      return t('working');
  }
}

/**
 * Holds a label steady for at least `PHASE_ANNOUNCE_THROTTLE_MS` so a
 * tool-heavy turn does not flood the `aria-live` region (criterion: polite and
 * throttled, never assertive). The newest label always wins once the window
 * elapses, so the indicator never settles on a stale phase.
 */
function useThrottledPhaseLabel(label: string, isActive: boolean): string {
  const [announced, setAnnounced] = useState(label);
  const lastChangeAt = useRef(0);

  useEffect(() => {
    if (!isActive) {
      // A finished turn resets the window so the next turn announces at once.
      lastChangeAt.current = 0;
      setAnnounced(label);
      return;
    }

    const elapsed = Date.now() - lastChangeAt.current;
    if (elapsed >= PHASE_ANNOUNCE_THROTTLE_MS) {
      lastChangeAt.current = Date.now();
      setAnnounced(label);
      return;
    }

    const timer = setTimeout(() => {
      lastChangeAt.current = Date.now();
      setAnnounced(label);
    }, PHASE_ANNOUNCE_THROTTLE_MS - elapsed);
    return () => clearTimeout(timer);
  }, [label, isActive]);

  return announced;
}
