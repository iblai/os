'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Mic, MicOff, X, Loader2 } from 'lucide-react';
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
`;

interface VoiceChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  toggleMute: () => void;
  isMuted: boolean;
  connectionState: ConnectionState;
  isSpeaking: boolean;
}

export function VoiceChatModal({
  isOpen,
  onClose,
  toggleMute,
  isMuted,
  connectionState,
  isSpeaking,
}: VoiceChatModalProps) {
  const isLoading =
    connectionState === 'requesting-permission' ||
    connectionState === 'connecting';
  const isConnected = connectionState === 'connected';
  const shouldAnimate = isConnected && !isMuted;

  const loadingMessage = isLoading
    ? connectionState === 'requesting-permission'
      ? 'Requesting microphone access...'
      : 'Connecting to voice chat...'
    : null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: pulseAnimations }} />
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 m-0 bg-white p-0">
          <DialogTitle className="sr-only">Voice Chat</DialogTitle>
          <DialogDescription className="sr-only">
            Real-time voice conversation with your mentor
          </DialogDescription>
          <div className="flex h-[100vh] w-full flex-col items-center justify-between">
            <div className="flex w-full flex-1 flex-col items-center justify-center px-4">
              {/* Modern Animation with speaking enhancement */}
              <div className="relative mb-20 h-40 w-40">
                {/* Pulsing background - enhanced when speaking */}
                <div
                  className="absolute inset-0 rounded-full bg-blue-100"
                  style={{
                    animation: shouldAnimate
                      ? isSpeaking
                        ? 'randomPulse1 1.5s ease-in-out infinite'
                        : 'randomPulse1 2s ease-in-out infinite'
                      : 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                  }}
                ></div>
                <div
                  className="absolute inset-4 rounded-full bg-gradient-to-b from-blue-200 to-blue-400"
                  style={{
                    animation: shouldAnimate
                      ? isSpeaking
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
                                height: shouldAnimate ? '30px' : '12px',
                                opacity: shouldAnimate
                                  ? isSpeaking
                                    ? 1
                                    : 0.7
                                  : 0.5,
                                animation: shouldAnimate
                                  ? `${animName} ${isSpeaking ? 0.8 + i * 0.15 : 1.2 + i * 0.2}s ease-in-out infinite`
                                  : 'none',
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
                              animation: shouldAnimate
                                ? `${particleAnims[i % 3]} ${isSpeaking ? 1.2 + (i % 4) * 0.3 : 1.8 + (i % 4) * 0.5}s ease-in-out infinite`
                                : 'none',
                              opacity: shouldAnimate ? undefined : 0.7,
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
            </div>

            {/* Bottom control buttons */}
            <div className="mb-8 flex w-full items-center justify-center space-x-6 px-4 py-8">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={toggleMute}
                    disabled={isLoading}
                    size="icon"
                    variant="outline"
                    className={`h-14 w-14 rounded-full border-blue-500 text-blue-500 transition-all hover:border-blue-600 hover:text-blue-600 ${
                      isLoading
                        ? 'cursor-not-allowed opacity-50'
                        : 'hover:scale-105 active:scale-95'
                    }`}
                    aria-label={
                      isMuted ? 'Unmute microphone' : 'Mute microphone'
                    }
                  >
                    {isLoading || isMuted ? (
                      <MicOff
                        className={`h-5 w-5 ${isLoading ? 'text-blue-500' : ''}`}
                      />
                    ) : (
                      <Mic className="h-5 w-5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="ibl-tooltip-content">
                  {isLoading ? 'Connecting...' : isMuted ? 'Unmute' : 'Mute'}
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={onClose}
                    size="icon"
                    className="ibl-button-primary h-14 w-14 rounded-full transition-all hover:scale-105 active:scale-95"
                    aria-label="Close voice chat"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="ibl-tooltip-content">
                  End Call
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
