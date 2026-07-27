import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  VoiceChatModal,
  readCaptionsPreference,
  writeCaptionsPreference,
  selectExchangeLines,
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

    it('hides the call status caption while connecting', () => {
      render(<VoiceChatModal {...defaultProps} connectionState="connecting" />);

      expect(screen.queryByLabelText('Call status')).toBeNull();
    });

    it('hides the call status caption while requesting permission', () => {
      render(
        <VoiceChatModal
          {...defaultProps}
          connectionState="requesting-permission"
        />,
      );

      expect(screen.queryByLabelText('Call status')).toBeNull();
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

  describe('blob animation', () => {
    const pulsingBg = () => document.querySelector('.bg-blue-100');
    const waveBars = () =>
      Array.from(document.querySelectorAll('.transform-gpu'));

    it('uses faster pulse animation when the user is speaking', () => {
      render(
        <VoiceChatModal
          {...defaultProps}
          connectionState="connected"
          isMicMuted={false}
          isSpeaking={true}
        />,
      );

      // Speaking uses 1.5s pulse (faster than non-speaking 2s)
      expect(pulsingBg()).toHaveStyle({
        animation: 'randomPulse1 1.5s ease-in-out infinite',
      });
    });

    it('uses slower pulse animation when not speaking', () => {
      render(
        <VoiceChatModal
          {...defaultProps}
          connectionState="connected"
          isMicMuted={false}
          isSpeaking={false}
        />,
      );

      // Not speaking uses 2s pulse (slower)
      expect(pulsingBg()).toHaveStyle({
        animation: 'randomPulse1 2s ease-in-out infinite',
      });
    });

    // Regression: the animation used to be gated on `!isMicMuted`, so muting
    // your own microphone froze the entire indicator and the call looked dead
    // even while the agent was talking.
    it('keeps the blob animating while the mic is muted', () => {
      render(
        <VoiceChatModal
          {...defaultProps}
          connectionState="connected"
          isMicMuted={true}
        />,
      );

      expect(pulsingBg()).toHaveStyle({
        animation: 'randomPulse1 2s ease-in-out infinite',
      });
      expect(document.querySelector('.from-blue-200')).toHaveStyle({
        animation: 'randomPulse2 2.5s ease-in-out infinite',
      });
    });

    it('keeps the particles animating while the mic is muted', () => {
      render(
        <VoiceChatModal
          {...defaultProps}
          connectionState="connected"
          isMicMuted={true}
        />,
      );

      const particles = document.querySelectorAll(
        'div[style*="particlePulse"]',
      );
      expect(particles).toHaveLength(10);
    });

    it('falls back to the idle pulse when not connected', () => {
      render(
        <VoiceChatModal {...defaultProps} connectionState="disconnected" />,
      );

      expect(pulsingBg()).toHaveStyle({
        animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      });
      expect(document.querySelector('.from-blue-200')).toHaveStyle({
        animation: 'none',
        opacity: '0.8',
      });
    });

    it('animates the sound wave bars when the user is speaking', () => {
      render(<VoiceChatModal {...defaultProps} isSpeaking={true} />);

      const bars = waveBars();
      expect(bars).toHaveLength(5);
      expect(bars[0]).toHaveStyle({ height: '30px', opacity: '1' });
      expect(bars[0]).toHaveStyle({
        animation: 'soundWave1 0.8s ease-in-out infinite',
      });
    });

    it('flattens and dims the sound wave bars when the mic is muted', () => {
      render(
        <VoiceChatModal
          {...defaultProps}
          isMicMuted={true}
          isSpeaking={true}
        />,
      );

      const bars = waveBars();
      expect(bars).toHaveLength(5);
      bars.forEach((bar) => {
        expect(bar).toHaveStyle({
          height: '12px',
          opacity: '0.35',
          animation: 'none',
        });
      });
    });

    it('keeps the bars idle-but-live when the mic is on and the user is silent', () => {
      render(<VoiceChatModal {...defaultProps} isSpeaking={false} />);

      const bars = waveBars();
      expect(bars[0]).toHaveStyle({ height: '30px', opacity: '0.7' });
      expect(bars[0]).toHaveStyle({
        animation: 'soundWave1 1.2s ease-in-out infinite',
      });
    });

    it('shows the mentor ring while the agent is speaking', () => {
      render(<VoiceChatModal {...defaultProps} isMentorSpeaking={true} />);

      const ring = screen.getByTestId('mentor-speaking-ring');
      expect(ring).toBeInTheDocument();
      expect(ring.querySelector('.border-blue-600')).toHaveStyle({
        animation: 'mentorRingPulse 1.4s ease-in-out infinite',
      });
      expect(ring.querySelector('.border-sky-400')).toHaveStyle({
        animation: 'mentorRingRipple 1.4s ease-out infinite',
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

    it('shows the mentor ring and the user waves at the same time', () => {
      render(
        <VoiceChatModal
          {...defaultProps}
          isSpeaking={true}
          isMentorSpeaking={true}
        />,
      );

      // The two parties are separate layers, never mutually exclusive.
      expect(screen.getByTestId('mentor-speaking-ring')).toBeInTheDocument();
      expect(waveBars()[0]).toHaveStyle({ opacity: '1' });
    });

    it('shows the mentor ring even while the user mic is muted', () => {
      render(
        <VoiceChatModal
          {...defaultProps}
          isMicMuted={true}
          isMentorSpeaking={true}
        />,
      );

      expect(screen.getByTestId('mentor-speaking-ring')).toBeInTheDocument();
    });

    it('dims the whole blob when agent audio is muted', () => {
      render(<VoiceChatModal {...defaultProps} isMentorAudioMuted={true} />);

      expect(screen.getByTestId('voice-blob')).toHaveStyle({
        opacity: '0.45',
        filter: 'saturate(0.35)',
      });
    });

    it('leaves the blob at full strength when agent audio is on', () => {
      render(<VoiceChatModal {...defaultProps} isMentorAudioMuted={false} />);

      expect(screen.getByTestId('voice-blob')).toHaveStyle({ opacity: '1' });
    });

    it('does not dim the blob when only the mic is muted', () => {
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

    // The orb is the only visible state indicator now, so the caption exists
    // for assistive tech only. Deleting it outright would have regressed the
    // accessibility complaint this redesign came from.
    it('is announced but never drawn', () => {
      render(<VoiceChatModal {...defaultProps} />);

      expect(caption()).toHaveClass('sr-only');
      expect(caption()).toBeInTheDocument();
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
    it('tints the mic button red when the mic is muted', () => {
      render(<VoiceChatModal {...defaultProps} isMicMuted={true} />);

      expect(screen.getByLabelText('Unmute microphone')).toHaveClass(
        'border-red-500',
      );
    });

    it('leaves the mic button blue when the mic is live', () => {
      render(<VoiceChatModal {...defaultProps} isMicMuted={false} />);

      expect(screen.getByLabelText('Mute microphone')).toHaveClass(
        'border-blue-500',
      );
    });

    it('tints the agent audio button red when agent audio is muted', () => {
      render(<VoiceChatModal {...defaultProps} isMentorAudioMuted={true} />);

      expect(screen.getByLabelText('Unmute agent audio')).toHaveClass(
        'border-red-500',
      );
    });

    it('leaves the agent audio button blue when agent audio is on', () => {
      render(<VoiceChatModal {...defaultProps} isMentorAudioMuted={false} />);

      expect(screen.getByLabelText('Mute agent audio')).toHaveClass(
        'border-blue-500',
      );
    });

    it('does not tint the mic button when only agent audio is muted', () => {
      render(<VoiceChatModal {...defaultProps} isMentorAudioMuted={true} />);

      expect(screen.getByLabelText('Mute microphone')).toHaveClass(
        'border-blue-500',
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

  describe('captions toggle', () => {
    const ccButton = () => screen.getByLabelText('Show captions');

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
        'Show captions',
        'Close voice chat',
      ]);
    });

    it('is styled as a peer of the other two circular controls', () => {
      render(<VoiceChatModal {...defaultProps} />);

      expect(ccButton()).toHaveClass('h-14', 'w-14', 'rounded-full');
      expect(screen.getByLabelText('Mute microphone')).toHaveClass(
        'h-14',
        'w-14',
        'rounded-full',
      );
    });

    it('starts off, so the default call shows no transcript at all', () => {
      render(
        <VoiceChatModal
          {...defaultProps}
          transcript={[entry('s1', 'Hello', 'agent')]}
        />,
      );

      expect(screen.queryByRole('log')).toBeNull();
      expect(screen.queryByTestId('voice-transcript')).toBeNull();
      expect(ccButton()).toHaveAttribute('aria-pressed', 'false');
    });

    it('reveals the band when switched on and hides it again when switched off', () => {
      render(
        <VoiceChatModal
          {...defaultProps}
          transcript={[entry('s1', 'Hello', 'agent')]}
        />,
      );

      fireEvent.click(ccButton());

      const toggledOn = screen.getByLabelText('Hide captions');
      expect(toggledOn).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('log')).toBeInTheDocument();

      fireEvent.click(toggledOn);

      expect(screen.queryByRole('log')).toBeNull();
      expect(ccButton()).toHaveAttribute('aria-pressed', 'false');
    });

    it('is disabled while connecting, like the other controls', () => {
      render(<VoiceChatModal {...defaultProps} connectionState="connecting" />);

      expect(ccButton()).toBeDisabled();
    });

    it('does not tint the captions control while connecting', () => {
      render(<VoiceChatModal {...defaultProps} connectionState="connecting" />);

      expect(ccButton()).toHaveClass('border-blue-500');
      expect(ccButton()).not.toHaveClass('bg-blue-50');
    });

    it('marks the control as active once captions are on', () => {
      render(<VoiceChatModal {...defaultProps} />);

      fireEvent.click(ccButton());

      expect(screen.getByLabelText('Hide captions')).toHaveClass('bg-blue-50');
    });
  });

  describe('captions preference persistence', () => {
    it('writes the choice to localStorage when turned on', () => {
      render(<VoiceChatModal {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('Show captions'));

      expect(window.localStorage.getItem(CAPTIONS_STORAGE_KEY)).toBe('true');
    });

    it('writes the choice to localStorage when turned back off', () => {
      rememberCaptionsOn();
      render(<VoiceChatModal {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('Hide captions'));

      expect(window.localStorage.getItem(CAPTIONS_STORAGE_KEY)).toBe('false');
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

    it('stays off when the stored value is anything other than "true"', () => {
      window.localStorage.setItem(CAPTIONS_STORAGE_KEY, 'false');

      render(<VoiceChatModal {...defaultProps} />);

      expect(screen.queryByRole('log')).toBeNull();
    });

    it('falls back to off when reading storage throws', () => {
      vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });

      render(<VoiceChatModal {...defaultProps} />);

      expect(screen.getByLabelText('Show captions')).toBeInTheDocument();
      expect(screen.queryByRole('log')).toBeNull();
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

      it('reports captions off instead of touching storage', () => {
        const getItem = vi.spyOn(window.localStorage, 'getItem');

        expect(withoutWindow(() => readCaptionsPreference())).toBe(false);
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

      fireEvent.click(screen.getByLabelText('Show captions'));

      // The preference is lost for next time, but this call still gets its
      // captions - a storage failure must never break the modal.
      expect(screen.getByRole('log')).toBeInTheDocument();
    });
  });

  describe('caption band', () => {
    const lines = () => screen.queryAllByTestId('voice-transcript-line');

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
      // Nothing scrolls any more, so there is no keyboard-reachable region.
      expect(region).not.toHaveAttribute('tabindex');
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

      expect(lines().map((l) => l.textContent)).toEqual([
        'AgentFirst',
        'YouSecond',
      ]);
    });

    it('shows only the exchange: the newest line and the reply it answers', () => {
      renderWithCaptions({
        transcript: [
          entry('s1', 'One', 'agent'),
          entry('s2', 'Two', 'user'),
          entry('s3', 'Three', 'agent'),
          entry('s4', 'Four', 'user'),
          entry('s5', 'Five', 'agent'),
        ],
      });

      // The full history is a post-call artefact; the band is a teleprompter.
      expect(lines().map((l) => l.textContent)).toEqual([
        'YouFour',
        'AgentFive',
      ]);
    });

    it('keeps the answered turn on screen when the same speaker talks twice', () => {
      renderWithCaptions({
        transcript: [
          entry('s1', 'A question', 'user'),
          entry('s2', 'First half of the reply', 'agent'),
          entry('s3', 'Second half of the reply', 'agent'),
        ],
      });

      // `slice(-2)` would have shown two agent lines and dropped the question.
      expect(lines().map((l) => l.textContent)).toEqual([
        'YouA question',
        'AgentSecond half of the reply',
      ]);
    });

    it('puts the newest line at the bottom of the two', () => {
      renderWithCaptions({
        transcript: [
          entry('s1', 'One', 'agent'),
          entry('s2', 'Two', 'user'),
          entry('s3', 'Three', 'agent'),
          entry('s4', 'Four', 'user'),
        ],
      });

      const rendered = lines();
      expect(rendered).toHaveLength(2);
      expect(rendered[1]).toHaveAttribute('data-newest', 'true');
      expect(rendered[0]).toHaveAttribute('data-newest', 'false');
    });

    it('shows a single line when only one speaker has spoken', () => {
      renderWithCaptions({
        transcript: [entry('s1', 'One', 'agent'), entry('s2', 'Two', 'agent')],
      });

      const rendered = lines();
      expect(rendered).toHaveLength(1);
      expect(rendered[0]).toHaveAttribute('data-newest', 'true');
    });

    it('is a fixed-height window that never scrolls', () => {
      renderWithCaptions({
        transcript: [
          entry('s1', 'One', 'agent'),
          entry('s2', 'Two', 'user'),
          entry('s3', 'Three', 'agent'),
        ],
      });

      const band = screen.getByTestId('voice-transcript');
      // Two clamped `text-xs` rows for the answered turn plus three `text-sm`
      // rows of live text. Sized to the content, not guessed.
      expect(band).toHaveClass('h-[6rem]');
      expect(band).toHaveClass('overflow-hidden');
      expect(band).toHaveClass('shrink-0');
      expect(band.className).not.toContain('overflow-y-auto');
    });

    it('gives the live line its own bottom-anchored viewport', () => {
      renderWithCaptions({
        transcript: [
          entry('s1', 'A question', 'user'),
          entry('s2', REAL_AGENT_TURN, 'agent', false),
        ],
      });

      // Without this, a paragraph-long agent turn grows until it shoves the
      // answered turn off the top of the band and the "exchange" is gone.
      const liveWindow = screen.getByTestId('voice-transcript-live-window');
      expect(liveWindow).toHaveClass('overflow-hidden');
      expect(liveWindow).toHaveClass('justify-end');
      expect(liveWindow).toHaveClass('min-h-0');
      expect(liveWindow).toContainElement(lines()[1]);
      // The answered turn sits outside it and is pinned by `shrink-0`.
      expect(lines()[0]).toHaveClass('shrink-0');
    });

    it('labels the user with "You" in blue', () => {
      renderWithCaptions({ transcript: [entry('s1', 'My words', 'user')] });

      const label = lines()[0].querySelector('span');
      expect(label).toHaveTextContent('You');
      // Lighter than the agent's blue-700, so the two speakers stay
      // distinguishable within a single blue family.
      expect(label).toHaveClass('text-blue-500');
    });

    it('labels the agent with the mentor name in the ring blue', () => {
      renderWithCaptions({
        mentorName: 'Ada',
        transcript: [entry('s1', 'Their words', 'agent')],
      });

      const label = lines()[0].querySelector('span');
      expect(label).toHaveTextContent('Ada');
      // Same family as the mentor-speaking ring, on purpose.
      expect(label).toHaveClass('text-blue-700');
    });

    it('falls back to the LiveKit participant name when no mentor name is given', () => {
      renderWithCaptions({
        transcript: [
          entry('s1', 'Their words', 'agent', true, {
            participantName: 'Agent Seven',
          }),
        ],
      });

      expect(lines()[0].querySelector('span')).toHaveTextContent('Agent Seven');
    });

    it('falls back to a generic agent label as a last resort', () => {
      renderWithCaptions({ transcript: [entry('s1', 'Their words', 'agent')] });

      expect(lines()[0].querySelector('span')).toHaveTextContent('Agent');
    });

    it('never labels a user line with the mentor name', () => {
      renderWithCaptions({
        mentorName: 'Ada',
        transcript: [
          entry('s1', 'My words', 'user', true, { participantName: 'Ada' }),
        ],
      });

      expect(lines()[0].querySelector('span')).toHaveTextContent('You');
    });

    it('gives the newest line full weight and dims the answered turn', () => {
      renderWithCaptions({
        transcript: [
          entry('s1', 'Older', 'user'),
          entry('s2', 'Newest', 'agent'),
        ],
      });

      const [older, newest] = lines();
      expect(older).toHaveAttribute('data-age', '1');
      expect(older).toHaveClass('opacity-60');
      expect(older).toHaveClass('text-xs');
      expect(newest).toHaveAttribute('data-age', '0');
      expect(newest).toHaveAttribute('data-newest', 'true');
      expect(newest).toHaveClass('opacity-100');
      expect(newest).toHaveClass('text-sm');
      // A single dim level now that there is only one older line - the old
      // third tier at opacity-30 was the one that read as broken.
      expect(older).not.toHaveClass('opacity-30');
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
      // The answered turn is bounded by line count instead, which wraps
      // normally and so has a wrappable intrinsic width.
      expect(lines()[0]).toHaveClass('line-clamp-2');
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
      // `DialogContent` is `max-w-lg` (32rem). The band used to declare
      // `max-w-xl` (36rem), a cap wider than its own container could ever
      // grant - dead at best, misleading at worst.
      expect(band).toHaveClass('max-w-md');
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

  describe('selectExchangeLines', () => {
    const speakers = (entries: TranscriptEntry[]) =>
      entries.map((e) => `${e.speaker}:${e.text}`);

    it('returns nothing for an empty transcript', () => {
      expect(selectExchangeLines([])).toEqual([]);
    });

    it('returns the only entry when one thing has been said', () => {
      const only = entry('s1', 'Hello', 'user');

      expect(selectExchangeLines([only])).toEqual([only]);
    });

    it('pairs the newest line with the previous line when speakers alternate', () => {
      expect(
        speakers(
          selectExchangeLines([
            entry('s1', 'One', 'agent'),
            entry('s2', 'Two', 'user'),
            entry('s3', 'Three', 'agent'),
          ]),
        ),
      ).toEqual(['user:Two', 'agent:Three']);
    });

    // The reason this is not `slice(-2)`.
    it('skips past a repeated speaker to reach the other voice', () => {
      expect(
        speakers(
          selectExchangeLines([
            entry('s1', 'Question', 'user'),
            entry('s2', 'Reply part one', 'agent'),
            entry('s3', 'Reply part two', 'agent'),
          ]),
        ),
      ).toEqual(['user:Question', 'agent:Reply part two']);
    });

    it('skips past several repeats, not just one', () => {
      expect(
        speakers(
          selectExchangeLines([
            entry('s1', 'Question', 'agent'),
            entry('s2', 'A', 'user'),
            entry('s3', 'B', 'user'),
            entry('s4', 'C', 'user'),
          ]),
        ),
      ).toEqual(['agent:Question', 'user:C']);
    });

    it('returns only the newest line when nobody else has spoken', () => {
      expect(
        speakers(
          selectExchangeLines([
            entry('s1', 'One', 'agent'),
            entry('s2', 'Two', 'agent'),
            entry('s3', 'Three', 'agent'),
          ]),
        ),
      ).toEqual(['agent:Three']);
    });

    it('puts the newest line last so callers can render top-to-bottom', () => {
      const newest = entry('s2', 'Newest', 'agent');

      const selected = selectExchangeLines([
        entry('s1', 'Older', 'user'),
        newest,
      ]);

      expect(selected[selected.length - 1]).toBe(newest);
    });
  });

  describe('control tooltips', () => {
    it('names the captions control in one word, like its neighbours', async () => {
      render(<VoiceChatModal {...defaultProps} />);

      // Radix opens on focus, which jsdom simulates reliably; hover does not.
      fireEvent.focus(screen.getByLabelText('Show captions'));

      const tooltip = await screen.findByRole('tooltip');
      expect(tooltip).toHaveTextContent('Captions');
      // The state-carrying wording stays on the label, where it costs nothing.
      expect(tooltip).not.toHaveTextContent('Show captions');
      expect(screen.getByLabelText('Show captions')).toBeInTheDocument();
    });

    it('keeps the descriptive label when captions are on', () => {
      rememberCaptionsOn();
      render(<VoiceChatModal {...defaultProps} />);

      expect(screen.getByLabelText('Hide captions')).toBeInTheDocument();
    });

    it('keeps the tooltip itself bounded and breakable', async () => {
      render(<VoiceChatModal {...defaultProps} />);

      fireEvent.focus(screen.getByLabelText('Show captions'));

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
      // The status text is present for assistive tech but never drawn.
      expect(screen.getByLabelText('Call status')).toHaveClass('sr-only');
      // Nothing else competes with the orb.
      expect(screen.queryByRole('log')).toBeNull();
    });

    it('keeps the orb from being squeezed by the caption band', () => {
      rememberCaptionsOn();
      render(<VoiceChatModal {...defaultProps} />);

      expect(screen.getByTestId('voice-blob')).toHaveClass('shrink-0');
      expect(screen.getByTestId('voice-transcript')).toHaveClass('shrink-0');
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
