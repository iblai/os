'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

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
  ArrowDown,
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
 * How close to the bottom (px) still counts as "pinned to the newest line".
 * Anything further up is treated as the user reading back, which suspends
 * auto-scroll until they return.
 */
const AUTO_SCROLL_PIN_THRESHOLD_PX = 24;

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
  /** Whether the newest transcript line is still in progress. */
  isTranscriptLive?: boolean;
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
  isTranscriptLive = false,
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

  // One caption replaces the old pair of status rows. Highest-precedence fact
  // wins: the agent being silenced is the most surprising state, then who is
  // talking, then the user's own mic.
  // --- Transcript auto-scroll -------------------------------------------
  // The band follows the newest line, but only while the reader is already at
  // the bottom. Scrolling up to re-read must never be yanked back down.
  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);
  const [isPinnedToLatest, setIsPinnedToLatest] = useState(true);

  const scrollToLatest = useCallback(() => {
    const element = transcriptScrollRef.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
  }, []);

  useEffect(() => {
    if (!isPinnedToLatest) return;
    scrollToLatest();
  }, [transcript, isPinnedToLatest, scrollToLatest]);

  const handleTranscriptScroll = useCallback(() => {
    const element = transcriptScrollRef.current;
    if (!element) return;
    const distanceFromBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight;
    setIsPinnedToLatest(distanceFromBottom <= AUTO_SCROLL_PIN_THRESHOLD_PX);
  }, []);

  const handleJumpToLatest = useCallback(() => {
    setIsPinnedToLatest(true);
    scrollToLatest();
  }, [scrollToLatest]);

  const showJumpToLatest = !isPinnedToLatest && transcript.length > 0;

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
          <div className="flex h-[100vh] w-full flex-col items-center justify-between">
            <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center px-4 pt-6">
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

              {/* Single caption for the call. The blob carries the state
                  visually; this is the text/screen-reader equivalent. */}
              {!isLoading && (
                <p
                  role="status"
                  aria-label={t('callStatus')}
                  className="mt-2 text-center text-sm text-gray-600"
                >
                  {callStatusLabel}
                </p>
              )}

              {/* Teleprompter band. The caption above is a `role="status"`
                  (implicitly polite) and this is a polite `role="log"`; both
                  being polite means assistive tech queues them instead of one
                  interrupting the other. `aria-relevant="additions text"` keeps
                  the log from re-reading the accumulated history — only new and
                  changed lines are announced. */}
              <div
                data-testid="voice-transcript"
                className="relative mt-3 flex min-h-0 w-full max-w-xl flex-1 flex-col"
              >
                {/* Receding top edge, so older lines read as fading out of view
                    rather than being cut off by the scroll box. */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-white to-transparent"
                />
                <div
                  ref={transcriptScrollRef}
                  onScroll={handleTranscriptScroll}
                  role="log"
                  aria-live="polite"
                  aria-relevant="additions text"
                  aria-label={t('callTranscript')}
                  data-testid="voice-transcript-scroll"
                  // A scrollable region has to be reachable by keyboard, or the
                  // history is only readable with a mouse (WCAG 2.1.1).
                  tabIndex={0}
                  className="h-full min-h-[4.5rem] w-full overflow-y-auto px-2 pt-6 pb-2"
                >
                  {transcript.length === 0 ? (
                    <p
                      data-testid="voice-transcript-empty"
                      className="text-center text-xs text-gray-400"
                    >
                      {t('transcriptEmpty')}
                    </p>
                  ) : (
                    transcript.map((entry, index) => {
                      const isNewest = index === transcript.length - 1;
                      const isUser = entry.speaker === 'user';
                      const speakerLabel = isUser
                        ? t('transcriptSpeakerYou')
                        : mentorName ||
                          entry.participantName ||
                          t('transcriptSpeakerAgent');

                      return (
                        <p
                          key={entry.id}
                          data-testid="voice-transcript-line"
                          data-speaker={entry.speaker}
                          data-final={entry.isFinal ? 'true' : 'false'}
                          data-newest={isNewest ? 'true' : 'false'}
                          className={`mb-1.5 text-left leading-snug transition-all duration-300 ${
                            isNewest
                              ? 'text-sm text-gray-900 opacity-100'
                              : 'text-xs text-gray-500 opacity-60'
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
                    })
                  )}
                </div>

                {showJumpToLatest && (
                  <button
                    type="button"
                    onClick={handleJumpToLatest}
                    data-testid="voice-transcript-jump"
                    className="absolute bottom-1 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-blue-200 bg-white px-3 py-1 text-xs text-blue-600 shadow-sm transition-colors hover:bg-blue-50"
                  >
                    <ArrowDown className="h-3 w-3" />
                    {t('jumpToLatest')}
                  </button>
                )}

                {/* Visual-only twin of the in-line caret: says "words are
                    still arriving" at a glance. The caret carries the same
                    meaning per line, and the log announces the text itself, so
                    this is hidden from assistive tech rather than duplicated
                    into it. */}
                {isTranscriptLive && (
                  <span
                    aria-hidden="true"
                    data-testid="voice-transcript-live"
                    className="absolute top-0 right-2 z-20 flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700"
                  >
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-600" />
                    {t('transcriptLive')}
                  </span>
                )}
              </div>
            </div>

            {/* Bottom control buttons */}
            {/* Bottom controls stay a fixed-height row: the transcript band
                above flexes, so short viewports shrink the band instead of
                pushing the buttons off-screen. */}
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
                <TooltipContent className="ibl-tooltip-content">
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
                <TooltipContent className="ibl-tooltip-content">
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
                    onClick={onClose}
                    size="icon"
                    className="ibl-button-primary h-14 w-14 rounded-full transition-all hover:scale-105 active:scale-95"
                    aria-label={t('closeVoiceChat')}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="ibl-tooltip-content">
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
