import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

import { ChatActionBlockingOverlay } from '../chat-action-blocking-overlay';

describe('ChatActionBlockingOverlay', () => {
  describe('when isOpen is false', () => {
    it('should not render anything', () => {
      const { container } = render(
        <ChatActionBlockingOverlay isOpen={false} actionType="voice-call" />,
      );

      expect(container.firstChild).toBeNull();
    });

    it('should not render for screen-share action type', () => {
      const { container } = render(
        <ChatActionBlockingOverlay isOpen={false} actionType="screen-share" />,
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('when isOpen is true', () => {
    describe('voice-call action type', () => {
      it('should render voice call overlay', () => {
        render(<ChatActionBlockingOverlay isOpen={true} actionType="voice-call" />);

        expect(screen.getByText('Voice Call Active')).toBeInTheDocument();
      });

      it('should display voice call description', () => {
        render(<ChatActionBlockingOverlay isOpen={true} actionType="voice-call" />);

        expect(screen.getByText(/Your voice call session is now active/i)).toBeInTheDocument();
      });

      it('should display voice call help text', () => {
        render(<ChatActionBlockingOverlay isOpen={true} actionType="voice-call" />);

        expect(
          screen.getByText(/This window will handle your voice call in the background/i),
        ).toBeInTheDocument();
      });

      it('should not render stop button for voice call', () => {
        render(<ChatActionBlockingOverlay isOpen={true} actionType="voice-call" />);

        expect(screen.queryByText('Stop Screen Sharing')).not.toBeInTheDocument();
      });

      it('should not render stop button even with onStopScreenShare prop', () => {
        const onStopScreenShare = vi.fn();
        render(
          <ChatActionBlockingOverlay
            isOpen={true}
            actionType="voice-call"
            onStopScreenShare={onStopScreenShare}
          />,
        );

        expect(screen.queryByText('Stop Screen Sharing')).not.toBeInTheDocument();
      });
    });

    describe('screen-share action type', () => {
      it('should render screen sharing overlay', () => {
        render(<ChatActionBlockingOverlay isOpen={true} actionType="screen-share" />);

        expect(screen.getByText('Screen Sharing Active')).toBeInTheDocument();
      });

      it('should display screen sharing description', () => {
        render(<ChatActionBlockingOverlay isOpen={true} actionType="screen-share" />);

        expect(screen.getByText(/Your screen sharing session is now active/i)).toBeInTheDocument();
      });

      it('should display screen sharing help text', () => {
        render(<ChatActionBlockingOverlay isOpen={true} actionType="screen-share" />);

        expect(
          screen.getByText(/This window will handle your screen sharing in the background/i),
        ).toBeInTheDocument();
      });

      it('should not render stop button without onStopScreenShare prop', () => {
        render(<ChatActionBlockingOverlay isOpen={true} actionType="screen-share" />);

        expect(screen.queryByText('Stop Screen Sharing')).not.toBeInTheDocument();
      });

      it('should render stop button with onStopScreenShare prop', () => {
        const onStopScreenShare = vi.fn();
        render(
          <ChatActionBlockingOverlay
            isOpen={true}
            actionType="screen-share"
            onStopScreenShare={onStopScreenShare}
          />,
        );

        expect(screen.getByText('Stop Screen Sharing')).toBeInTheDocument();
      });

      it('should call onStopScreenShare when stop button is clicked', () => {
        const onStopScreenShare = vi.fn();
        render(
          <ChatActionBlockingOverlay
            isOpen={true}
            actionType="screen-share"
            onStopScreenShare={onStopScreenShare}
          />,
        );

        fireEvent.click(screen.getByText('Stop Screen Sharing'));

        expect(onStopScreenShare).toHaveBeenCalledTimes(1);
      });
    });

    describe('accessibility', () => {
      it('should have dialog role', () => {
        render(<ChatActionBlockingOverlay isOpen={true} actionType="voice-call" />);

        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      it('should have aria-modal attribute', () => {
        render(<ChatActionBlockingOverlay isOpen={true} actionType="voice-call" />);

        expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
      });

      it('should have aria-labelledby pointing to title', () => {
        render(<ChatActionBlockingOverlay isOpen={true} actionType="voice-call" />);

        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('aria-labelledby', 'blocking-overlay-title');

        const title = screen.getByText('Voice Call Active');
        expect(title).toHaveAttribute('id', 'blocking-overlay-title');
      });

      it('should have aria-describedby pointing to description', () => {
        render(<ChatActionBlockingOverlay isOpen={true} actionType="voice-call" />);

        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('aria-describedby', 'blocking-overlay-description');

        const description = screen.getByText(/Your voice call session is now active/i);
        expect(description).toHaveAttribute('id', 'blocking-overlay-description');
      });

      it('should have proper aria attributes for screen share', () => {
        render(<ChatActionBlockingOverlay isOpen={true} actionType="screen-share" />);

        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('aria-labelledby', 'blocking-overlay-title');
        expect(dialog).toHaveAttribute('aria-describedby', 'blocking-overlay-description');
      });
    });

    describe('styling', () => {
      it('should have high z-index for overlay', () => {
        render(<ChatActionBlockingOverlay isOpen={true} actionType="voice-call" />);

        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveStyle({ zIndex: 9999 });
      });

      it('should have fixed positioning', () => {
        render(<ChatActionBlockingOverlay isOpen={true} actionType="voice-call" />);

        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveClass('fixed', 'inset-0');
      });

      it('should have backdrop blur', () => {
        render(<ChatActionBlockingOverlay isOpen={true} actionType="voice-call" />);

        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveClass('backdrop-blur-sm');
      });
    });

    describe('icon rendering', () => {
      it('should render Phone icon for voice call', () => {
        const { container } = render(
          <ChatActionBlockingOverlay isOpen={true} actionType="voice-call" />,
        );

        // Lucide icons render as SVG elements
        const iconContainer = container.querySelector('.bg-blue-100');
        expect(iconContainer).toBeInTheDocument();
        expect(iconContainer?.querySelector('svg')).toBeInTheDocument();
      });

      it('should render Monitor icon for screen share', () => {
        const { container } = render(
          <ChatActionBlockingOverlay isOpen={true} actionType="screen-share" />,
        );

        const iconContainer = container.querySelector('.bg-blue-100');
        expect(iconContainer).toBeInTheDocument();
        expect(iconContainer?.querySelector('svg')).toBeInTheDocument();
      });
    });
  });

  describe('stop button styling', () => {
    it('should have red background color', () => {
      const onStopScreenShare = vi.fn();
      render(
        <ChatActionBlockingOverlay
          isOpen={true}
          actionType="screen-share"
          onStopScreenShare={onStopScreenShare}
        />,
      );

      const button = screen.getByRole('button', { name: /Stop Screen Sharing/i });
      expect(button).toHaveClass('bg-red-600');
    });

    it('should have hover state styling', () => {
      const onStopScreenShare = vi.fn();
      render(
        <ChatActionBlockingOverlay
          isOpen={true}
          actionType="screen-share"
          onStopScreenShare={onStopScreenShare}
        />,
      );

      const button = screen.getByRole('button', { name: /Stop Screen Sharing/i });
      expect(button).toHaveClass('hover:bg-red-700');
    });

    it('should have full width', () => {
      const onStopScreenShare = vi.fn();
      render(
        <ChatActionBlockingOverlay
          isOpen={true}
          actionType="screen-share"
          onStopScreenShare={onStopScreenShare}
        />,
      );

      const button = screen.getByRole('button', { name: /Stop Screen Sharing/i });
      expect(button).toHaveClass('w-full');
    });
  });
});
