import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VoiceChatModal } from '../voice-chat-modal';

describe('VoiceChatModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    toggleMute: vi.fn(),
    isMuted: false,
    connectionState: 'connected' as const,
    isSpeaking: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('accessibility', () => {
    it('renders dialog with accessible title and description', () => {
      render(<VoiceChatModal {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(screen.getByText('Voice Chat')).toBeInTheDocument();
      expect(screen.getByText('Real-time voice conversation with your mentor')).toBeInTheDocument();
    });
  });

  describe('loading states', () => {
    it('shows requesting microphone message', () => {
      render(<VoiceChatModal {...defaultProps} connectionState="requesting-permission" />);

      expect(screen.getByText('Requesting microphone access...')).toBeInTheDocument();
    });

    it('shows connecting message', () => {
      render(<VoiceChatModal {...defaultProps} connectionState="connecting" />);

      expect(screen.getByText('Connecting to voice chat...')).toBeInTheDocument();
    });

    it('disables mute button when requesting permission', () => {
      render(<VoiceChatModal {...defaultProps} connectionState="requesting-permission" />);

      expect(screen.getByLabelText('Mute microphone')).toBeDisabled();
    });

    it('disables mute button when connecting', () => {
      render(<VoiceChatModal {...defaultProps} connectionState="connecting" />);

      expect(screen.getByLabelText('Mute microphone')).toBeDisabled();
    });
  });

  describe('connected state', () => {
    it('renders without loading elements when connected', () => {
      render(<VoiceChatModal {...defaultProps} connectionState="connected" isMuted={false} />);

      expect(screen.queryByText('Requesting microphone access...')).not.toBeInTheDocument();
      expect(screen.queryByText('Connecting to voice chat...')).not.toBeInTheDocument();
    });

    it('enables mute button when connected', () => {
      render(<VoiceChatModal {...defaultProps} connectionState="connected" />);

      expect(screen.getByLabelText('Mute microphone')).toBeEnabled();
    });
  });

  describe('speaking state', () => {
    it('uses faster pulse animation when speaking', () => {
      render(
        <VoiceChatModal
          {...defaultProps}
          connectionState="connected"
          isMuted={false}
          isSpeaking={true}
        />,
      );

      // Speaking uses 1.5s pulse (faster than non-speaking 2s)
      const pulsingBg = document.querySelector('.bg-blue-100');
      expect(pulsingBg).toHaveStyle({ animation: 'randomPulse1 1.5s ease-in-out infinite' });
    });

    it('uses slower pulse animation when not speaking', () => {
      render(
        <VoiceChatModal
          {...defaultProps}
          connectionState="connected"
          isMuted={false}
          isSpeaking={false}
        />,
      );

      // Not speaking uses 2s pulse (slower)
      const pulsingBg = document.querySelector('.bg-blue-100');
      expect(pulsingBg).toHaveStyle({ animation: 'randomPulse1 2s ease-in-out infinite' });
    });
  });

  describe('muted state', () => {
    it('shows unmute label when muted', () => {
      render(<VoiceChatModal {...defaultProps} connectionState="connected" isMuted={true} />);

      expect(screen.getByLabelText('Unmute microphone')).toBeInTheDocument();
    });

    it('shows mute label when not muted', () => {
      render(<VoiceChatModal {...defaultProps} connectionState="connected" isMuted={false} />);

      expect(screen.getByLabelText('Mute microphone')).toBeInTheDocument();
    });

    it('renders muted connected state without errors', () => {
      render(<VoiceChatModal {...defaultProps} connectionState="connected" isMuted={true} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('disconnected state', () => {
    it('renders disconnected state without sound waves', () => {
      render(<VoiceChatModal {...defaultProps} connectionState="disconnected" />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('button interactions', () => {
    it('calls toggleMute when mute button is clicked', () => {
      render(<VoiceChatModal {...defaultProps} connectionState="connected" />);

      fireEvent.click(screen.getByLabelText('Mute microphone'));

      expect(defaultProps.toggleMute).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when close button is clicked', () => {
      render(<VoiceChatModal {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('Close voice chat'));

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('reconnecting/error states', () => {
    it('does not show loading message for reconnecting state', () => {
      render(<VoiceChatModal {...defaultProps} connectionState="reconnecting" />);

      expect(screen.queryByText('Requesting microphone access...')).not.toBeInTheDocument();
      expect(screen.queryByText('Connecting to voice chat...')).not.toBeInTheDocument();
    });

    it('does not show loading message for error state', () => {
      render(<VoiceChatModal {...defaultProps} connectionState="error" />);

      expect(screen.queryByText('Requesting microphone access...')).not.toBeInTheDocument();
      expect(screen.queryByText('Connecting to voice chat...')).not.toBeInTheDocument();
    });
  });
});
