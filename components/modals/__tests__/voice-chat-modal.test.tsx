import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { act } from 'react';
import {
  VoiceChatModal,
  readCaptionsPreference,
  writeCaptionsPreference,
  groupTranscriptTurns,
  formatCallDuration,
} from '../voice-chat-modal';
import type { TranscriptEntry } from '@/hooks/use-livekit-transcription';

function entry(
  id: string,
  text: string,
  speaker: TranscriptEntry['speaker'],
  isFinal = true,
  extra: Partial<TranscriptEntry> = {},
): TranscriptEntry {
  return { id, text, speaker, isFinal, timestamp: 0, ...extra };
}

/**
 * A real agent turn as captured from a live call: several hundred characters,
 * multiple paragraphs, embedded newlines. "Hello world" fixtures are what let
 * the overflow bug ship — a short line never reproduces it.
 */
const REAL_AGENT_TURN = [
  "Sure! Let's break it down. A rocket's propulsion system works by burning fuel—often a combination of liquid or solid propellants.",
  "When the fuel burns, it produces hot gases that expand and rush out of the rocket's nozzle at high speed. This creates thrust, which pushes the rocket upward.",
  'If we compare rockets to airplanes, airplanes rely on wings and atmospheric lift, whereas a rocket carries its own oxidiser and so keeps working in vacuum.',
].join('\n\n');

/** The other route to the same overflow: one token that cannot be broken. */
const UNBREAKABLE_URL =
  'https://example.com/a/very/long/path/that/never/offers/a/single/break/opportunity/anywhere/at/all/reference.html';

const CAPTIONS_STORAGE_KEY = 'ibl.voiceChat.captionsEnabled';

/** Persist "captions on" the way a previous call would have. */
function rememberCaptionsOn() {
  window.localStorage.setItem(CAPTIONS_STORAGE_KEY, 'true');
}

/** Captions are on by default, so turning them off is the stored choice. */
function rememberCaptionsOff() {
  window.localStorage.setItem(CAPTIONS_STORAGE_KEY, 'false');
}

describe('VoiceChatModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    toggleMicMute: vi.fn(),
    isMicMuted: false,
    toggleMentorAudio: vi.fn(),
    isMentorAudioMuted: false,
    connectionState: 'connected' as const,
    isSpeaking: false,
    isMentorSpeaking: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  describe('accessibility', () => {
    it('renders dialog with accessible title and description', () => {
      render(<VoiceChatModal {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(screen.getByText('Voice Chat')).toBeInTheDocument();
      expect(
        screen.getByText('Real-time voice conversation with your agent'),
      ).toBeInTheDocument();
    });
  });

  describe('loading states', () => {
    it('shows requesting microphone message', () => {
      render(
        <VoiceChatModal
          {...defaultProps}
          connectionState="requesting-permission"
        />,
      );

      expect(
        screen.getByText('Requesting microphone access...'),
      ).toBeInTheDocument();
    });

    it('shows connecting message', () => {
      render(<VoiceChatModal {...defaultProps} connectionState="connecting" />);

      expect(
        screen.getByText('Connecting to voice chat...'),
      ).toBeInTheDocument();
    });

    it('disables mute button when requesting permission', () => {
      render(
        <VoiceChatModal
          {...defaultProps}
          connectionState="requesting-permission"
        />,
      );

      expect(screen.getByLabelText('Mute microphone')).toBeDisabled();
    });

    it('disables mute button when connecting', () => {
      render(<VoiceChatModal {...defaultProps} connectionState="connecting" />);

      expect(screen.getByLabelText('Mute microphone')).toBeDisabled();
    });

    it('disables the agent audio button while connecting', () => {
      render(<VoiceChatModal {...defaultProps} connectionState="connecting" />);

      expect(screen.getByLabelText('Mute agent audio')).toBeDisabled();
    });

    it('announces the connection state in the call status region', () => {
      render(<VoiceChatModal {...defaultProps} connectionState="connecting" />);

      // One status line for the whole call, whatever stage it is at - the
      // loading message no longer lives in a paragraph of its own.
      expect(screen.getByLabelText('Call status')).toHaveTextContent(
        'Connecting to voice chat...',
      );
    });

    it('announces the permission prompt in the same region', () => {
      render(
        <VoiceChatModal
          {...defaultProps}
          connectionState="requesting-permission"
        />,
      );

      expect(screen.getByLabelText('Call status')).toHaveTextContent(
        'Requesting microphone access...',
      );
    });

    it('holds the call clock back until the call is up', () => {
      render(<VoiceChatModal {...defaultProps} connectionState="connecting" />);

      expect(screen.queryByTestId('voice-call-duration')).toBeNull();
    });

    it('shows the loading spinner while connecting', () => {
      render(<VoiceChatModal {...defaultProps} connectionState="connecting" />);

      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('does not tint the controls red while connecting', () => {
      render(<VoiceChatModal {...defaultProps} connectionState="connecting" />);

      // The loading state renders MicOff/VolumeX icons, but that is not a
      // muted state and must not read as one.
      expect(screen.getByLabelText('Mute microphone')).not.toHaveClass(
        'border-red-500',
      );
      expect(screen.getByLabelText('Mute agent audio')).not.toHaveClass(
        'border-red-500',
      );
    });
  });

  describe('connected state', () => {
    it('renders without loading elements when connected', () => {
      render(
        <VoiceChatModal
          {...defaultProps}
          connectionState="connected"
          isMicMuted={false}
        />,
      );

      expect(
        screen.queryByText('Requesting microphone access...'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText('Connecting to voice chat...'),
      ).not.toBeInTheDocument();
    });

    it('enables mute button when connected', () => {
      render(<VoiceChatModal {...defaultProps} connectionState="connected" />);

      expect(screen.getByLabelText('Mute microphone')).toBeEnabled();
    });

    it('enables the agent audio button when connected', () => {
      render(<VoiceChatModal {...defaultProps} connectionState="connected" />);

      expect(screen.getByLabelText('Mute agent audio')).toBeEnabled();
    });
  });

  describe('call presence', () => {
    // The indicator is the mentor's own avatar now: their face is the call,
    // their ring is their voice. The old abstract orb ran nine animations —
    // ten drifting particles, five sound-wave bars and two competing pulses —
    // none of which told you anything the status line does not say plainly.
    it('shows the mentor with their avatar and name', () => {
      render(
        <VoiceChatModal
          {...defaultProps}
          mentorName="Ada"
          mentorImage="https://cdn.example.com/ada.png"
        />,
      );

      expect(screen.getByTestId('voice-blob')).toBeInTheDocument();
      // jsdom never loads the image, so the initials fallback stands in - the
      // same one the chat shows for a mentor with no picture.
      expect(screen.getAllByText('AD').length).toBeGreaterThan(0);
      expect(screen.getByText('Ada')).toBeInTheDocument();
    });

    it('falls back to a generic name when the mentor has none', () => {
      render(<VoiceChatModal {...defaultProps} />);

      expect(screen.getAllByText('Agent').length).toBeGreaterThan(0);
    });

    it('breathes a halo while the line is open', () => {
      render(<VoiceChatModal {...defaultProps} connectionState="connected" />);

      expect(screen.getByTestId('voice-halo')).toHaveStyle({
        animation: 'voiceHalo 3.2s ease-in-out infinite',
      });
    });

    it('drops the halo when the call is not up', () => {
      render(
        <VoiceChatModal {...defaultProps} connectionState="disconnected" />,
      );

      expect(screen.queryByTestId('voice-halo')).toBeNull();
    });

    it('rings the avatar while the agent is speaking', () => {
      render(<VoiceChatModal {...defaultProps} isMentorSpeaking={true} />);

      const ring = screen.getByTestId('mentor-speaking-ring');
      expect(ring.querySelector('.border-blue-500')).toHaveStyle({
        animation: 'voiceRingPulse 1.4s ease-in-out infinite',
      });
      expect(ring.querySelector('.border-blue-400')).toHaveStyle({
        animation: 'voiceRingRipple 1.4s ease-out infinite',
      });
    });

    it('hides the mentor ring when the agent is silent', () => {
      render(<VoiceChatModal {...defaultProps} isMentorSpeaking={false} />);

      expect(screen.queryByTestId('mentor-speaking-ring')).toBeNull();
    });

    it('hides the mentor ring when agent audio is muted', () => {
      render(
        <VoiceChatModal
          {...defaultProps}
          isMentorSpeaking={true}
          isMentorAudioMuted={true}
        />,
      );

      expect(screen.queryByTestId('mentor-speaking-ring')).toBeNull();
    });

    it('hides the mentor ring when not connected', () => {
      render(
        <VoiceChatModal
          {...defaultProps}
          connectionState="disconnected"
          isMentorSpeaking={true}
        />,
      );

      expect(screen.queryByTestId('mentor-speaking-ring')).toBeNull();
    });

    it('shows the mentor ring even while the user mic is muted', () => {
      render(
        <VoiceChatModal
          {...defaultProps}
          isMicMuted={true}
          isMentorSpeaking={true}
        />,
      );

      // Regression: the indicator used to be gated on the local mic, so
      // muting yourself froze it and a live call looked dead.
      expect(screen.getByTestId('mentor-speaking-ring')).toBeInTheDocument();
    });

    it('shows the caller their own voice on their own control', () => {
      render(<VoiceChatModal {...defaultProps} isSpeaking={true} />);

      // Two speakers, two places: the mentor's voice rings their avatar, the
      // caller's lights up the microphone they control.
      expect(screen.getByLabelText('Mute microphone')).toHaveClass(
        'ring-blue-500/40',
      );
    });

    it('leaves the mic control alone while the caller is silent', () => {
      render(<VoiceChatModal {...defaultProps} isSpeaking={false} />);

      expect(screen.getByLabelText('Mute microphone')).not.toHaveClass(
        'ring-blue-500/40',
      );
    });

    it('does not light the mic control for a muted caller who is speaking', () => {
      render(
        <VoiceChatModal
          {...defaultProps}
          isSpeaking={true}
          isMicMuted={true}
        />,
      );

      expect(screen.getByLabelText('Unmute microphone')).not.toHaveClass(
        'ring-blue-500/40',
      );
    });

    it('drains the indicator when agent audio is muted', () => {
      render(<VoiceChatModal {...defaultProps} isMentorAudioMuted={true} />);

      expect(screen.getByTestId('voice-blob')).toHaveStyle({
        opacity: '0.5',
        filter: 'saturate(0.35)',
      });
    });

    it('leaves the indicator at full strength when agent audio is on', () => {
      render(<VoiceChatModal {...defaultProps} isMentorAudioMuted={false} />);

      expect(screen.getByTestId('voice-blob')).toHaveStyle({ opacity: '1' });
    });

    it('does not drain the indicator when only the mic is muted', () => {
      render(<VoiceChatModal {...defaultProps} isMicMuted={true} />);

      expect(screen.getByTestId('voice-blob')).toHaveStyle({ opacity: '1' });
    });
  });

  describe('muted state', () => {
    it('shows unmute label when muted', () => {
      render(
        <VoiceChatModal
          {...defaultProps}
          connectionState="connected"
          isMicMuted={true}
        />,
      );

      expect(screen.getByLabelText('Unmute microphone')).toBeInTheDocument();
    });

    it('shows mute label when not muted', () => {
      render(
        <VoiceChatModal
          {...defaultProps}
          connectionState="connected"
          isMicMuted={false}
        />,
      );

      expect(screen.getByLabelText('Mute microphone')).toBeInTheDocument();
    });

    it('renders muted connected state without errors', () => {
      render(
        <VoiceChatModal
          {...defaultProps}
          connectionState="connected"
          isMicMuted={true}
        />,
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('agent audio control', () => {
    it('shows the mute label when agent audio is playing', () => {
      render(<VoiceChatModal {...defaultProps} isMentorAudioMuted={false} />);

      expect(screen.getByLabelText('Mute agent audio')).toBeInTheDocument();
    });

    it('shows the unmute label when agent audio is muted', () => {
      render(<VoiceChatModal {...defaultProps} isMentorAudioMuted={true} />);

      expect(screen.getByLabelText('Unmute agent audio')).toBeInTheDocument();
    });

    it('calls toggleMentorAudio when the agent audio button is clicked', () => {
      render(<VoiceChatModal {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('Mute agent audio'));

      expect(defaultProps.toggleMentorAudio).toHaveBeenCalledTimes(1);
      expect(defaultProps.toggleMicMute).not.toHaveBeenCalled();
    });

    it('leaves the microphone control untouched when agent audio is muted', () => {
      render(<VoiceChatModal {...defaultProps} isMentorAudioMuted={true} />);

      // Mic is still live even though the agent is silenced.
      expect(screen.getByLabelText('Mute microphone')).toBeInTheDocument();
      expect(screen.getByLabelText('Mute microphone')).not.toHaveClass(
        'border-red-500',
      );
    });
  });

  describe('call status caption', () => {
    const caption = () => screen.getByLabelText('Call status');

    it('renders a single live region', () => {
      render(<VoiceChatModal {...defaultProps} />);

      const regions = screen.getAllByRole('status');
      expect(regions).toHaveLength(1);
      expect(regions[0]).toHaveAttribute('aria-label', 'Call status');
    });

    // It used to be `sr-only`: the same facts, announced but never drawn, so
    // sighted callers had to read the state off an abstract orb. One line,
    // shown to everyone, is both simpler and less to maintain.
    it('is shown, not just announced', () => {
      render(<VoiceChatModal {...defaultProps} />);

      expect(caption()).not.toHaveClass('sr-only');
      expect(caption()).toBeVisible();
    });

    it('shows "Listening…" when connected and nobody is muted or speaking', () => {
      render(<VoiceChatModal {...defaultProps} />);

      expect(caption()).toHaveTextContent('Listening…');
    });

    it('shows "Mic muted" when only the mic is muted', () => {
      render(<VoiceChatModal {...defaultProps} isMicMuted={true} />);

      expect(caption()).toHaveTextContent('Mic muted');
    });

    it('shows "Agent speaking" when the agent is speaking', () => {
      render(<VoiceChatModal {...defaultProps} isMentorSpeaking={true} />);

      expect(caption()).toHaveTextContent('Agent speaking');
    });

    it('shows "Agent muted" when agent audio is muted', () => {
      render(<VoiceChatModal {...defaultProps} isMentorAudioMuted={true} />);

      expect(caption()).toHaveTextContent('Agent muted');
    });

    it('prefers "Agent muted" over the agent speaking', () => {
      render(
        <VoiceChatModal
          {...defaultProps}
          isMentorSpeaking={true}
          isMentorAudioMuted={true}
        />,
      );

      expect(caption()).toHaveTextContent('Agent muted');
    });

    it('prefers "Agent muted" over the mic being muted', () => {
      render(
        <VoiceChatModal
          {...defaultProps}
          isMicMuted={true}
          isMentorAudioMuted={true}
        />,
      );

      expect(caption()).toHaveTextContent('Agent muted');
    });

    it('prefers "Agent speaking" over the mic being muted', () => {
      render(
        <VoiceChatModal
          {...defaultProps}
          isMicMuted={true}
          isMentorSpeaking={true}
        />,
      );

      expect(caption()).toHaveTextContent('Agent speaking');
    });

    it('does not report the user speaking - the blob shows that', () => {
      render(<VoiceChatModal {...defaultProps} isSpeaking={true} />);

      expect(caption()).toHaveTextContent('Listening…');
    });

    it('no longer renders the removed per-party status rows', () => {
      render(<VoiceChatModal {...defaultProps} />);

      expect(screen.queryByLabelText('Agent audio status')).toBeNull();
      expect(screen.queryByLabelText('Microphone status')).toBeNull();
    });
  });

  describe('control button muted treatment', () => {
    // Muted is the one state that has to survive a glance, so it borrows the
    // theme's destructive colour rather than inventing a red of its own.
    it('tints the mic control when the mic is muted', () => {
      render(<VoiceChatModal {...defaultProps} isMicMuted={true} />);

      expect(screen.getByLabelText('Unmute microphone')).toHaveClass(
        'text-destructive',
      );
    });

    it('leaves the mic control neutral when the mic is live', () => {
      render(<VoiceChatModal {...defaultProps} isMicMuted={false} />);

      const mic = screen.getByLabelText('Mute microphone');
      expect(mic).toHaveClass('text-muted-foreground');
      expect(mic).not.toHaveClass('text-destructive');
    });

    it('tints the agent audio control when agent audio is muted', () => {
      render(<VoiceChatModal {...defaultProps} isMentorAudioMuted={true} />);

      expect(screen.getByLabelText('Unmute agent audio')).toHaveClass(
        'text-destructive',
      );
    });

    it('leaves the agent audio control neutral when agent audio is on', () => {
      render(<VoiceChatModal {...defaultProps} isMentorAudioMuted={false} />);

      expect(screen.getByLabelText('Mute agent audio')).not.toHaveClass(
        'text-destructive',
      );
    });

    it('does not tint the mic control when only agent audio is muted', () => {
      render(<VoiceChatModal {...defaultProps} isMentorAudioMuted={true} />);

      expect(screen.getByLabelText('Mute microphone')).not.toHaveClass(
        'text-destructive',
      );
    });

    it('does not tint a disabled control while connecting', () => {
      render(<VoiceChatModal {...defaultProps} connectionState="connecting" />);

      // The loading state renders the muted icons, but nothing is muted yet.
      expect(screen.getByLabelText('Mute microphone')).not.toHaveClass(
        'text-destructive',
      );
      expect(screen.getByLabelText('Mute agent audio')).not.toHaveClass(
        'text-destructive',
      );
    });
  });

  describe('disconnected state', () => {
    it('renders disconnected state without sound waves', () => {
      render(
        <VoiceChatModal {...defaultProps} connectionState="disconnected" />,
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('button interactions', () => {
    it('calls toggleMicMute when mute button is clicked', () => {
      render(<VoiceChatModal {...defaultProps} connectionState="connected" />);

      fireEvent.click(screen.getByLabelText('Mute microphone'));

      expect(defaultProps.toggleMicMute).toHaveBeenCalledTimes(1);
      expect(defaultProps.toggleMentorAudio).not.toHaveBeenCalled();
    });

    it('calls onClose when close button is clicked', () => {
      render(<VoiceChatModal {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('Close voice chat'));

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('call clock', () => {
    const duration = () => screen.getByTestId('voice-call-duration');

    /** Let the interval fire `seconds` times, with the wall clock moved on. */
    function advance(seconds: number) {
      act(() => {
        vi.advanceTimersByTime(seconds * 1000);
      });
    }

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('starts at zero and counts the call up', () => {
      render(<VoiceChatModal {...defaultProps} connectionState="connected" />);

      expect(duration()).toHaveTextContent('0:00');

      advance(75);

      expect(duration()).toHaveTextContent('1:15');
    });

    it('appears only once the call is up', () => {
      const { rerender } = render(
        <VoiceChatModal {...defaultProps} connectionState="connecting" />,
      );

      expect(screen.queryByTestId('voice-call-duration')).toBeNull();

      rerender(
        <VoiceChatModal {...defaultProps} connectionState="connected" />,
      );

      expect(duration()).toHaveTextContent('0:00');
    });

    it('restarts rather than carrying a stale number through a reconnect', () => {
      const { rerender } = render(
        <VoiceChatModal {...defaultProps} connectionState="connected" />,
      );

      advance(42);
      expect(duration()).toHaveTextContent('0:42');

      rerender(
        <VoiceChatModal {...defaultProps} connectionState="reconnecting" />,
      );
      rerender(
        <VoiceChatModal {...defaultProps} connectionState="connected" />,
      );

      expect(duration()).toHaveTextContent('0:00');
    });

    it('stops ticking when the call ends', () => {
      const { rerender } = render(
        <VoiceChatModal {...defaultProps} connectionState="connected" />,
      );

      advance(10);
      rerender(
        <VoiceChatModal {...defaultProps} connectionState="disconnected" />,
      );
      advance(30);

      // Nothing left running to update a clock nobody is looking at.
      expect(screen.queryByTestId('voice-call-duration')).toBeNull();
    });
  });

  describe('formatCallDuration', () => {
    it('pads the seconds but not the minutes, the way a phone does', () => {
      expect(formatCallDuration(0)).toBe('0:00');
      expect(formatCallDuration(9)).toBe('0:09');
      expect(formatCallDuration(70)).toBe('1:10');
      expect(formatCallDuration(600)).toBe('10:00');
    });

    it('adds an hours field once the call runs past one', () => {
      expect(formatCallDuration(3600)).toBe('1:00:00');
      expect(formatCallDuration(3725)).toBe('1:02:05');
    });

    it('never renders a negative or fractional clock', () => {
      // Clock skew and a mid-second render should not produce "-0:01" or
      // "0:07.5" on screen.
      expect(formatCallDuration(-5)).toBe('0:00');
      expect(formatCallDuration(7.9)).toBe('0:07');
    });
  });

  describe('status dot', () => {
    const dot = () => screen.getByTestId('voice-status-dot');

    it('is green while the line is simply open', () => {
      render(<VoiceChatModal {...defaultProps} />);

      expect(dot()).toHaveClass('bg-emerald-500');
    });

    it('turns blue and pulses while the agent talks', () => {
      render(<VoiceChatModal {...defaultProps} isMentorSpeaking={true} />);

      expect(dot()).toHaveClass('bg-blue-500');
      expect(dot()).toHaveClass('animate-pulse');
    });

    it('warns in the destructive colour whenever something is muted', () => {
      const { rerender } = render(
        <VoiceChatModal {...defaultProps} isMicMuted={true} />,
      );

      expect(dot()).toHaveClass('bg-destructive');

      rerender(<VoiceChatModal {...defaultProps} isMentorAudioMuted={true} />);

      expect(dot()).toHaveClass('bg-destructive');
    });

    it('gives way to a spinner while connecting', () => {
      render(<VoiceChatModal {...defaultProps} connectionState="connecting" />);

      expect(screen.queryByTestId('voice-status-dot')).toBeNull();
      expect(
        screen.getByLabelText('Call status').querySelector('.animate-spin'),
      ).toBeInTheDocument();
    });
  });

  describe('captions toggle', () => {
    // Label-agnostic: the control says "Hide captions" by default now, and
    // "Show captions" only once the user has turned them off.
    const ccButton = () => screen.getByRole('button', { name: /captions/i });

    it('renders a captions control between agent audio and end call', () => {
      render(<VoiceChatModal {...defaultProps} />);

      // Radix contributes its own unlabelled dialog close button; only the
      // call controls carry aria-labels.
      const labels = screen
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label'))
        .filter(Boolean);
      expect(labels).toEqual([
        'Mute microphone',
        'Mute agent audio',
        'Hide captions',
        'Close voice chat',
      ]);
    });

    it('is styled as a peer of the other two circular controls', () => {
      render(<VoiceChatModal {...defaultProps} />);

      expect(ccButton()).toHaveClass('size-11', 'rounded-full');
      expect(screen.getByLabelText('Mute microphone')).toHaveClass(
        'size-11',
        'rounded-full',
      );
    });

    it('sits with the other toggles, apart from the button that hangs up', () => {
      render(<VoiceChatModal {...defaultProps} />);

      // The three toggles share one pill; the only control that leaves the
      // call is the only one outside it.
      const pill = screen.getByLabelText('Mute microphone').parentElement;
      expect(pill).toContainElement(screen.getByLabelText('Mute agent audio'));
      expect(pill).toContainElement(ccButton());
      expect(pill).not.toContainElement(
        screen.getByLabelText('Close voice chat'),
      );
    });

    it('starts on, so a call is captioned without anyone asking', () => {
      render(
        <VoiceChatModal
          {...defaultProps}
          transcript={[entry('s1', 'Hello', 'agent')]}
        />,
      );

      expect(screen.getByRole('log')).toBeInTheDocument();
      expect(screen.getByTestId('voice-transcript')).toBeInTheDocument();
      expect(ccButton()).toHaveAttribute('aria-pressed', 'true');
    });

    it('hides the band when switched off and brings it back when switched on', () => {
      render(
        <VoiceChatModal
          {...defaultProps}
          transcript={[entry('s1', 'Hello', 'agent')]}
        />,
      );

      fireEvent.click(screen.getByLabelText('Hide captions'));

      const toggledOff = screen.getByLabelText('Show captions');
      expect(toggledOff).toHaveAttribute('aria-pressed', 'false');
      expect(screen.queryByRole('log')).toBeNull();

      fireEvent.click(toggledOff);

      expect(screen.getByRole('log')).toBeInTheDocument();
      expect(ccButton()).toHaveAttribute('aria-pressed', 'true');
    });

    it('is disabled while connecting, like the other controls', () => {
      render(<VoiceChatModal {...defaultProps} connectionState="connecting" />);

      expect(ccButton()).toBeDisabled();
    });

    it('does not tint the captions control while connecting', () => {
      render(<VoiceChatModal {...defaultProps} connectionState="connecting" />);

      // Even though captions are on, a disabled control must not read as an
      // active one.
      expect(ccButton()).toHaveClass('text-muted-foreground');
      expect(ccButton()).not.toHaveClass('text-blue-600');
    });

    it('marks the control as active while captions are on', () => {
      render(<VoiceChatModal {...defaultProps} />);

      expect(ccButton()).toHaveClass('text-blue-600');

      fireEvent.click(ccButton());

      expect(screen.getByLabelText('Show captions')).not.toHaveClass(
        'text-blue-600',
      );
    });
  });

  describe('captions preference persistence', () => {
    it('writes the choice to localStorage when turned off', () => {
      render(<VoiceChatModal {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('Hide captions'));

      expect(window.localStorage.getItem(CAPTIONS_STORAGE_KEY)).toBe('false');
    });

    it('writes the choice to localStorage when turned back on', () => {
      rememberCaptionsOff();
      render(<VoiceChatModal {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('Show captions'));

      expect(window.localStorage.getItem(CAPTIONS_STORAGE_KEY)).toBe('true');
    });

    it('keeps captions off on mount when a previous call turned them off', () => {
      rememberCaptionsOff();

      render(
        <VoiceChatModal
          {...defaultProps}
          transcript={[entry('s1', 'Hello', 'agent')]}
        />,
      );

      expect(screen.queryByRole('log')).toBeNull();
      expect(screen.getByLabelText('Show captions')).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    });

    it('restores captions on mount when a previous call left them on', () => {
      rememberCaptionsOn();

      render(
        <VoiceChatModal
          {...defaultProps}
          transcript={[entry('s1', 'Hello', 'agent')]}
        />,
      );

      expect(screen.getByRole('log')).toBeInTheDocument();
      expect(screen.getByLabelText('Hide captions')).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });

    it('only an explicit "false" turns captions off', () => {
      // Anything else - a value from a future version, a half-written one -
      // falls back to the default rather than to silence.
      window.localStorage.setItem(CAPTIONS_STORAGE_KEY, 'off');

      render(<VoiceChatModal {...defaultProps} />);

      expect(screen.getByRole('log')).toBeInTheDocument();
    });

    it('falls back to on when reading storage throws', () => {
      vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });

      render(<VoiceChatModal {...defaultProps} />);

      expect(screen.getByLabelText('Hide captions')).toBeInTheDocument();
      expect(screen.getByRole('log')).toBeInTheDocument();
    });

    // The modal itself cannot run without a DOM, so the server-render guard is
    // exercised against the helpers directly.
    describe('without a window (server render)', () => {
      /**
       * `window` is put back before yielding to the event loop: leaving it
       * undefined across an await lets unrelated async DOM work (Radix's
       * tooltip positioning) blow up.
       */
      function withoutWindow<T>(run: () => T): T {
        vi.stubGlobal('window', undefined);
        try {
          return run();
        } finally {
          vi.unstubAllGlobals();
        }
      }

      it('reports the default instead of touching storage', () => {
        const getItem = vi.spyOn(window.localStorage, 'getItem');

        expect(withoutWindow(() => readCaptionsPreference())).toBe(true);
        expect(getItem).not.toHaveBeenCalled();
      });

      it('silently skips writing the preference', () => {
        const setItem = vi.spyOn(window.localStorage, 'setItem');

        expect(() =>
          withoutWindow(() => writeCaptionsPreference(true)),
        ).not.toThrow();
        expect(setItem).not.toHaveBeenCalled();
      });
    });

    it('keeps the toggle working when writing to storage throws', () => {
      vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      render(
        <VoiceChatModal
          {...defaultProps}
          transcript={[entry('s1', 'Hello', 'agent')]}
        />,
      );

      fireEvent.click(screen.getByLabelText('Hide captions'));

      // The preference is lost for next time, but this call still honours the
      // click - a storage failure must never break the modal.
      expect(screen.queryByRole('log')).toBeNull();
      expect(screen.getByLabelText('Show captions')).toBeInTheDocument();
    });
  });

  describe('caption band', () => {
    const lines = () => screen.queryAllByTestId('voice-transcript-line');

    const speakers = () => screen.queryAllByTestId('voice-transcript-speaker');

    // Every turn is a speaker followed by its text, so who-said-what is read
    // back by pairing the two. Composed from the pair rather than the turn's
    // own `textContent`, which also picks up the avatar's initials.
    const spokenExchange = () =>
      screen.queryAllByTestId('voice-transcript-turn').map((turn) => {
        const speaker = turn.querySelector(
          '[data-testid="voice-transcript-speaker"]',
        );
        const line = turn.querySelector(
          '[data-testid="voice-transcript-line"]',
        );
        return `${speaker?.textContent ?? ''}${line?.textContent ?? ''}`;
      });

    function renderWithCaptions(props: Record<string, unknown> = {}) {
      rememberCaptionsOn();
      return render(<VoiceChatModal {...defaultProps} {...props} />);
    }

    it('exposes a polite log region with a stable label', () => {
      renderWithCaptions();

      const region = screen.getByRole('log');
      expect(region).toHaveAttribute('aria-label', 'Call transcript');
      expect(region).toHaveAttribute('aria-live', 'polite');
      // Only new/changed lines are announced - the lines still on screen are
      // never re-read.
      expect(region).toHaveAttribute('aria-relevant', 'additions text');
      // The band scrolls, so it has to be reachable without a pointer - and
      // reaching it has to be visible when you get there.
      expect(region).toHaveAttribute('tabindex', '0');
      expect(region).toHaveClass('focus-visible:ring-2');
      expect(region).toHaveClass('focus-visible:ring-ring');
    });

    it('does not turn the transcript into a second status region', () => {
      renderWithCaptions({ transcript: [entry('s1', 'Hello', 'agent')] });

      const statusRegions = screen.getAllByRole('status');
      expect(statusRegions).toHaveLength(1);
      expect(statusRegions[0]).toHaveAttribute('aria-label', 'Call status');
    });

    it('shows a neutral empty state before the first utterance', () => {
      renderWithCaptions();

      expect(screen.getByTestId('voice-transcript-empty')).toHaveTextContent(
        'The live transcript will appear here as the conversation starts.',
      );
      expect(lines()).toHaveLength(0);
    });

    it('replaces the empty state once lines arrive', () => {
      renderWithCaptions({ transcript: [entry('s1', 'Hello there', 'agent')] });

      expect(screen.queryByTestId('voice-transcript-empty')).toBeNull();
      expect(lines()).toHaveLength(1);
    });

    it('renders lines oldest first', () => {
      renderWithCaptions({
        transcript: [
          entry('s1', 'First', 'agent'),
          entry('s2', 'Second', 'user'),
        ],
      });

      expect(spokenExchange()).toEqual(['AgentFirst', 'YouSecond']);
    });

    it('keeps the whole conversation, not just the last exchange', () => {
      renderWithCaptions({
        transcript: [
          entry('s1', 'One', 'agent'),
          entry('s2', 'Two', 'user'),
          entry('s3', 'Three', 'agent'),
          entry('s4', 'Four', 'user'),
          entry('s5', 'Five', 'agent'),
        ],
      });

      // Trimming to the current exchange meant the call you had just had was
      // gone the moment it moved on, and you had to take it on trust.
      expect(spokenExchange()).toEqual([
        'AgentOne',
        'YouTwo',
        'AgentThree',
        'YouFour',
        'AgentFive',
      ]);
    });

    it('folds a turn that arrived in pieces into one bubble', () => {
      renderWithCaptions({
        transcript: [
          entry('s1', 'A question', 'user'),
          entry('s2', 'First half of the reply', 'agent'),
          entry('s3', 'second half of the reply', 'agent'),
        ],
      });

      // The recogniser flushes mid-sentence; that is not a message boundary.
      expect(spokenExchange()).toEqual([
        'YouA question',
        'AgentFirst half of the reply second half of the reply',
      ]);
    });

    it('puts the newest turn at the bottom', () => {
      renderWithCaptions({
        transcript: [
          entry('s1', 'One', 'agent'),
          entry('s2', 'Two', 'user'),
          entry('s3', 'Three', 'agent'),
          entry('s4', 'Four', 'user'),
        ],
      });

      const rendered = lines();
      expect(rendered).toHaveLength(4);
      expect(rendered[3]).toHaveAttribute('data-newest', 'true');
      rendered
        .slice(0, 3)
        .forEach((line) =>
          expect(line).toHaveAttribute('data-newest', 'false'),
        );
    });

    it('shows one bubble while a single speaker is still going', () => {
      renderWithCaptions({
        transcript: [entry('s1', 'One', 'agent'), entry('s2', 'Two', 'agent')],
      });

      const rendered = lines();
      expect(rendered).toHaveLength(1);
      expect(rendered[0]).toHaveTextContent('One Two');
      expect(rendered[0]).toHaveAttribute('data-newest', 'true');
    });

    it('takes the height the card sets aside for it, and scrolls', () => {
      renderWithCaptions({
        transcript: [
          entry('s1', 'One', 'agent'),
          entry('s2', 'Two', 'user'),
          entry('s3', 'Three', 'agent'),
        ],
      });

      const band = screen.getByTestId('voice-transcript');
      expect(band).toHaveClass('flex-1');
      expect(band).toHaveClass('min-h-0');
      expect(band).toHaveClass('overflow-y-auto');
      // Sideways is still the dialog's business, not the band's.
      expect(band).toHaveClass('overflow-x-hidden');
    });

    it('gives a captioned call a card tall enough to sit with', () => {
      renderWithCaptions({ transcript: [entry('s1', 'One', 'agent')] });

      const card = screen
        .getByTestId('voice-transcript')
        .closest('[role="dialog"] > div');
      expect(card?.className).toContain('h-[min(46rem,88vh)]');
    });

    it('lets the card shrink back to its contents when captions are off', () => {
      rememberCaptionsOff();
      render(<VoiceChatModal {...defaultProps} />);

      // Nothing to fill a tall card with, so it stops framing empty space.
      const card = screen
        .getByTestId('voice-blob')
        .closest('[role="dialog"] > div');
      expect(card?.className).not.toContain('h-[min(46rem,88vh)]');
    });

    it('gives the captions their own surface', () => {
      renderWithCaptions({ transcript: [entry('s1', 'One', 'agent')] });

      // A tinted panel with a border, so the transcript reads as part of the
      // card rather than as text floating in it.
      const panel = screen.getByTestId('voice-transcript').parentElement;
      expect(panel).toHaveClass('border-t');
      expect(panel).toHaveClass('bg-muted/40');
    });

    it('leaves the presence indicator and the controls their own size', () => {
      renderWithCaptions({ transcript: [entry('s1', 'One', 'agent')] });

      // The band is the only thing that scrolls; if these could shrink, a
      // long exchange would eat the mentor's avatar instead.
      expect(screen.getByTestId('voice-blob')).toHaveClass('shrink-0');
      const controls = screen
        .getByLabelText('Mute microphone')
        .closest('div.border-t') as HTMLElement;
      expect(controls).toHaveClass('shrink-0');
    });

    it('clips at its edges rather than fading them out', () => {
      renderWithCaptions({
        transcript: [
          entry('s1', REAL_AGENT_TURN, 'user'),
          entry('s2', REAL_AGENT_TURN, 'agent', false),
        ],
      });

      // A fade was right when the band was loose rows of text. Against a
      // message bubble it dissolves the bubble's own background into the
      // dialog, so the message looks like it is disintegrating instead of
      // scrolling. A bubble cut off at the edge is what chat threads do.
      expect(screen.getByTestId('voice-transcript').className).not.toContain(
        'mask-image',
      );
    });

    // A turn longer than the band used to be clipped: the start of a
    // paragraph-long answer scrolled out of the top of its window and was
    // simply gone. It is only ever two messages, so the band scrolls instead
    // and follows the live line by itself. jsdom has no layout engine, so
    // scroll geometry is stubbed on the element.
    describe('scrollback', () => {
      /** Give the band a viewport smaller than its content, as a browser would. */
      function makeBandScrollable(
        band: HTMLElement,
        { scrollHeight = 400, clientHeight = 160 } = {},
      ) {
        Object.defineProperty(band, 'scrollHeight', {
          value: scrollHeight,
          configurable: true,
        });
        Object.defineProperty(band, 'clientHeight', {
          value: clientHeight,
          configurable: true,
        });
        return band;
      }

      it('keeps the whole exchange in the DOM, clamping nothing', () => {
        renderWithCaptions({
          mentorName: 'Ada',
          transcript: [
            entry('s1', REAL_AGENT_TURN, 'user'),
            entry('s2', REAL_AGENT_TURN, 'agent', false),
          ],
        });

        // Both turns, in full: the answered one is no longer capped at two
        // rows and the live one is no longer capped at three.
        const [older, newest] = lines();
        expect(older).toHaveTextContent(REAL_AGENT_TURN.slice(0, 40));
        expect(older.textContent).toHaveLength(REAL_AGENT_TURN.length);
        expect(newest.textContent).toContain(REAL_AGENT_TURN.slice(-40));
        [older, newest].forEach((line) => {
          expect(line.className).not.toContain('line-clamp');
          expect(line.className).not.toContain('max-h-');
        });
      });

      it('scrolls the live line into view as the turn grows', () => {
        rememberCaptionsOn();
        const { rerender } = render(
          <VoiceChatModal
            {...defaultProps}
            transcript={[entry('s1', 'Half a sentence', 'agent', false)]}
          />,
        );

        const band = makeBandScrollable(screen.getByTestId('voice-transcript'));
        band.scrollTop = 0;

        rerender(
          <VoiceChatModal
            {...defaultProps}
            transcript={[
              entry('s1', `Half a sentence ${REAL_AGENT_TURN}`, 'agent', false),
            ]}
          />,
        );

        expect(band.scrollTop).toBe(band.scrollHeight);
        expect(band).toHaveAttribute('data-following', 'true');
      });

      it('keeps its edges clean whether it is following or not', () => {
        renderWithCaptions({
          transcript: [entry('s1', REAL_AGENT_TURN, 'agent', false)],
        });

        const band = makeBandScrollable(screen.getByTestId('voice-transcript'));
        expect(band.className).not.toContain('mask-image');

        band.scrollTop = 40;
        fireEvent.scroll(band);

        // Scrolling back must not start dissolving the bubbles either.
        expect(band.className).not.toContain('mask-image');
      });

      it('stops following once the reader scrolls up', () => {
        renderWithCaptions({
          transcript: [
            entry('s1', 'A question', 'user'),
            entry('s2', REAL_AGENT_TURN, 'agent', false),
          ],
        });

        const band = makeBandScrollable(screen.getByTestId('voice-transcript'));
        band.scrollTop = 40;
        fireEvent.scroll(band);

        expect(band).toHaveAttribute('data-following', 'false');
      });

      it('leaves a reader who scrolled up where they are', () => {
        rememberCaptionsOn();
        const { rerender } = render(
          <VoiceChatModal
            {...defaultProps}
            transcript={[entry('s1', REAL_AGENT_TURN, 'agent', false)]}
          />,
        );

        const band = makeBandScrollable(screen.getByTestId('voice-transcript'));
        band.scrollTop = 40;
        fireEvent.scroll(band);

        rerender(
          <VoiceChatModal
            {...defaultProps}
            transcript={[
              entry(
                's1',
                `${REAL_AGENT_TURN} and then some more`,
                'agent',
                false,
              ),
            ]}
          />,
        );

        // Yanking the view back to the bottom mid-sentence is the reason
        // scrollback is worth having at all.
        expect(band.scrollTop).toBe(40);
      });

      it('follows again when the reader returns to the bottom', () => {
        renderWithCaptions({
          transcript: [entry('s1', REAL_AGENT_TURN, 'agent', false)],
        });

        const band = makeBandScrollable(screen.getByTestId('voice-transcript'));
        band.scrollTop = 40;
        fireEvent.scroll(band);
        expect(band).toHaveAttribute('data-following', 'false');

        band.scrollTop = band.scrollHeight - band.clientHeight;
        fireEvent.scroll(band);

        expect(band).toHaveAttribute('data-following', 'true');
      });

      it('treats a few pixels short of the bottom as still following', () => {
        renderWithCaptions({
          transcript: [entry('s1', REAL_AGENT_TURN, 'agent', false)],
        });

        const band = makeBandScrollable(screen.getByTestId('voice-transcript'));
        // Sub-pixel layout and momentum scrolling rarely land exactly on zero.
        band.scrollTop = band.scrollHeight - band.clientHeight - 4;
        fireEvent.scroll(band);

        expect(band).toHaveAttribute('data-following', 'true');
      });

      it('re-arms following when the next turn starts', () => {
        rememberCaptionsOn();
        const { rerender } = render(
          <VoiceChatModal
            {...defaultProps}
            transcript={[entry('s1', REAL_AGENT_TURN, 'agent', false)]}
          />,
        );

        const band = makeBandScrollable(screen.getByTestId('voice-transcript'));
        band.scrollTop = 40;
        fireEvent.scroll(band);
        expect(band).toHaveAttribute('data-following', 'false');

        rerender(
          <VoiceChatModal
            {...defaultProps}
            transcript={[
              entry('s1', REAL_AGENT_TURN, 'agent'),
              entry('s2', 'A new question', 'user', false),
            ]}
          />,
        );

        // The band only ever shows the current exchange, so a scroll position
        // left over from the previous one is stale.
        expect(band).toHaveAttribute('data-following', 'true');
        expect(band.scrollTop).toBe(band.scrollHeight);
      });

      it('sits a short exchange at the bottom, as a chat thread does', () => {
        renderWithCaptions({
          transcript: [
            entry('s1', 'A question', 'user'),
            entry('s2', 'A reply', 'agent'),
          ],
        });

        // An auto margin, not flex alignment: aligning a scroll container's
        // content puts overflow above the scroll origin, where it cannot be
        // reached. An auto margin collapses to zero as soon as it overflows.
        const content = lines()[0].closest(
          '[data-testid="voice-transcript"] > div',
        );
        expect(content).toHaveClass('mt-auto');
        const band = screen.getByTestId('voice-transcript');
        expect(band.className).not.toContain('justify-end');
        expect(band.className).not.toContain('justify-center');
      });

      it('separates the turns the way the chat thread does', () => {
        renderWithCaptions({
          transcript: [
            entry('s1', 'A question', 'user'),
            entry('s2', 'A reply', 'agent'),
          ],
        });

        // The two halves of the exchange used to sit one row apart with no
        // gap, which is what made them read as a single mangled paragraph.
        screen
          .getAllByTestId('voice-transcript-turn')
          .forEach((turn) => expect(turn).toHaveClass('mb-4'));
      });
    });

    // The band renders the same bubbles as the chat thread the call belongs
    // to, minus the action toolbar: those actions need a saved message to act
    // on, and a caption is not one until the call ends.
    describe('chat-message styling', () => {
      it('gives the caller a right-aligned blue bubble, as in the chat', () => {
        renderWithCaptions({ transcript: [entry('s1', 'My words', 'user')] });

        const turn = screen.getByTestId('voice-transcript-turn');
        expect(turn).toHaveClass('items-end');
        const bubble = lines()[0];
        expect(bubble).toHaveClass('rounded-2xl');
        expect(bubble).toHaveClass('bg-blue-50');
        expect(bubble).toHaveClass('text-sm');
      });

      it('names the caller for assistive tech only, as the chat does', () => {
        renderWithCaptions({ transcript: [entry('s1', 'My words', 'user')] });

        // The chat gives your own bubble no visible name; the log is still
        // read aloud, where losing who-said-what is not cosmetic.
        const label = screen.getByTestId('voice-transcript-speaker');
        expect(label).toHaveTextContent('You');
        expect(label).toHaveClass('sr-only');
      });

      it('gives the mentor an avatar, a name and a grey bubble', () => {
        renderWithCaptions({
          mentorName: 'Ada',
          mentorImage: 'https://cdn.example.com/ada.png',
          transcript: [entry('s1', 'Their words', 'agent')],
        });

        const label = screen.getByTestId('voice-transcript-speaker');
        expect(label).toHaveTextContent('Ada');
        expect(label).toHaveClass('text-gray-900');
        expect(label.className).not.toContain('sr-only');

        const bubble = lines()[0];
        expect(bubble).toHaveClass('rounded-2xl');
        // White on the tinted caption panel, the way the chat's grey bubble
        // sits on the chat's white page: a raised surface either way.
        expect(bubble).toHaveClass('bg-white');
        expect(bubble).toHaveClass('text-sm/6');
      });

      it('falls back to the mentor initials when there is no avatar', () => {
        renderWithCaptions({
          mentorName: 'Ada',
          transcript: [entry('s1', 'Their words', 'agent')],
        });

        // jsdom never loads the image, so Radix shows the fallback - which is
        // exactly what a mentor with no picture gets in the chat too. Two of
        // them: the call's own avatar and this turn's.
        expect(screen.getAllByText('AD')).toHaveLength(2);
      });

      it('carries none of the chat action buttons', () => {
        renderWithCaptions({
          mentorName: 'Ada',
          transcript: [
            entry('s1', 'A question', 'user'),
            entry('s2', 'A reply', 'agent'),
          ],
        });

        // Copy/rate/share/read-aloud all act on a saved message; a caption has
        // no server-side identity to act on until the call is over.
        const labels = screen
          .getAllByRole('button')
          .map((button) => button.getAttribute('aria-label'))
          .filter(Boolean);
        expect(labels).toEqual([
          'Mute microphone',
          'Mute agent audio',
          'Hide captions',
          'Close voice chat',
        ]);
      });
    });

    it('gives every turn a speaker row of its own', () => {
      renderWithCaptions({
        mentorName: 'Ada',
        transcript: [
          entry('s1', 'A question', 'user'),
          entry('s2', REAL_AGENT_TURN, 'agent', false),
        ],
      });

      // Inline, a label is the first thing to scroll out of view, so a
      // paragraph-long reply lost its name exactly when it needed one.
      expect(speakers().map((s) => s.textContent)).toEqual(['You', 'Ada']);
      expect(speakers().map((s) => s.getAttribute('data-speaker'))).toEqual([
        'user',
        'agent',
      ]);
      // No label is left inside the text itself.
      lines().forEach((line) => expect(line.textContent).not.toContain('Ada'));
    });

    it('gives the answered turn the same weight as the live one', () => {
      renderWithCaptions({
        transcript: [
          entry('s1', 'A question', 'user'),
          entry('s2', 'A reply', 'agent'),
        ],
      });

      // Both are chat messages now; dimming the first half of an exchange was
      // part of what made the band read as damaged rather than as a thread.
      [...speakers(), ...lines()].forEach((node) =>
        expect(node.className).not.toContain('opacity-'),
      );
    });

    it('falls back to the LiveKit participant name when no mentor name is given', () => {
      renderWithCaptions({
        transcript: [
          entry('s1', 'Their words', 'agent', true, {
            participantName: 'Agent Seven',
          }),
        ],
      });

      expect(screen.getByTestId('voice-transcript-speaker')).toHaveTextContent(
        'Agent Seven',
      );
    });

    it('falls back to a generic agent label as a last resort', () => {
      renderWithCaptions({ transcript: [entry('s1', 'Their words', 'agent')] });

      expect(screen.getByTestId('voice-transcript-speaker')).toHaveTextContent(
        'Agent',
      );
    });

    it('never labels a user line with the mentor name', () => {
      renderWithCaptions({
        mentorName: 'Ada',
        transcript: [
          entry('s1', 'My words', 'user', true, { participantName: 'Ada' }),
        ],
      });

      expect(screen.getByTestId('voice-transcript-speaker')).toHaveTextContent(
        'You',
      );
    });

    it('tags each line with its place in the exchange', () => {
      renderWithCaptions({
        transcript: [
          entry('s1', 'Older', 'user'),
          entry('s2', 'Newest', 'agent'),
        ],
      });

      const [older, newest] = lines();
      expect(older).toHaveAttribute('data-age', '1');
      expect(older).toHaveAttribute('data-newest', 'false');
      expect(newest).toHaveAttribute('data-age', '0');
      expect(newest).toHaveAttribute('data-newest', 'true');
    });

    it('marks an in-progress line with a caret', () => {
      renderWithCaptions({
        transcript: [entry('s1', 'Still talk', 'agent', false)],
      });

      const caret = screen.getByTestId('voice-transcript-caret');
      expect(caret).toHaveAttribute('aria-hidden', 'true');
      expect(caret).toHaveStyle({
        animation: 'transcriptCaret 1s ease-in-out infinite',
      });
      expect(lines()[0]).toHaveAttribute('data-final', 'false');
    });

    it('settles the caret when the line finalises', () => {
      rememberCaptionsOn();
      const { rerender } = render(
        <VoiceChatModal
          {...defaultProps}
          transcript={[entry('s1', 'Still talk', 'agent', false)]}
        />,
      );

      expect(screen.getByTestId('voice-transcript-caret')).toBeInTheDocument();

      rerender(
        <VoiceChatModal
          {...defaultProps}
          transcript={[entry('s1', 'Still talking', 'agent', true)]}
        />,
      );

      expect(screen.queryByTestId('voice-transcript-caret')).toBeNull();
      expect(lines()[0]).toHaveAttribute('data-final', 'true');
    });

    it('tags each line with its speaker for styling and selection', () => {
      renderWithCaptions({
        transcript: [
          entry('s1', 'Mine', 'user'),
          entry('s2', 'Theirs', 'agent'),
        ],
      });

      expect(lines().map((l) => l.getAttribute('data-speaker'))).toEqual([
        'user',
        'agent',
      ]);
    });

    it('no longer renders the removed scrollback affordances', () => {
      renderWithCaptions({
        transcript: [entry('s1', 'Hello', 'agent')],
      });

      expect(screen.queryByTestId('voice-transcript-scroll')).toBeNull();
      expect(screen.queryByTestId('voice-transcript-jump')).toBeNull();
      expect(screen.queryByTestId('voice-transcript-live')).toBeNull();
    });
  });

  // Regression: the captions band used to widen the whole dialog, so text ran
  // past the modal's edge - but only sometimes, because it depended on how long
  // the agent's last turn happened to be.
  //
  // Cause: `truncate` expands to `white-space: nowrap`, and a nowrap box's
  // intrinsic minimum width is its entire unwrapped line. `DialogContent` is a
  // CSS grid and grid items default to `min-width: auto`, so that intrinsic
  // width propagated all the way up and sized the dialog to the longest line.
  // A short older line stayed under `max-w-lg` and looked fine; a 500-character
  // agent paragraph did not. jsdom has no layout engine, so these assert the
  // constraints rather than measured pixels.
  describe('horizontal overflow constraints', () => {
    const lines = () => screen.queryAllByTestId('voice-transcript-line');

    function renderWithCaptions(props: Record<string, unknown> = {}) {
      rememberCaptionsOn();
      return render(<VoiceChatModal {...defaultProps} {...props} />);
    }

    it('never puts a nowrap line in the band, however long the turn', () => {
      renderWithCaptions({
        mentorName: 'Agent Taha',
        transcript: [
          entry('s1', REAL_AGENT_TURN, 'agent'),
          entry(
            's2',
            'No, not really, but I think that is good enough.',
            'user',
          ),
        ],
      });

      expect(lines()).toHaveLength(2);
      lines().forEach((line) => {
        // `truncate` is the class that carried `white-space: nowrap`.
        expect(line).not.toHaveClass('truncate');
        expect(line.className).not.toContain('whitespace-nowrap');
        expect(line.className).not.toContain('text-nowrap');
      });
      // Overflow is the band's scrollbar's problem now, and a wrapped line has
      // a wrappable intrinsic width whatever its length.
      expect(screen.getByTestId('voice-transcript')).toHaveClass(
        'overflow-y-auto',
      );
    });

    it('keeps the live speaker row wrappable too', () => {
      renderWithCaptions({
        mentorName: `Agent ${UNBREAKABLE_URL}`,
        transcript: [entry('s1', REAL_AGENT_TURN, 'agent')],
      });

      // A mentor name is user-supplied, so the one-row cap has to come from
      // `line-clamp`, never from `truncate`'s `white-space: nowrap` - that is
      // the exact class of bug this band already had once.
      const label = screen.getByTestId('voice-transcript-speaker');
      expect(label).toHaveClass('line-clamp-1');
      expect(label).toHaveClass('break-words');
      expect(label).toHaveClass('min-w-0');
      expect(label).not.toHaveClass('truncate');
      expect(label.className).not.toContain('whitespace-nowrap');
    });

    it('lets an unbreakable token wrap instead of pushing the layout wide', () => {
      renderWithCaptions({
        transcript: [
          entry('s1', `See ${UNBREAKABLE_URL}`, 'user'),
          entry('s2', `Mirrored at ${UNBREAKABLE_URL}`, 'agent'),
        ],
      });

      lines().forEach((line) => {
        expect(line).toHaveClass('break-words');
        expect(line).toHaveClass('min-w-0');
      });
    });

    it('caps the band inside the dialog rather than beyond it', () => {
      renderWithCaptions({
        transcript: [entry('s1', REAL_AGENT_TURN, 'agent')],
      });

      const band = screen.getByTestId('voice-transcript');
      // The band fills the card and no more: it once declared `max-w-xl`
      // (36rem), a cap wider than its own container could ever grant - dead at
      // best, misleading at worst.
      expect(band).toHaveClass('w-full');
      expect(band).not.toHaveClass('max-w-xl');
      expect(band).toHaveClass('min-w-0');
    });

    it('breaks the min-width chain at the dialog grid item', () => {
      renderWithCaptions({
        transcript: [entry('s1', REAL_AGENT_TURN, 'agent')],
      });

      // Walk up from the band to the dialog and require every box on the way
      // to be allowed to shrink. One missing `min-w-0` restores the bug.
      const dialog = screen.getByRole('dialog');
      let node = screen.getByTestId('voice-transcript').parentElement;
      const chain: HTMLElement[] = [];
      while (node && node !== dialog) {
        chain.push(node);
        node = node.parentElement;
      }

      expect(chain.length).toBeGreaterThan(0);
      chain.forEach((box) => expect(box).toHaveClass('min-w-0'));
    });

    it('collapses newlines rather than honouring them - a caption is not a document', () => {
      renderWithCaptions({
        transcript: [entry('s1', REAL_AGENT_TURN, 'agent')],
      });

      // No `whitespace-pre`/`pre-wrap`: the paragraph breaks in an agent turn
      // would each cost a row of a five-row band.
      expect(lines()[0].className).not.toContain('whitespace-pre');
    });
  });

  describe('groupTranscriptTurns', () => {
    const shape = (turns: ReturnType<typeof groupTranscriptTurns>) =>
      turns.map((turn) => `${turn.speaker}:${turn.text}`);

    it('returns nothing for an empty transcript', () => {
      expect(groupTranscriptTurns([])).toEqual([]);
    });

    it('keeps alternating turns as they came', () => {
      expect(
        shape(
          groupTranscriptTurns([
            entry('s1', 'One', 'agent'),
            entry('s2', 'Two', 'user'),
            entry('s3', 'Three', 'agent'),
          ]),
        ),
      ).toEqual(['agent:One', 'user:Two', 'agent:Three']);
    });

    // The reason grouping exists: LiveKit flushes an utterance in pieces, and
    // a bubble per piece splits sentences wherever the recogniser paused.
    it('joins consecutive pieces from one speaker into a single turn', () => {
      expect(
        shape(
          groupTranscriptTurns([
            entry('s1', 'A question', 'user'),
            entry('s2', 'Reply part one', 'agent'),
            entry('s3', 'reply part two', 'agent'),
          ]),
        ),
      ).toEqual(['user:A question', 'agent:Reply part one reply part two']);
    });

    it('joins any number of pieces, not just two', () => {
      expect(
        shape(
          groupTranscriptTurns([
            entry('s1', 'A', 'user'),
            entry('s2', 'B', 'user'),
            entry('s3', 'C', 'user'),
          ]),
        ),
      ).toEqual(['user:A B C']);
    });

    it('keeps the id of the first piece so a growing turn stays put', () => {
      const turns = groupTranscriptTurns([
        entry('s1', 'Starting', 'agent'),
        entry('s2', 'and continuing', 'agent'),
      ]);

      // React keys off this: change it mid-turn and the bubble is torn down
      // and rebuilt on every flush.
      expect(turns[0].id).toBe('s1');
    });

    it('takes its finality from the last piece', () => {
      const [turn] = groupTranscriptTurns([
        entry('s1', 'Done', 'agent', true),
        entry('s2', 'still going', 'agent', false),
      ]);

      expect(turn.isFinal).toBe(false);
    });

    it('keeps the first participant name it was given', () => {
      const [turn] = groupTranscriptTurns([
        entry('s1', 'Hello', 'agent', true, { participantName: 'Agent Seven' }),
        entry('s2', 'again', 'agent'),
      ]);

      expect(turn.participantName).toBe('Agent Seven');
    });

    it('picks up a participant name that only arrives later', () => {
      const [turn] = groupTranscriptTurns([
        entry('s1', 'Hello', 'agent'),
        entry('s2', 'again', 'agent', true, {
          participantName: 'Agent Seven',
        }),
      ]);

      expect(turn.participantName).toBe('Agent Seven');
    });

    it('does not leave a gap when a piece arrives empty', () => {
      const [turn] = groupTranscriptTurns([
        entry('s1', '', 'agent'),
        entry('s2', 'Hello', 'agent'),
      ]);

      expect(turn.text).toBe('Hello');
    });

    it('leaves the original entries untouched', () => {
      const first = entry('s1', 'One', 'agent');
      const second = entry('s2', 'Two', 'agent');

      groupTranscriptTurns([first, second]);

      expect(first.text).toBe('One');
      expect(second.text).toBe('Two');
    });
  });

  describe('control tooltips', () => {
    it('names the captions control in one word, like its neighbours', async () => {
      render(<VoiceChatModal {...defaultProps} />);

      // Radix opens on focus, which jsdom simulates reliably; hover does not.
      fireEvent.focus(screen.getByLabelText('Hide captions'));

      const tooltip = await screen.findByRole('tooltip');
      expect(tooltip).toHaveTextContent('Captions');
      // The state-carrying wording stays on the label, where it costs nothing.
      expect(tooltip).not.toHaveTextContent('Hide captions');
      expect(screen.getByLabelText('Hide captions')).toBeInTheDocument();
    });

    it('keeps the descriptive label when captions are off', () => {
      rememberCaptionsOff();
      render(<VoiceChatModal {...defaultProps} />);

      expect(screen.getByLabelText('Show captions')).toBeInTheDocument();
    });

    it('keeps the tooltip itself bounded and breakable', async () => {
      render(<VoiceChatModal {...defaultProps} />);

      fireEvent.focus(screen.getByLabelText('Hide captions'));

      // `ibl-tooltip-content` is the repo's shared treatment: max-w-xs plus
      // break-words. jsdom cannot measure the collision offsets, so the
      // assertion is that the row opts into the shared, capped treatment.
      await screen.findByRole('tooltip');
      const content = document.querySelector('[data-slot="tooltip-content"]');
      expect(content).toHaveClass('ibl-tooltip-content');
    });
  });

  describe('layout', () => {
    it('keeps the blob and all four controls with captions off', () => {
      rememberCaptionsOff();
      render(
        <VoiceChatModal
          {...defaultProps}
          transcript={[entry('s1', 'Hello', 'agent')]}
        />,
      );

      expect(screen.getByTestId('voice-blob')).toBeInTheDocument();
      expect(screen.getByLabelText('Mute microphone')).toBeInTheDocument();
      expect(screen.getByLabelText('Mute agent audio')).toBeInTheDocument();
      expect(screen.getByLabelText('Show captions')).toBeInTheDocument();
      expect(screen.getByLabelText('Close voice chat')).toBeInTheDocument();
      // The status line is shown to everyone now, not just announced.
      expect(screen.getByLabelText('Call status')).toBeVisible();
      // Nothing else competes with the orb.
      expect(screen.queryByRole('log')).toBeNull();
    });

    it('keeps the orb from being squeezed by the caption band', () => {
      rememberCaptionsOn();
      render(<VoiceChatModal {...defaultProps} />);

      // The band grows into the spare space, but never at the orb's expense:
      // the orb holds its size and the band scrolls instead.
      expect(screen.getByTestId('voice-blob')).toHaveClass('shrink-0');
      expect(screen.getByTestId('voice-transcript')).toHaveClass(
        'overflow-y-auto',
      );
      expect(screen.getByTestId('voice-transcript')).toHaveClass('flex-1');
    });
  });

  describe('reconnecting/error states', () => {
    it('does not show loading message for reconnecting state', () => {
      render(
        <VoiceChatModal {...defaultProps} connectionState="reconnecting" />,
      );

      expect(
        screen.queryByText('Requesting microphone access...'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText('Connecting to voice chat...'),
      ).not.toBeInTheDocument();
    });

    it('does not show loading message for error state', () => {
      render(<VoiceChatModal {...defaultProps} connectionState="error" />);

      expect(
        screen.queryByText('Requesting microphone access...'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText('Connecting to voice chat...'),
      ).not.toBeInTheDocument();
    });
  });
});
