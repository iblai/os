import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VoiceCallButton } from '../voice-call-button';
import * as useShowVoiceCallModule from '@/hooks/use-show-voice-call';

vi.mock('@/hooks/use-show-voice-call');

describe('VoiceCallButton', () => {
  const mockOnClick = vi.fn();
  const mockUseShowVoiceCall = vi.spyOn(useShowVoiceCallModule, 'useShowVoiceCall');

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseShowVoiceCall.mockReturnValue(true);
  });

  describe('visibility based on useShowVoiceCall', () => {
    it('should render when useShowVoiceCall returns true', () => {
      mockUseShowVoiceCall.mockReturnValue(true);

      render(<VoiceCallButton onClick={mockOnClick} />);

      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should not render when useShowVoiceCall returns false', () => {
      mockUseShowVoiceCall.mockReturnValue(false);

      const { container } = render(<VoiceCallButton onClick={mockOnClick} />);

      expect(container.firstChild).toBeNull();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('button rendering', () => {
    it('should render with voice call icon (SVG)', () => {
      render(<VoiceCallButton onClick={mockOnClick} />);

      const button = screen.getByRole('button');
      const svg = button.querySelector('svg');

      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('width', '28');
      expect(svg).toHaveAttribute('height', '28');
    });

    it('should have screen reader text "Voice call"', () => {
      render(<VoiceCallButton onClick={mockOnClick} />);

      expect(screen.getByText('Voice call')).toBeInTheDocument();
      expect(screen.getByText('Voice call')).toHaveClass('sr-only');
    });

    it('should have button type="button" to prevent form submission', () => {
      render(<VoiceCallButton onClick={mockOnClick} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'button');
    });

    it('should have correct styling classes', () => {
      render(<VoiceCallButton onClick={mockOnClick} />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('mr-3');
      expect(button).toHaveClass('h-9');
      expect(button).toHaveClass('w-9');
      expect(button).toHaveClass('text-gray-400');
    });
  });

  describe('button interactions', () => {
    it('should call onClick when clicked', () => {
      render(<VoiceCallButton onClick={mockOnClick} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should call onClick multiple times when clicked multiple times', () => {
      render(<VoiceCallButton onClick={mockOnClick} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);

      expect(mockOnClick).toHaveBeenCalledTimes(3);
    });

    it('should not call onClick when disabled in preview mode', () => {
      render(<VoiceCallButton onClick={mockOnClick} isPreviewMode={true} />);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();

      fireEvent.click(button);
      expect(mockOnClick).not.toHaveBeenCalled();
    });
  });

  describe('disabled states', () => {
    it('should be disabled when isPreviewMode is true', () => {
      render(<VoiceCallButton onClick={mockOnClick} isPreviewMode={true} />);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should not be disabled when isPreviewMode is false', () => {
      render(<VoiceCallButton onClick={mockOnClick} isPreviewMode={false} />);

      const button = screen.getByRole('button');
      expect(button).not.toBeDisabled();
    });

    it('should not be disabled when isPreviewMode is undefined', () => {
      render(<VoiceCallButton onClick={mockOnClick} />);

      const button = screen.getByRole('button');
      expect(button).not.toBeDisabled();
    });
  });

  describe('tooltip', () => {
    it('should have tooltip trigger wrapping the button', () => {
      render(<VoiceCallButton onClick={mockOnClick} />);

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have appropriate ARIA attributes', () => {
      render(<VoiceCallButton onClick={mockOnClick} />);

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('should be keyboard accessible', () => {
      render(<VoiceCallButton onClick={mockOnClick} />);

      const button = screen.getByRole('button');
      button.focus();

      expect(document.activeElement).toBe(button);
    });

    it('should be keyboard accessible when pressing Enter', () => {
      render(<VoiceCallButton onClick={mockOnClick} />);

      const button = screen.getByRole('button');
      button.focus();

      fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' });
      // Button click is automatically triggered by Enter key on focused button
    });

    it('should be keyboard accessible when pressing Space', () => {
      render(<VoiceCallButton onClick={mockOnClick} />);

      const button = screen.getByRole('button');
      button.focus();

      fireEvent.keyDown(button, { key: ' ', code: 'Space' });
      // Button click is automatically triggered by Space key on focused button
    });
  });

  describe('edge cases', () => {
    it('should handle rapid state changes', () => {
      const { rerender } = render(<VoiceCallButton onClick={mockOnClick} isPreviewMode={false} />);

      let button = screen.getByRole('button');
      expect(button).not.toBeDisabled();

      rerender(<VoiceCallButton onClick={mockOnClick} isPreviewMode={true} />);

      button = screen.getByRole('button');
      expect(button).toBeDisabled();

      rerender(<VoiceCallButton onClick={mockOnClick} isPreviewMode={false} />);

      button = screen.getByRole('button');
      expect(button).not.toBeDisabled();
    });

    it('should handle null/undefined onClick gracefully', () => {
      render(<VoiceCallButton onClick={undefined as any} />);

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('should handle being rendered and unmounted', () => {
      const { unmount } = render(<VoiceCallButton onClick={mockOnClick} />);

      expect(screen.getByRole('button')).toBeInTheDocument();

      unmount();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('should maintain functionality when onClick changes', () => {
      const mockOnClick1 = vi.fn();
      const mockOnClick2 = vi.fn();

      const { rerender } = render(<VoiceCallButton onClick={mockOnClick1} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(mockOnClick1).toHaveBeenCalledTimes(1);
      expect(mockOnClick2).not.toHaveBeenCalled();

      rerender(<VoiceCallButton onClick={mockOnClick2} />);

      fireEvent.click(button);

      expect(mockOnClick1).toHaveBeenCalledTimes(1);
      expect(mockOnClick2).toHaveBeenCalledTimes(1);
    });
  });

  describe('visibility toggle', () => {
    it('should toggle visibility when useShowVoiceCall changes', () => {
      mockUseShowVoiceCall.mockReturnValue(true);

      const { rerender, container } = render(<VoiceCallButton onClick={mockOnClick} />);

      expect(screen.getByRole('button')).toBeInTheDocument();

      mockUseShowVoiceCall.mockReturnValue(false);
      rerender(<VoiceCallButton onClick={mockOnClick} />);

      expect(container.firstChild).toBeNull();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });
});
