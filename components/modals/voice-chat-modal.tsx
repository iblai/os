'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { UIEvent } from 'react';

import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import type { TranscriptEntry } from '@/hooks/use-livekit-transcription';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  PhoneOff,
  Loader2,
  Captions,
  CaptionsOff,
} from 'lucide-react';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

type ConnectionState =
  | 'requesting-permission'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

/**
 * Three animations, all tied to a fact about the call: the mentor is speaking,
 * the caller is speaking, or a word is still being transcribed. The old
 * indicator ran nine — drifting particles, five sound-wave bars and two
 * competing pulses — none of which meant anything on their own.
 */
const callAnimations = `
  @keyframes voiceRingPulse {
    0%, 100% { transform: scale(1); opacity: 0.5; }
    50% { transform: scale(1.05); opacity: 0.9; }
  }

  @keyframes voiceRingRipple {
    0% { transform: scale(0.98); opacity: 0.55; }
    70% { opacity: 0.1; }
    100% { transform: scale(1.35); opacity: 0; }
  }

  @keyframes voiceHalo {
    0%, 100% { transform: scale(1); opacity: 0.55; }
    50% { transform: scale(1.08); opacity: 0.8; }
  }

  @keyframes transcriptCaret {
    0%, 45% { opacity: 1; }
    50%, 95% { opacity: 0.15; }
    100% { opacity: 1; }
  }
`;

/**
 * Captions are on unless the user turns them off, and that choice follows them
 * from call to call. A single stringly-typed flag is enough.
 */
const CAPTIONS_PREFERENCE_STORAGE_KEY = 'ibl.voiceChat.captionsEnabled';

const CAPTIONS_ON_BY_DEFAULT = true;

/** How close to the bottom still counts as "reading the live line". */
const CAPTION_BOTTOM_SLACK_PX = 8;

/**
 * One bubble per turn, not per transcription segment.
 *
 * LiveKit hands back an utterance in pieces: a single agent reply routinely
 * arrives as several entries, and a caller who pauses mid-sentence produces
 * two. Rendered raw that is a wall of one-line bubbles, each with its own
 * avatar and name, splitting sentences at whatever moment the recogniser
 * happened to flush. Consecutive entries from the same speaker are one turn,
 * and the turn is what the transcript shows.
 *
 * The turn carries the id of its first entry — stable while the turn grows,
 * so React keeps the same node — and the finality of its last, since a turn is
 * still being spoken until its final piece is.
 *
 * Exported so the rule can be unit-tested without a DOM.
 */
export interface TranscriptTurn {
  id: string;
  speaker: TranscriptEntry['speaker'];
  text: string;
  isFinal: boolean;
  participantName?: string;
}

export function groupTranscriptTurns(
  entries: TranscriptEntry[],
): TranscriptTurn[] {
  const turns: TranscriptTurn[] = [];

  for (const entry of entries) {
    const current = turns[turns.length - 1];

    if (current && current.speaker === entry.speaker) {
      // A segment boundary is not a sentence boundary: join with a space and
      // let the paragraph wrap as one.
      current.text = `${current.text} ${entry.text}`.trim();
      current.isFinal = entry.isFinal;
      current.participantName =
        current.participantName ?? entry.participantName;
      continue;
    }

    turns.push({
      id: entry.id,
      speaker: entry.speaker,
      text: entry.text,
      isFinal: entry.isFinal,
      participantName: entry.participantName,
    });
  }

  return turns;
}

/**
 * Only an explicit "false" turns captions off: storage is a nicety, never a
 * dependency — server rendering has no `window`, Safari's private mode throws
 * on access, and a value from some future version may be neither of ours. All
 * three fall back to the default rather than to silence.
 *
 * Exported so the no-`window` path can be exercised directly — it is
 * unreachable through a rendered component, which needs a DOM to exist.
 */
export function readCaptionsPreference(): boolean {
  if (typeof window === 'undefined') return CAPTIONS_ON_BY_DEFAULT;
  try {
    return (
      window.localStorage.getItem(CAPTIONS_PREFERENCE_STORAGE_KEY) !== 'false'
    );
  } catch {
    return CAPTIONS_ON_BY_DEFAULT;
  }
}

export function writeCaptionsPreference(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      CAPTIONS_PREFERENCE_STORAGE_KEY,
      enabled ? 'true' : 'false',
    );
  } catch {
    // A storage failure only costs us the memory of the choice; the toggle
    // itself keeps working for the rest of this call.
  }
}

/**
 * `m:ss`, and `h:mm:ss` once a call runs past the hour — the format every
 * phone uses, so it needs no explaining and no translating.
 *
 * Exported to be tested directly; it is pure arithmetic and does not deserve a
 * rendered component.
 */
export function formatCallDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  const paddedSeconds = String(seconds).padStart(2, '0');

  if (hours === 0) return `${minutes}:${paddedSeconds}`;
  return `${hours}:${String(minutes).padStart(2, '0')}:${paddedSeconds}`;
}

/** Two letters is what the chat's own avatars fall back to. */
function initialsOf(name: string): string {
  return name.trim().substring(0, 2).toUpperCase();
}

interface VoiceChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Toggles the user's own microphone (outbound audio). */
  toggleMicMute: () => void;
  isMicMuted: boolean;
  /** Toggles playback of the mentor's voice (inbound audio). */
  toggleMentorAudio: () => void;
  isMentorAudioMuted: boolean;
  connectionState: ConnectionState;
  /** Whether the user is currently speaking. */
  isSpeaking: boolean;
  /** Whether the mentor agent is currently speaking. */
  isMentorSpeaking: boolean;
  /** Accumulated call transcript, oldest first. */
  transcript?: TranscriptEntry[];
  /** Display name of the mentor, used to label its transcript lines. */
  mentorName?: string;
  /** Mentor avatar, so a captioned turn looks like the chat it becomes. */
  mentorImage?: string;
}

export function VoiceChatModal({
  isOpen,
  onClose,
  toggleMicMute,
  isMicMuted,
  toggleMentorAudio,
  isMentorAudioMuted,
  connectionState,
  isSpeaking,
  isMentorSpeaking,
  transcript = [],
  mentorName,
  mentorImage,
}: VoiceChatModalProps) {
  const t = useTranslations('modalsVoiceChatModal');
  const isLoading =
    connectionState === 'requesting-permission' ||
    connectionState === 'connecting';
  const isConnected = connectionState === 'connected';
  // The sound of the call belongs to the mentor, so the avatar is the call:
  // its ring lights up while the agent is audible, and drains when silenced.
  const isMentorVoiceActive = isMentorSpeaking && !isMentorAudioMuted;
  // The caller's own voice is shown on the caller's own control, not on the
  // mentor's face — two speakers, two places, no competing halos.
  const isUserVoiceActive = isSpeaking && !isMicMuted;

  const mentorLabel = mentorName || t('transcriptSpeakerAgent');

  const loadingMessage = isLoading
    ? connectionState === 'requesting-permission'
      ? t('requestingMicrophoneAccess')
      : t('connectingToVoiceChat')
    : null;

  // --- Call duration ------------------------------------------------------
  // A call with no clock feels like a page; a clock makes it a call. It only
  // runs while the call is up and resets with the connection, so a reconnect
  // never leaves a stale number ticking.
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isConnected) {
      setElapsedSeconds(0);
      return;
    }

    const startedAt = Date.now();
    setElapsedSeconds(0);
    const tick = window.setInterval(
      () => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)),
      1000,
    );
    return () => window.clearInterval(tick);
  }, [isConnected]);

  // --- Captions ----------------------------------------------------------
  // On by default: a call is captioned unless the user has turned them off.
  // The stored preference is read after mount so the server-rendered markup
  // and the first client render agree, and the default is what renders in the
  // meantime — a caller who kept captions never sees them flash away.
  const [areCaptionsVisible, setAreCaptionsVisible] = useState(
    CAPTIONS_ON_BY_DEFAULT,
  );

  useEffect(() => {
    setAreCaptionsVisible(readCaptionsPreference());
  }, []);

  const toggleCaptions = useCallback(() => {
    const next = !areCaptionsVisible;
    setAreCaptionsVisible(next);
    writeCaptionsPreference(next);
  }, [areCaptionsVisible]);

  // The whole call, in order: a transcript that only kept the last exchange
  // made you take the conversation on trust the moment it moved on.
  const visibleCaptions = groupTranscriptTurns(transcript);

  // The band follows the live line the way a terminal follows output: pinned
  // to the bottom while new words arrive, released the moment the reader
  // scrolls up to re-read the start of a long turn, and re-pinned when they
  // come back down.
  const captionScrollRef = useRef<HTMLDivElement | null>(null);
  const [isFollowingLive, setIsFollowingLive] = useState(true);
  const newestCaptionId = visibleCaptions[visibleCaptions.length - 1]?.id;

  // A new turn re-arms following: whoever has just started speaking is what
  // the reader came for, and the transcript keeps everything above it anyway.
  useEffect(() => {
    setIsFollowingLive(true);
  }, [newestCaptionId]);

  useEffect(() => {
    const band = captionScrollRef.current;
    if (!band || !isFollowingLive) return;
    band.scrollTop = band.scrollHeight;
  }, [transcript, isFollowingLive, areCaptionsVisible]);

  const handleCaptionScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    const band = event.currentTarget;
    // A few pixels of slack: sub-pixel layout and momentum scrolling rarely
    // land exactly on zero, and being one pixel off must not stop the band
    // following the words being spoken.
    const distanceFromBottom =
      band.scrollHeight - band.scrollTop - band.clientHeight;
    setIsFollowingLive(distanceFromBottom <= CAPTION_BOTTOM_SLACK_PX);
  }, []);

  // One line of state for the whole call, shown rather than hidden: the orb
  // used to carry this visually and screen readers got a duplicate of it in an
  // `sr-only` paragraph. Highest-precedence fact wins — connecting, then the
  // agent being silenced, then who is talking, then the caller's own mic.
  const callStatusLabel = isLoading
    ? loadingMessage
    : isMentorAudioMuted
      ? t('agentMuted')
      : isMentorSpeaking
        ? t('agentSpeaking')
        : isMicMuted
          ? t('micMuted')
          : t('listening');

  const statusDotClass = isMentorAudioMuted
    ? 'bg-destructive'
    : isMentorVoiceActive
      ? 'bg-blue-500'
      : isMicMuted
        ? 'bg-destructive'
        : 'bg-emerald-500';

  /** Circular control, in the shared Button, sized for a call toolbar. */
  const controlClass = (isActive: boolean, isDanger: boolean) =>
    cn(
      'size-11 rounded-full transition-all hover:scale-105 active:scale-95',
      isDanger
        ? 'bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive'
        : isActive
          ? 'bg-background text-blue-600 shadow-sm hover:bg-background hover:text-blue-700'
          : 'text-muted-foreground hover:bg-background hover:text-foreground',
      isLoading && 'cursor-not-allowed opacity-50',
    );

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: callAnimations }} />
      <Dialog open={isOpen} onOpenChange={onClose}>
        {/* No dialog close button: hanging up is the way out of a call, and
            two controls that both end it is one too many. Escape and the
            overlay still work, as they do in every other dialog. */}
        <DialogContent
          showCloseButton={false}
          className="data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-md"
        >
          <DialogTitle className="sr-only">{t('voiceChat')}</DialogTitle>
          <DialogDescription className="sr-only">
            {t('dialogDescription')}
          </DialogDescription>
          {/* `min-w-0` is load-bearing, not tidiness. `DialogContent` is a CSS
              grid and this is its only grid item; grid items default to
              `min-width: auto`, so they refuse to shrink below the intrinsic
              minimum width of their content. Any single unwrappable line
              deeper in the tree would otherwise drag this box — and the
              visible text — straight past the dialog's edge. The same trap
              repeats for every flex item below, hence the repeats.

              The card is sized by what is in it, capped at `85vh`. It used to
              be `h-[100vh]`, which is where all the white space came from:
              a call has three small things to show and a full screen to
              spread them across. */}
          <div
            className={cn(
              'flex w-full min-w-0 flex-col',
              // A captioned call is a screen you sit with, so the card takes a
              // proper height and the transcript takes the room. With captions
              // off there is nothing to fill it with, so the card shrinks back
              // to what it holds rather than framing empty space.
              areCaptionsVisible && 'h-[min(46rem,88vh)]',
            )}
          >
            {/* Who you are talking to, and how it is going. */}
            <div className="flex w-full min-w-0 shrink-0 flex-col items-center gap-4 px-6 pt-10 pb-7">
              <div
                data-testid="voice-blob"
                className="relative flex size-28 shrink-0 items-center justify-center transition-[opacity,filter] duration-300"
                style={{
                  // Silencing the agent drains the whole indicator, so a muted
                  // call never looks like a live one.
                  opacity: isMentorAudioMuted ? 0.5 : 1,
                  filter: isMentorAudioMuted ? 'saturate(0.35)' : undefined,
                }}
              >
                {/* A soft halo says "the line is open" without animating
                    anything that looks like speech. */}
                {isConnected && (
                  <span
                    aria-hidden="true"
                    data-testid="voice-halo"
                    className="pointer-events-none absolute -inset-2 rounded-full bg-blue-500/10 blur-lg"
                    style={{ animation: 'voiceHalo 3.2s ease-in-out infinite' }}
                  />
                )}
                {/* The mentor's voice, on the mentor's face: one steady ring
                    and one ripple leaving it. */}
                {isConnected && isMentorVoiceActive && (
                  <div
                    aria-hidden="true"
                    data-testid="mentor-speaking-ring"
                    className="pointer-events-none absolute -inset-1"
                  >
                    <div
                      className="absolute inset-0 rounded-full border-2 border-blue-500"
                      style={{
                        animation: 'voiceRingPulse 1.4s ease-in-out infinite',
                      }}
                    ></div>
                    <div
                      className="absolute inset-0 rounded-full border-2 border-blue-400"
                      style={{
                        animation: 'voiceRingRipple 1.4s ease-out infinite',
                      }}
                    ></div>
                  </div>
                )}
                <Avatar className="border-background size-24 border-4 shadow-md">
                  <AvatarImage src={mentorImage} alt={mentorLabel} />
                  <AvatarFallback className="bg-blue-50 text-xl font-medium text-blue-700">
                    {initialsOf(mentorLabel)}
                  </AvatarFallback>
                </Avatar>
                {isLoading && (
                  <span className="bg-background/70 absolute inset-0 grid place-items-center rounded-full">
                    <Loader2 className="size-8 animate-spin text-blue-600" />
                  </span>
                )}
              </div>

              <div className="flex min-w-0 flex-col items-center gap-2">
                <p className="text-foreground line-clamp-1 max-w-full text-center text-base font-semibold break-words">
                  {mentorLabel}
                </p>
                {/* The pill shows the state, it does not narrate it: a
                    coloured dot and the clock. "Listening…" and "Agent
                    speaking" were words for something the ring, the dot and
                    the controls already say, and they changed every few
                    seconds while doing it. The words stay for screen readers,
                    where there is no ring to look at. */}
                <Badge
                  role="status"
                  aria-label={t('callStatus')}
                  data-testid="voice-call-status"
                  variant="secondary"
                  className="text-muted-foreground gap-2 rounded-full px-3 py-1 text-xs font-normal"
                >
                  {isLoading ? (
                    <Loader2
                      aria-hidden="true"
                      className="size-3 animate-spin"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      data-testid="voice-status-dot"
                      className={cn(
                        'size-1.5 rounded-full',
                        statusDotClass,
                        isMentorVoiceActive && 'animate-pulse',
                      )}
                    />
                  )}
                  {isLoading ? (
                    <span>{loadingMessage}</span>
                  ) : (
                    <span data-testid="voice-status-text" className="sr-only">
                      {callStatusLabel}
                    </span>
                  )}
                  {isConnected && (
                    <time
                      data-testid="voice-call-duration"
                      className="tabular-nums"
                    >
                      {formatCallDuration(elapsedSeconds)}
                    </time>
                  )}
                </Badge>
              </div>
            </div>

            {/* Captions: the whole conversation, in order, rendered as the
                same bubbles as the chat thread the call belongs to, minus its
                action toolbar. Off is one click away, and the choice is
                remembered.

                Its own tinted panel, so the transcript reads as a surface
                rather than as text floating in the card, and `flex-1` so it
                takes the height the card sets aside for it rather than a
                guessed band of its own. `aria-relevant` keeps the log from
                re-reading lines that are still on screen and `tabIndex` makes
                the scroll reachable from the keyboard. */}
            {areCaptionsVisible && (
              <div className="bg-muted/40 flex min-h-0 w-full min-w-0 flex-1 flex-col border-t">
                <div
                  ref={captionScrollRef}
                  onScroll={handleCaptionScroll}
                  data-testid="voice-transcript"
                  data-following={isFollowingLive ? 'true' : 'false'}
                  role="log"
                  aria-live="polite"
                  aria-relevant="additions text"
                  aria-label={t('callTranscript')}
                  tabIndex={0}
                  className="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent focus-visible:ring-ring flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-4 py-4 focus-visible:ring-2 focus-visible:outline-none"
                >
                  {visibleCaptions.length === 0 ? (
                    <p
                      data-testid="voice-transcript-empty"
                      className="text-muted-foreground m-auto max-w-[15rem] text-center text-xs text-balance"
                    >
                      {t('transcriptEmpty')}
                    </p>
                  ) : (
                    // `mt-auto` rather than `justify-end` on the band: a short
                    // exchange sits at the bottom, filling upwards as it grows
                    // the way a chat thread does, but an auto margin — unlike
                    // flex end-alignment — collapses to zero once the content
                    // overflows, instead of pushing it above the scroll origin
                    // where it cannot be scrolled back to.
                    <div className="mt-auto w-full min-w-0">
                      {visibleCaptions.map((entry, index) => {
                        // Distance from the bottom of the stack: 0 is the line
                        // being spoken right now, 1 is the turn it answers.
                        const age = visibleCaptions.length - 1 - index;
                        const isNewest = age === 0;
                        const isUser = entry.speaker === 'user';
                        const speakerLabel = isUser
                          ? t('transcriptSpeakerYou')
                          : mentorName ||
                            entry.participantName ||
                            t('transcriptSpeakerAgent');

                        const caret = !entry.isFinal && (
                          <span
                            aria-hidden="true"
                            data-testid="voice-transcript-caret"
                            className="ml-0.5 inline-block align-baseline font-normal text-blue-600"
                            style={{
                              animation:
                                'transcriptCaret 1s ease-in-out infinite',
                            }}
                          >
                            ▍
                          </span>
                        );

                        const lineProps = {
                          'data-testid': 'voice-transcript-line',
                          'data-speaker': entry.speaker,
                          'data-final': entry.isFinal ? 'true' : 'false',
                          'data-newest': isNewest ? 'true' : 'false',
                          'data-age': age,
                        };

                        return (
                          <div
                            key={entry.id}
                            data-testid="voice-transcript-turn"
                            data-speaker={entry.speaker}
                            className={cn(
                              'mb-4 flex w-full min-w-0 last:mb-0',
                              isUser ? 'flex-col items-end' : 'items-start',
                            )}
                          >
                            {isUser ? (
                              <>
                                {/* The chat gives the caller's own bubble no
                                    name, and neither do we — but the log is
                                    read aloud by assistive tech, where losing
                                    who-said-what is not cosmetic. */}
                                <span
                                  data-testid="voice-transcript-speaker"
                                  data-speaker={entry.speaker}
                                  data-newest={isNewest ? 'true' : 'false'}
                                  className="sr-only"
                                >
                                  {speakerLabel}
                                </span>
                                <p
                                  {...lineProps}
                                  className="max-w-full min-w-0 rounded-2xl bg-blue-50 px-4 py-2 text-sm break-words text-gray-800"
                                >
                                  {entry.text}
                                  {caret}
                                </p>
                              </>
                            ) : (
                              <>
                                <Avatar className="border-background mr-2 size-7 shrink-0 border sm:mr-3 sm:size-8">
                                  <AvatarImage
                                    src={mentorImage}
                                    alt={speakerLabel}
                                  />
                                  <AvatarFallback className="bg-blue-50 text-[0.625rem] font-medium text-blue-700">
                                    {initialsOf(speakerLabel)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                  <p
                                    data-testid="voice-transcript-speaker"
                                    data-speaker={entry.speaker}
                                    data-newest={isNewest ? 'true' : 'false'}
                                    className="mb-1 line-clamp-1 min-w-0 text-left text-sm font-medium break-words text-gray-900"
                                  >
                                    {speakerLabel}
                                  </p>
                                  {/* Nothing is clamped or clipped: a turn
                                      longer than the band scrolls. `truncate`
                                      stays banished either way — its
                                      `white-space: nowrap` gave a line an
                                      intrinsic width equal to its whole
                                      unwrapped text, and that is what used to
                                      drag the dialog wide. */}
                                  <p
                                    {...lineProps}
                                    className="min-w-0 rounded-2xl bg-white p-3 text-left text-sm/6 break-words text-gray-800 shadow-sm"
                                  >
                                    {entry.text}
                                    {caret}
                                  </p>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Controls: the three toggles live together in one pill, so the
                only button that leaves the call is the only one that stands
                apart from it. */}
            <div className="flex shrink-0 items-center justify-center gap-3 border-t px-6 py-4">
              <div className="bg-muted/60 flex items-center gap-1 rounded-full border p-1.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={toggleMicMute}
                      disabled={isLoading}
                      size="icon"
                      variant="ghost"
                      className={cn(
                        controlClass(false, !isLoading && isMicMuted),
                        // The caller's own voice shows here rather than on the
                        // mentor's avatar: your level, your control.
                        isUserVoiceActive &&
                          'text-blue-600 ring-2 ring-blue-500/40',
                      )}
                      aria-label={
                        isMicMuted ? t('unmuteMicrophone') : t('muteMicrophone')
                      }
                    >
                      {isLoading || isMicMuted ? (
                        <MicOff className="size-5" />
                      ) : (
                        <Mic className="size-5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent
                    className="ibl-tooltip-content"
                    sideOffset={8}
                    collisionPadding={16}
                  >
                    {isLoading
                      ? t('connecting')
                      : isMicMuted
                        ? t('unmute')
                        : t('mute')}
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={toggleMentorAudio}
                      disabled={isLoading}
                      size="icon"
                      variant="ghost"
                      className={controlClass(
                        false,
                        !isLoading && isMentorAudioMuted,
                      )}
                      aria-label={
                        isMentorAudioMuted
                          ? t('unmuteAgentAudio')
                          : t('muteAgentAudio')
                      }
                    >
                      {isLoading || isMentorAudioMuted ? (
                        <VolumeX className="size-5" />
                      ) : (
                        <Volume2 className="size-5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent
                    className="ibl-tooltip-content"
                    sideOffset={8}
                    collisionPadding={16}
                  >
                    {isLoading
                      ? t('connecting')
                      : isMentorAudioMuted
                        ? t('unmuteAgent')
                        : t('muteAgent')}
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={toggleCaptions}
                      disabled={isLoading}
                      size="icon"
                      variant="ghost"
                      aria-pressed={areCaptionsVisible}
                      className={controlClass(
                        !isLoading && areCaptionsVisible,
                        false,
                      )}
                      aria-label={
                        areCaptionsVisible
                          ? t('hideCaptions')
                          : t('showCaptions')
                      }
                    >
                      {areCaptionsVisible ? (
                        <Captions className="size-5" />
                      ) : (
                        <CaptionsOff className="size-5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent
                    className="ibl-tooltip-content"
                    sideOffset={8}
                    collisionPadding={16}
                  >
                    {/* One word, like "Mute" and "Mute agent" next to it. The
                        state-carrying wording lives on `aria-label`, where it
                        is free — the tooltip only has to name the control. */}
                    {isLoading ? t('connecting') : t('captions')}
                  </TooltipContent>
                </Tooltip>
              </div>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={onClose}
                    size="icon"
                    className="ibl-button-primary size-12 rounded-full shadow-sm transition-all hover:scale-105 active:scale-95"
                    aria-label={t('closeVoiceChat')}
                  >
                    <PhoneOff className="size-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent
                  className="ibl-tooltip-content"
                  sideOffset={8}
                  collisionPadding={16}
                >
                  {t('endCall')}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
