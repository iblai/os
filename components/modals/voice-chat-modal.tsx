'use client';

import { useCallback, useEffect, useState } from 'react';

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
  X,
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

type ConnectionState =
  | 'requesting-permission'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

// CSS animations for random pulse effects
const pulseAnimations = `
  @keyframes randomPulse1 {
    0%, 100% { transform: scale(1.05); opacity: 0.8; }
    25% { transform: scale(1.15); opacity: 0.9; }
    50% { transform: scale(1.08); opacity: 0.95; }
    75% { transform: scale(1.18); opacity: 0.85; }
  }

  @keyframes randomPulse2 {
    0%, 100% { transform: scale(1.03); opacity: 0.7; }
    33% { transform: scale(1.12); opacity: 0.85; }
    66% { transform: scale(1.06); opacity: 0.8; }
  }

  @keyframes soundWave1 {
    0%, 100% { height: 15px; }
    20% { height: 45px; }
    40% { height: 25px; }
    60% { height: 50px; }
    80% { height: 30px; }
  }

  @keyframes soundWave2 {
    0%, 100% { height: 20px; }
    25% { height: 40px; }
    50% { height: 35px; }
    75% { height: 48px; }
  }

  @keyframes soundWave3 {
    0%, 100% { height: 25px; }
    30% { height: 50px; }
    60% { height: 20px; }
    90% { height: 42px; }
  }

  @keyframes soundWave4 {
    0%, 100% { height: 18px; }
    35% { height: 38px; }
    70% { height: 47px; }
  }

  @keyframes soundWave5 {
    0%, 100% { height: 22px; }
    40% { height: 44px; }
    80% { height: 28px; }
  }

  @keyframes particlePulse1 {
    0%, 100% { transform: scale(1); opacity: 0.7; }
    50% { transform: scale(1.5); opacity: 1; }
  }

  @keyframes particlePulse2 {
    0%, 100% { transform: scale(1.2); opacity: 0.8; }
    50% { transform: scale(0.8); opacity: 0.95; }
  }

  @keyframes particlePulse3 {
    0%, 100% { transform: scale(0.9); opacity: 0.75; }
    50% { transform: scale(1.6); opacity: 0.9; }
  }

  @keyframes mentorRingPulse {
    0%, 100% { transform: scale(1); opacity: 0.55; }
    50% { transform: scale(1.04); opacity: 0.95; }
  }

  @keyframes mentorRingRipple {
    0% { transform: scale(0.96); opacity: 0.7; }
    70% { opacity: 0.12; }
    100% { transform: scale(1.22); opacity: 0; }
  }

  @keyframes transcriptCaret {
    0%, 45% { opacity: 1; }
    50%, 95% { opacity: 0.15; }
    100% { opacity: 1; }
  }
`;

/**
 * Captions are opt-in and the choice follows the user from call to call, the
 * way Gemini Live remembers it. A single stringly-typed flag is enough.
 */
const CAPTIONS_PREFERENCE_STORAGE_KEY = 'ibl.voiceChat.captionsEnabled';

/**
 * The captions band shows the current *exchange* — what was asked and what is
 * being answered — not simply the last two things said.
 *
 * This is deliberately not `entries.slice(-2)`. Transcript turns do not
 * strictly alternate: a user can say two things in a row, and a single agent
 * reply routinely arrives as several entries. In both cases `slice(-2)`
 * returns two lines from the same speaker and the other half of the exchange
 * silently disappears, which is the one thing the band exists to show.
 * Selecting by speaker keeps the question paired with its answer whatever the
 * turn order.
 *
 * Returns oldest-first so callers can render top-to-bottom with the newest
 * line last, flush against the bottom of the band.
 *
 * Exported so the rule can be unit-tested without a DOM.
 */
export function selectExchangeLines(
  entries: TranscriptEntry[],
): TranscriptEntry[] {
  const newest = entries[entries.length - 1];
  if (!newest) return [];

  for (let i = entries.length - 2; i >= 0; i -= 1) {
    if (entries[i].speaker !== newest.speaker) {
      return [entries[i], newest];
    }
  }

  // Only one voice has spoken so far, so there is no exchange to show yet.
  return [newest];
}

/**
 * Storage is a nicety, never a dependency: server rendering has no `window`
 * and Safari's private mode throws on access. Either way we fall back to the
 * industry default of captions off.
 *
 * Exported so the no-`window` path can be exercised directly — it is
 * unreachable through a rendered component, which needs a DOM to exist.
 */
export function readCaptionsPreference(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return (
      window.localStorage.getItem(CAPTIONS_PREFERENCE_STORAGE_KEY) === 'true'
    );
  } catch {
    return false;
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
}: VoiceChatModalProps) {
  const t = useTranslations('modalsVoiceChatModal');
  const isLoading =
    connectionState === 'requesting-permission' ||
    connectionState === 'connecting';
  const isConnected = connectionState === 'connected';
  // The blob is the single indicator for the whole conversation, so it stays
  // alive for as long as the call is up. Muting your own microphone must never
  // make the call look dead — that only silences the sound-wave bars below.
  const shouldAnimate = isConnected;
  // The sound-wave bars belong to the user: they react to the local mic only.
  const isUserVoiceActive = isSpeaking && !isMicMuted;
  // The ring belongs to the mentor: it only shows while the agent is
  // actually audible. Both can be on at once — real conversations overlap.
  const isMentorVoiceActive = isMentorSpeaking && !isMentorAudioMuted;

  const loadingMessage = isLoading
    ? connectionState === 'requesting-permission'
      ? t('requestingMicrophoneAccess')
      : t('connectingToVoiceChat')
    : null;

  // --- Captions ----------------------------------------------------------
  // Off by default, like every other voice assistant. The stored preference is
  // read after mount so the server-rendered markup and the first client render
  // agree; a one-frame flash of "off" is cheaper than a hydration mismatch.
  const [areCaptionsVisible, setAreCaptionsVisible] = useState(false);

  useEffect(() => {
    setAreCaptionsVisible(readCaptionsPreference());
  }, []);

  const toggleCaptions = useCallback(() => {
    const next = !areCaptionsVisible;
    setAreCaptionsVisible(next);
    writeCaptionsPreference(next);
  }, [areCaptionsVisible]);

  // Only the current exchange is ever on screen. The full transcript belongs
  // to the chat history once the call ends.
  const visibleCaptions = selectExchangeLines(transcript);

  // The orb carries the call state for anyone who can see it, so this text
  // exists purely for assistive tech. Highest-precedence fact wins: the agent
  // being silenced is the most surprising state, then who is talking, then the
  // user's own mic.
  const callStatusLabel = isMentorAudioMuted
    ? t('agentMuted')
    : isMentorSpeaking
      ? t('agentSpeaking')
      : isMicMuted
        ? t('micMuted')
        : t('listening');

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: pulseAnimations }} />
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 m-0 bg-white p-0">
          <DialogTitle className="sr-only">{t('voiceChat')}</DialogTitle>
          <DialogDescription className="sr-only">
            {t('dialogDescription')}
          </DialogDescription>
          {/* `min-w-0` is load-bearing, not tidiness. `DialogContent` is a CSS
              grid and this is its only grid item; grid items default to
              `min-width: auto`, so they refuse to shrink below the intrinsic
              minimum width of their content. Any single unwrappable line
              deeper in the tree would otherwise drag this box — and the
              visible text — straight past the dialog's `max-w-lg` edge. The
              same trap repeats for every flex item below, hence the repeats. */}
          <div className="flex h-[100vh] w-full min-w-0 flex-col items-center justify-between">
            <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col items-center justify-center px-4 pt-6">
              {/* Conversation indicator: the blob is the call and the user's
                  voice, the ring is the mentor's voice. */}
              <div
                data-testid="voice-blob"
                className="relative mb-6 h-40 w-40 shrink-0 transition-[opacity,filter] duration-300"
                style={{
                  // Silencing the agent drains the whole indicator, so a muted
                  // call never looks like a live one.
                  opacity: isMentorAudioMuted ? 0.45 : 1,
                  filter: isMentorAudioMuted ? 'saturate(0.35)' : undefined,
                }}
              >
                {/* Mentor voice ring - a deeper blue than the blob's own
                    gradient, and rendered as its own layer so it can show at
                    the same time as the user's waves. */}
                {isConnected && isMentorVoiceActive && (
                  <div
                    aria-hidden="true"
                    data-testid="mentor-speaking-ring"
                    className="pointer-events-none absolute -inset-3"
                  >
                    <div
                      className="absolute inset-0 rounded-full border-2 border-blue-600"
                      style={{
                        animation: 'mentorRingPulse 1.4s ease-in-out infinite',
                      }}
                    ></div>
                    <div
                      className="absolute inset-0 rounded-full border-2 border-sky-400"
                      style={{
                        animation: 'mentorRingRipple 1.4s ease-out infinite',
                      }}
                    ></div>
                  </div>
                )}
                {/* Pulsing background - enhanced when the user is speaking */}
                <div
                  className="absolute inset-0 rounded-full bg-blue-100"
                  style={{
                    animation: shouldAnimate
                      ? isUserVoiceActive
                        ? 'randomPulse1 1.5s ease-in-out infinite'
                        : 'randomPulse1 2s ease-in-out infinite'
                      : 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                  }}
                ></div>
                <div
                  className="absolute inset-4 rounded-full bg-gradient-to-b from-blue-200 to-blue-400"
                  style={{
                    animation: shouldAnimate
                      ? isUserVoiceActive
                        ? 'randomPulse2 1.8s ease-in-out infinite'
                        : 'randomPulse2 2.5s ease-in-out infinite'
                      : 'none',
                    opacity: shouldAnimate ? undefined : 0.8,
                  }}
                ></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative h-full w-full">
                    {/* Show loading spinner during connection states */}
                    {isLoading && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="h-12 w-12 animate-spin text-white" />
                      </div>
                    )}

                    {/* Animated sound waves - only show when connected */}
                    {isConnected && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="relative flex h-8 w-20 items-center justify-center space-x-1.5">
                          {[
                            'soundWave1',
                            'soundWave2',
                            'soundWave3',
                            'soundWave4',
                            'soundWave5',
                          ].map((animName, i) => (
                            <div
                              key={i}
                              className="w-1 transform-gpu rounded-full bg-white"
                              style={{
                                // The bars are the user's voice: muting the mic
                                // flattens and dims them, and nothing else.
                                height: isMicMuted ? '12px' : '30px',
                                opacity: isMicMuted
                                  ? 0.35
                                  : isUserVoiceActive
                                    ? 1
                                    : 0.7,
                                animation: isMicMuted
                                  ? 'none'
                                  : `${animName} ${isUserVoiceActive ? 0.8 + i * 0.15 : 1.2 + i * 0.2}s ease-in-out infinite`,
                                transition: 'opacity 0.3s ease',
                              }}
                            ></div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Animated particles - only show when connected */}
                    {isConnected &&
                      [...Array(10)].map((_, i) => {
                        const particleAnims = [
                          'particlePulse1',
                          'particlePulse2',
                          'particlePulse3',
                        ];
                        const positions = [
                          { top: '15%', left: '20%' },
                          { top: '75%', left: '85%' },
                          { top: '40%', left: '10%' },
                          { top: '65%', left: '30%' },
                          { top: '25%', left: '75%' },
                          { top: '80%', left: '60%' },
                          { top: '10%', left: '50%' },
                          { top: '55%', left: '90%' },
                          { top: '90%', left: '15%' },
                          { top: '35%', left: '65%' },
                        ];
                        return (
                          <div
                            key={`particle-${i}`}
                            className="absolute rounded-full bg-white"
                            style={{
                              width: '3px',
                              height: '3px',
                              ...positions[i],
                              // Only rendered while connected, so the particles
                              // always drift; the user's voice just speeds
                              // them up.
                              animation: `${particleAnims[i % 3]} ${isUserVoiceActive ? 1.2 + (i % 4) * 0.3 : 1.8 + (i % 4) * 0.5}s ease-in-out infinite`,
                            }}
                          ></div>
                        );
                      })}
                  </div>
                </div>
              </div>

              {/* Loading message */}
              {isLoading && (
                <p className="animate-pulse text-center text-sm text-gray-600">
                  {loadingMessage}
                </p>
              )}

              {/* The blob is now the only visible state indicator. This is its
                  screen-reader equivalent: same facts, no visual noise. It is
                  a polite `role="status"` and the caption log below is a polite
                  `role="log"`, so assistive tech queues them instead of letting
                  one interrupt the other. */}
              {!isLoading && (
                <p
                  role="status"
                  aria-label={t('callStatus')}
                  className="sr-only"
                >
                  {callStatusLabel}
                </p>
              )}

              {/* Captions: a fixed two-line exchange — the live line plus the
                  other speaker's last turn — opt-in, newest at the bottom.
                  Nothing scrolls; `aria-relevant="additions text"` keeps the
                  log from re-reading lines that are still on screen. When
                  captions are off the region is absent entirely, so the
                  default call is just the orb and the controls.

                  Height: real agent turns are paragraphs, not one-liners, so
                  the band reserves each line a slot instead of letting them
                  fight. 6rem = the older line's two clamped `text-xs`
                  /`leading-snug` rows (2 x 1.03125rem + 0.25rem margin =
                  2.3125rem) plus three `text-sm` rows of live text
                  (3 x 1.203125rem = 3.609375rem). Nothing arbitrary is left
                  over.

                  `min-w-0` on the region and on every line is the fix for the
                  reported overflow: without it the `min-width: auto` chain
                  running up to `DialogContent`'s grid item sizes the dialog to
                  the widest unwrappable line. */}
              {areCaptionsVisible && (
                <div
                  data-testid="voice-transcript"
                  role="log"
                  aria-live="polite"
                  aria-relevant="additions text"
                  aria-label={t('callTranscript')}
                  className="mt-4 flex h-[6rem] w-full max-w-md min-w-0 shrink-0 flex-col justify-end overflow-hidden px-2"
                >
                  {visibleCaptions.length === 0 ? (
                    <p
                      data-testid="voice-transcript-empty"
                      className="text-center text-xs text-gray-400"
                    >
                      {t('transcriptEmpty')}
                    </p>
                  ) : (
                    visibleCaptions.map((entry, index) => {
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

                      const line = (
                        <p
                          key={entry.id}
                          data-testid="voice-transcript-line"
                          data-speaker={entry.speaker}
                          data-final={entry.isFinal ? 'true' : 'false'}
                          data-newest={isNewest ? 'true' : 'false'}
                          data-age={age}
                          className={`mb-1 min-w-0 text-left leading-snug break-words transition-all duration-300 ${
                            isNewest
                              ? // The live line wraps freely and sits flush with
                                // the bottom, so its newest words — and the
                                // caret — are always the ones on screen; a long
                                // turn clips off the top of its own viewport.
                                'text-sm text-gray-900 opacity-100'
                              : // The answered turn is clamped by line count,
                                // never by `truncate`. `truncate`'s
                                // `white-space: nowrap` gave the line an
                                // intrinsic width equal to its entire unwrapped
                                // text, which is what dragged the dialog wide;
                                // `line-clamp` wraps normally and only limits
                                // rows, so it cannot do that. Two rows also
                                // means the line is never a one-word sliver.
                                'line-clamp-2 shrink-0 text-xs text-gray-500 opacity-60'
                          }`}
                        >
                          <span
                            className={`mr-1.5 font-semibold ${
                              // The agent shares the deeper blue of the
                              // mentor-speaking ring; the user keeps the
                              // lighter blue of the blob. The pairing is the
                              // whole point.
                              isUser ? 'text-blue-500' : 'text-blue-700'
                            }`}
                          >
                            {speakerLabel}
                          </span>
                          <span>{entry.text}</span>
                          {!entry.isFinal && (
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
                          )}
                        </p>
                      );

                      // The live line gets its own bottom-anchored viewport so
                      // a paragraph-long agent turn clips against this box
                      // instead of shoving the answered turn off the top of the
                      // band. That is the difference between "there is more
                      // above" and "the other half of the exchange vanished".
                      return isNewest ? (
                        <div
                          key={entry.id}
                          data-testid="voice-transcript-live-window"
                          className="flex min-h-0 min-w-0 flex-1 flex-col justify-end overflow-hidden"
                        >
                          {line}
                        </div>
                      ) : (
                        line
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Bottom controls: mic, agent audio, captions, end call. The row
                never shrinks — the orb and the caption band share the flexible
                space above it. */}
            <div className="mb-4 flex w-full shrink-0 items-center justify-center space-x-6 px-4 py-6">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={toggleMicMute}
                    disabled={isLoading}
                    size="icon"
                    variant="outline"
                    className={`h-14 w-14 rounded-full transition-all ${
                      !isLoading && isMicMuted
                        ? 'border-red-500 bg-red-50 text-red-600 hover:border-red-600 hover:bg-red-100 hover:text-red-700'
                        : 'border-blue-500 text-blue-500 hover:border-blue-600 hover:text-blue-600'
                    } ${
                      isLoading
                        ? 'cursor-not-allowed opacity-50'
                        : 'hover:scale-105 active:scale-95'
                    }`}
                    aria-label={
                      isMicMuted ? t('unmuteMicrophone') : t('muteMicrophone')
                    }
                  >
                    {isLoading || isMicMuted ? (
                      <MicOff
                        className={`h-5 w-5 ${isLoading ? 'text-blue-500' : ''}`}
                      />
                    ) : (
                      <Mic className="h-5 w-5" />
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
                    variant="outline"
                    className={`h-14 w-14 rounded-full transition-all ${
                      !isLoading && isMentorAudioMuted
                        ? 'border-red-500 bg-red-50 text-red-600 hover:border-red-600 hover:bg-red-100 hover:text-red-700'
                        : 'border-blue-500 text-blue-500 hover:border-blue-600 hover:text-blue-600'
                    } ${
                      isLoading
                        ? 'cursor-not-allowed opacity-50'
                        : 'hover:scale-105 active:scale-95'
                    }`}
                    aria-label={
                      isMentorAudioMuted
                        ? t('unmuteAgentAudio')
                        : t('muteAgentAudio')
                    }
                  >
                    {isLoading || isMentorAudioMuted ? (
                      <VolumeX
                        className={`h-5 w-5 ${isLoading ? 'text-blue-500' : ''}`}
                      />
                    ) : (
                      <Volume2 className="h-5 w-5" />
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
                    variant="outline"
                    aria-pressed={areCaptionsVisible}
                    className={`h-14 w-14 rounded-full transition-all ${
                      !isLoading && areCaptionsVisible
                        ? 'border-blue-500 bg-blue-50 text-blue-600 hover:border-blue-600 hover:bg-blue-100 hover:text-blue-700'
                        : 'border-blue-500 text-blue-500 hover:border-blue-600 hover:text-blue-600'
                    } ${
                      isLoading
                        ? 'cursor-not-allowed opacity-50'
                        : 'hover:scale-105 active:scale-95'
                    }`}
                    aria-label={
                      areCaptionsVisible ? t('hideCaptions') : t('showCaptions')
                    }
                  >
                    {areCaptionsVisible ? (
                      <Captions className="h-5 w-5" />
                    ) : (
                      <CaptionsOff className="h-5 w-5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent
                  className="ibl-tooltip-content"
                  sideOffset={8}
                  collisionPadding={16}
                >
                  {/* One word, like "Mute" and "Mute agent" next to it. The
                      state-carrying wording lives on `aria-label`, where it is
                      free — the tooltip only has to name the control. */}
                  {isLoading ? t('connecting') : t('captions')}
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={onClose}
                    size="icon"
                    className="ibl-button-primary h-14 w-14 rounded-full transition-all hover:scale-105 active:scale-95"
                    aria-label={t('closeVoiceChat')}
                  >
                    <X className="h-5 w-5" />
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
