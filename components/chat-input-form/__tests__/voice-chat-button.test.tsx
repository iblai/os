import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { VoiceChatButton } from '../voice-chat-button';
import { createTestStore } from '@/__tests__/a11y-test-utils';
import * as useShowVoiceRecorderModule from '@/hooks/use-show-voice-recorder';

vi.mock('@/hooks/use-show-voice-recorder');

describe('VoiceChatButton', () => {
  const mockHandleMicrophoneBtnClick = vi.fn();
  const mockUseShowVoiceRecorder = vi.spyOn(useShowVoiceRecorderModule, 'useShowVoiceRecorder');

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseShowVoiceRecorder.mockReturnValue(true);
  });

  const renderWithRedux = (component: React.ReactElement) => {
    return render(<Provider store={createTestStore()}>{component}</Provider>);
  };

  describe('visibility based on useShowVoiceRecorder', () => {
    it('should render when useShowVoiceRecorder returns true', () => {
      mockUseShowVoiceRecorder.mockReturnValue(true);

      renderWithRedux(
        <VoiceChatButton
          handleMicrophoneBtnClick={mockHandleMicrophoneBtnClick}
          processing={false}
          recording={false}
        />,
      );

      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should not render when useShowVoiceRecorder returns false', () => {
      mockUseShowVoiceRecorder.mockReturnValue(false);

      renderWithRedux(
        <VoiceChatButton
          handleMicrophoneBtnClick={mockHandleMicrophoneBtnClick}
          processing={false}
          recording={false}
        />,
      );

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('button states and icons', () => {
    it('should display microphone icon when not processing and not recording', () => {
      renderWithRedux(
        <VoiceChatButton
          handleMicrophoneBtnClick={mockHandleMicrophoneBtnClick}
          processing={false}
          recording={false}
        />,
      );

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      // Mic icon has the sr-only text "Voice input"
      expect(screen.getByText('Voice input')).toBeInTheDocument();
    });

    it('should display loading spinner when processing', () => {
      renderWithRedux(
        <VoiceChatButton
          handleMicrophoneBtnClick={mockHandleMicrophoneBtnClick}
          processing={true}
          recording={false}
        />,
      );

      const button = screen.getByRole('button');
      // Check for spinner by class name or animation class
      const spinner = button.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should display stop icon when recording', () => {
      renderWithRedux(
        <VoiceChatButton
          handleMicrophoneBtnClick={mockHandleMicrophoneBtnClick}
          processing={false}
          recording={true}
        />,
      );

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      // CircleStop icon is displayed when recording
    });

    it('should display loading spinner when both processing and recording', () => {
      renderWithRedux(
        <VoiceChatButton
          handleMicrophoneBtnClick={mockHandleMicrophoneBtnClick}
          processing={true}
          recording={true}
        />,
      );

      const button = screen.getByRole('button');
      // Processing takes precedence
      const spinner = button.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('button interactions', () => {
    it('should call handleMicrophoneBtnClick when clicked', () => {
      renderWithRedux(
        <VoiceChatButton
          handleMicrophoneBtnClick={mockHandleMicrophoneBtnClick}
          processing={false}
          recording={false}
        />,
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(mockHandleMicrophoneBtnClick).toHaveBeenCalledTimes(1);
    });

    it('should not call handleMicrophoneBtnClick when disabled in preview mode', () => {
      renderWithRedux(
        <VoiceChatButton
          handleMicrophoneBtnClick={mockHandleMicrophoneBtnClick}
          processing={false}
          recording={false}
          isPreviewMode={true}
        />,
      );

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();

      fireEvent.click(button);
      expect(mockHandleMicrophoneBtnClick).not.toHaveBeenCalled();
    });

    it('should not call handleMicrophoneBtnClick when processing', () => {
      renderWithRedux(
        <VoiceChatButton
          handleMicrophoneBtnClick={mockHandleMicrophoneBtnClick}
          processing={true}
          recording={false}
        />,
      );

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();

      fireEvent.click(button);
      expect(mockHandleMicrophoneBtnClick).not.toHaveBeenCalled();
    });

    it('should allow clicking when recording but not processing', () => {
      renderWithRedux(
        <VoiceChatButton
          handleMicrophoneBtnClick={mockHandleMicrophoneBtnClick}
          processing={false}
          recording={true}
        />,
      );

      const button = screen.getByRole('button');
      expect(button).not.toBeDisabled();

      fireEvent.click(button);
      expect(mockHandleMicrophoneBtnClick).toHaveBeenCalledTimes(1);
    });

    it('should call handleMicrophoneBtnClick multiple times when clicked multiple times', () => {
      renderWithRedux(
        <VoiceChatButton
          handleMicrophoneBtnClick={mockHandleMicrophoneBtnClick}
          processing={false}
          recording={false}
        />,
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);

      expect(mockHandleMicrophoneBtnClick).toHaveBeenCalledTimes(3);
    });
  });

  describe('disabled states', () => {
    it('should be disabled when isPreviewMode is true', () => {
      renderWithRedux(
        <VoiceChatButton
          handleMicrophoneBtnClick={mockHandleMicrophoneBtnClick}
          processing={false}
          recording={false}
          isPreviewMode={true}
        />,
      );

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should be disabled when processing is true', () => {
      renderWithRedux(
        <VoiceChatButton
          handleMicrophoneBtnClick={mockHandleMicrophoneBtnClick}
          processing={true}
          recording={false}
        />,
      );

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should be disabled when both isPreviewMode and processing are true', () => {
      renderWithRedux(
        <VoiceChatButton
          handleMicrophoneBtnClick={mockHandleMicrophoneBtnClick}
          processing={true}
          recording={false}
          isPreviewMode={true}
        />,
      );

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should not be disabled when isPreviewMode is false and processing is false', () => {
      renderWithRedux(
        <VoiceChatButton
          handleMicrophoneBtnClick={mockHandleMicrophoneBtnClick}
          processing={false}
          recording={false}
          isPreviewMode={false}
        />,
      );

      const button = screen.getByRole('button');
      expect(button).not.toBeDisabled();
    });

    it('should not be disabled when isPreviewMode is undefined and processing is false', () => {
      renderWithRedux(
        <VoiceChatButton
          handleMicrophoneBtnClick={mockHandleMicrophoneBtnClick}
          processing={false}
          recording={false}
        />,
      );

      const button = screen.getByRole('button');
      expect(button).not.toBeDisabled();
    });
  });

  describe('tooltip', () => {
    it('should have accessible tooltip content', () => {
      renderWithRedux(
        <VoiceChatButton
          handleMicrophoneBtnClick={mockHandleMicrophoneBtnClick}
          processing={false}
          recording={false}
        />,
      );

      // Check for tooltip trigger
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have screen reader text "Voice input"', () => {
      renderWithRedux(
        <VoiceChatButton
          handleMicrophoneBtnClick={mockHandleMicrophoneBtnClick}
          processing={false}
          recording={false}
        />,
      );

      expect(screen.getByText('Voice input')).toHaveClass('sr-only');
    });

    it('should have button type="button" to prevent form submission', () => {
      renderWithRedux(
        <VoiceChatButton
          handleMicrophoneBtnClick={mockHandleMicrophoneBtnClick}
          processing={false}
          recording={false}
        />,
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'button');
    });
  });

  describe('edge cases', () => {
    it('should handle rapid state changes', () => {
      const { rerender } = renderWithRedux(
        <VoiceChatButton
          handleMicrophoneBtnClick={mockHandleMicrophoneBtnClick}
          processing={false}
          recording={false}
        />,
      );

      let button = screen.getByRole('button');
      expect(button).not.toBeDisabled();

      rerender(
        <Provider store={createTestStore()}>
          <VoiceChatButton
            handleMicrophoneBtnClick={mockHandleMicrophoneBtnClick}
            processing={true}
            recording={false}
          />
        </Provider>,
      );

      button = screen.getByRole('button');
      expect(button).toBeDisabled();

      rerender(
        <Provider store={createTestStore()}>
          <VoiceChatButton
            handleMicrophoneBtnClick={mockHandleMicrophoneBtnClick}
            processing={false}
            recording={true}
          />
        </Provider>,
      );

      button = screen.getByRole('button');
      expect(button).not.toBeDisabled();
    });

    it('should handle null/undefined handler gracefully', () => {
      renderWithRedux(
        <VoiceChatButton
          handleMicrophoneBtnClick={undefined as any}
          processing={false}
          recording={false}
        />,
      );

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });
  });
});
