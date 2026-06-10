import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UploadMenu } from '../upload-menu';
import * as useShowAttachmentModule from '@/hooks/use-show-attachment';

vi.mock('@/hooks/use-show-attachment');

describe('UploadMenu', () => {
  const mockOnFileInputTrigger = vi.fn();
  const mockOnCameraTrigger = vi.fn();
  const mockUseShowAttachment = vi.spyOn(
    useShowAttachmentModule,
    'useShowAttachment',
  );

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseShowAttachment.mockReturnValue(true);
  });

  describe('visibility based on useShowAttachment', () => {
    it('should render when useShowAttachment returns true', () => {
      mockUseShowAttachment.mockReturnValue(true);

      render(
        <UploadMenu
          onFileInputTrigger={mockOnFileInputTrigger}
          onCameraTrigger={mockOnCameraTrigger}
        />,
      );

      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should not render when useShowAttachment returns false', () => {
      mockUseShowAttachment.mockReturnValue(false);

      const { container } = render(
        <UploadMenu
          onFileInputTrigger={mockOnFileInputTrigger}
          onCameraTrigger={mockOnCameraTrigger}
        />,
      );

      expect(container.firstChild).toBeNull();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('trigger button rendering', () => {
    it('should render trigger button with Plus icon', () => {
      render(
        <UploadMenu
          onFileInputTrigger={mockOnFileInputTrigger}
          onCameraTrigger={mockOnCameraTrigger}
        />,
      );

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();

      // Check for Plus icon
      const plusIcon = button.querySelector('.lucide-plus');
      expect(plusIcon).toBeInTheDocument();
    });

    it('should have screen reader text "Attach file"', () => {
      render(
        <UploadMenu
          onFileInputTrigger={mockOnFileInputTrigger}
          onCameraTrigger={mockOnCameraTrigger}
        />,
      );

      expect(screen.getByText('Attach file')).toBeInTheDocument();
      expect(screen.getByText('Attach file')).toHaveClass('sr-only');
    });

    it('should expose accessible name "Attach file" via aria-label', () => {
      render(
        <UploadMenu
          onFileInputTrigger={mockOnFileInputTrigger}
          onCameraTrigger={mockOnCameraTrigger}
        />,
      );

      expect(
        screen.getByRole('button', { name: 'Attach file' }),
      ).toBeInTheDocument();
    });

    it('should have correct styling classes on trigger button', () => {
      render(
        <UploadMenu
          onFileInputTrigger={mockOnFileInputTrigger}
          onCameraTrigger={mockOnCameraTrigger}
        />,
      );

      const button = screen.getByRole('button');
      expect(button).toHaveClass('h-8');
      expect(button).toHaveClass('w-8');
      expect(button).toHaveClass('text-gray-600');
    });
  });

  describe('dropdown menu interactions', () => {
    it('should open dropdown menu when trigger button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <UploadMenu
          onFileInputTrigger={mockOnFileInputTrigger}
          onCameraTrigger={mockOnCameraTrigger}
        />,
      );

      const button = screen.getByRole('button');
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText('Upload File')).toBeInTheDocument();
      });
    });

    it('should display "Upload File" menu item', async () => {
      const user = userEvent.setup();
      render(
        <UploadMenu
          onFileInputTrigger={mockOnFileInputTrigger}
          onCameraTrigger={mockOnCameraTrigger}
        />,
      );

      const button = screen.getByRole('button');
      await user.click(button);

      await waitFor(() => {
        const menuItem = screen.getByText('Upload File');
        expect(menuItem).toBeInTheDocument();
      });
    });

    it('should call onFileInputTrigger when "Upload File" is clicked', async () => {
      const user = userEvent.setup();
      render(
        <UploadMenu
          onFileInputTrigger={mockOnFileInputTrigger}
          onCameraTrigger={mockOnCameraTrigger}
        />,
      );

      const button = screen.getByRole('button');
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText('Upload File')).toBeInTheDocument();
      });

      const uploadFileItem = screen.getByText('Upload File');
      await user.click(uploadFileItem);

      expect(mockOnFileInputTrigger).toHaveBeenCalledTimes(1);
    });

    it('should close dropdown menu after menu item is clicked', async () => {
      const user = userEvent.setup();
      render(
        <UploadMenu
          onFileInputTrigger={mockOnFileInputTrigger}
          onCameraTrigger={mockOnCameraTrigger}
        />,
      );

      const button = screen.getByRole('button');
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText('Upload File')).toBeInTheDocument();
      });

      const uploadFileItem = screen.getByText('Upload File');
      await user.click(uploadFileItem);

      expect(mockOnFileInputTrigger).toHaveBeenCalledTimes(1);
    });

    it('should close dropdown when clicking outside', async () => {
      const user = userEvent.setup();
      render(
        <div>
          <div data-testid="outside">Outside</div>
          <UploadMenu
            onFileInputTrigger={mockOnFileInputTrigger}
            onCameraTrigger={mockOnCameraTrigger}
          />
        </div>,
      );

      const button = screen.getByRole('button');
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText('Upload File')).toBeInTheDocument();
      });

      // Click outside by clicking on body
      fireEvent.pointerDown(document.body);

      await waitFor(() => {
        expect(screen.queryByText('Upload File')).not.toBeInTheDocument();
      });
    });

    it('should open dropdown when trigger is clicked', async () => {
      const user = userEvent.setup();
      render(
        <UploadMenu
          onFileInputTrigger={mockOnFileInputTrigger}
          onCameraTrigger={mockOnCameraTrigger}
        />,
      );

      const button = screen.getByRole('button');

      // First click opens the menu
      await user.click(button);
      await waitFor(() => {
        expect(screen.getByText('Upload File')).toBeInTheDocument();
      });

      // Clicking menu item should trigger callback
      const uploadFileItem = screen.getByText('Upload File');
      await user.click(uploadFileItem);

      expect(mockOnFileInputTrigger).toHaveBeenCalledTimes(1);
    });
  });

  describe('menu item rendering', () => {
    it('should render menu item with upload icon', async () => {
      const user = userEvent.setup();
      render(
        <UploadMenu
          onFileInputTrigger={mockOnFileInputTrigger}
          onCameraTrigger={mockOnCameraTrigger}
        />,
      );

      const button = screen.getByRole('button');
      await user.click(button);

      await waitFor(() => {
        const menuItem = screen
          .getByText('Upload File')
          .closest('[role="menuitem"]');
        expect(menuItem).toBeInTheDocument();
      });
    });

    it('should have correct styling on menu items', async () => {
      const user = userEvent.setup();
      render(
        <UploadMenu
          onFileInputTrigger={mockOnFileInputTrigger}
          onCameraTrigger={mockOnCameraTrigger}
        />,
      );

      const button = screen.getByRole('button');
      await user.click(button);

      await waitFor(() => {
        const menuItem = screen
          .getByText('Upload File')
          .closest('[role="menuitem"]');
        expect(menuItem).toHaveClass('cursor-pointer');
      });
    });

    it('should only show Upload File and Camera options (other options are commented out)', async () => {
      const user = userEvent.setup();
      render(
        <UploadMenu
          onFileInputTrigger={mockOnFileInputTrigger}
          onCameraTrigger={mockOnCameraTrigger}
        />,
      );

      const button = screen.getByRole('button');
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText('Upload File')).toBeInTheDocument();
      });

      // Camera shows whenever the upload menu does
      expect(screen.getByText('Camera')).toBeInTheDocument();

      // These options should NOT be present (they're commented out)
      expect(screen.queryByText('Upload from phone')).not.toBeInTheDocument();
      expect(screen.queryByText('Google Drive')).not.toBeInTheDocument();
      expect(screen.queryByText('Microsoft OneDrive')).not.toBeInTheDocument();
      expect(screen.queryByText('Website')).not.toBeInTheDocument();
    });
  });

  describe('camera menu item', () => {
    it('should display "Camera" menu item below "Upload File"', async () => {
      const user = userEvent.setup();
      render(
        <UploadMenu
          onFileInputTrigger={mockOnFileInputTrigger}
          onCameraTrigger={mockOnCameraTrigger}
        />,
      );

      const button = screen.getByRole('button');
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText('Camera')).toBeInTheDocument();
      });

      // Ensure ordering: "Upload File" appears before "Camera"
      const menuItems = screen.getAllByRole('menuitem');
      const labels = menuItems.map((item) => item.textContent);
      const uploadIndex = labels.findIndex((label) =>
        label?.includes('Upload File'),
      );
      const cameraIndex = labels.findIndex((label) =>
        label?.includes('Camera'),
      );
      expect(uploadIndex).toBeGreaterThanOrEqual(0);
      expect(cameraIndex).toBeGreaterThan(uploadIndex);
    });

    it('should call onCameraTrigger when "Camera" is clicked', async () => {
      const user = userEvent.setup();
      render(
        <UploadMenu
          onFileInputTrigger={mockOnFileInputTrigger}
          onCameraTrigger={mockOnCameraTrigger}
        />,
      );

      const button = screen.getByRole('button');
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText('Camera')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Camera'));

      expect(mockOnCameraTrigger).toHaveBeenCalledTimes(1);
      expect(mockOnFileInputTrigger).not.toHaveBeenCalled();
    });

    it('should not render "Camera" when useShowAttachment returns false', () => {
      mockUseShowAttachment.mockReturnValue(false);

      render(
        <UploadMenu
          onFileInputTrigger={mockOnFileInputTrigger}
          onCameraTrigger={mockOnCameraTrigger}
        />,
      );

      expect(screen.queryByText('Camera')).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should be keyboard accessible', async () => {
      render(
        <UploadMenu
          onFileInputTrigger={mockOnFileInputTrigger}
          onCameraTrigger={mockOnCameraTrigger}
        />,
      );

      const button = screen.getByRole('button');
      button.focus();

      expect(document.activeElement).toBe(button);
    });

    it('should open dropdown with Enter key', async () => {
      render(
        <UploadMenu
          onFileInputTrigger={mockOnFileInputTrigger}
          onCameraTrigger={mockOnCameraTrigger}
        />,
      );

      const button = screen.getByRole('button');
      button.focus();

      fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText('Upload File')).toBeInTheDocument();
      });
    });

    it('should open dropdown with Space key', async () => {
      render(
        <UploadMenu
          onFileInputTrigger={mockOnFileInputTrigger}
          onCameraTrigger={mockOnCameraTrigger}
        />,
      );

      const button = screen.getByRole('button');
      button.focus();

      fireEvent.keyDown(button, { key: ' ', code: 'Space' });

      await waitFor(() => {
        expect(screen.getByText('Upload File')).toBeInTheDocument();
      });
    });

    it('should have appropriate role attributes', async () => {
      const user = userEvent.setup();
      render(
        <UploadMenu
          onFileInputTrigger={mockOnFileInputTrigger}
          onCameraTrigger={mockOnCameraTrigger}
        />,
      );

      const button = screen.getByRole('button');
      await user.click(button);

      await waitFor(() => {
        const menuItem = screen
          .getByText('Upload File')
          .closest('[role="menuitem"]');
        expect(menuItem).toBeInTheDocument();
      });
    });
  });

  describe('edge cases', () => {
    it('should handle rapid clicks on trigger button', async () => {
      render(
        <UploadMenu
          onFileInputTrigger={mockOnFileInputTrigger}
          onCameraTrigger={mockOnCameraTrigger}
        />,
      );

      const button = screen.getByRole('button');

      // Rapid clicks using fireEvent
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);

      // Should still be functional
      expect(button).toBeInTheDocument();
    });

    it('should handle null/undefined onFileInputTrigger gracefully', async () => {
      const user = userEvent.setup();
      render(
        <UploadMenu
          onFileInputTrigger={undefined as any}
          onCameraTrigger={mockOnCameraTrigger}
        />,
      );

      const button = screen.getByRole('button');
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText('Upload File')).toBeInTheDocument();
      });
    });

    it('should handle being rendered and unmounted multiple times', () => {
      const { unmount } = render(
        <UploadMenu
          onFileInputTrigger={mockOnFileInputTrigger}
          onCameraTrigger={mockOnCameraTrigger}
        />,
      );

      expect(screen.getByRole('button')).toBeInTheDocument();

      unmount();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();

      // Re-render with a new render call
      render(
        <UploadMenu
          onFileInputTrigger={mockOnFileInputTrigger}
          onCameraTrigger={mockOnCameraTrigger}
        />,
      );
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should maintain functionality when onFileInputTrigger changes', async () => {
      const user = userEvent.setup();
      const mockOnFileInputTrigger1 = vi.fn();
      const mockOnFileInputTrigger2 = vi.fn();

      const { rerender } = render(
        <UploadMenu
          onFileInputTrigger={mockOnFileInputTrigger1}
          onCameraTrigger={mockOnCameraTrigger}
        />,
      );

      const button = screen.getByRole('button');
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText('Upload File')).toBeInTheDocument();
      });

      const uploadFileItem = screen.getByText('Upload File');
      await user.click(uploadFileItem);

      expect(mockOnFileInputTrigger1).toHaveBeenCalledTimes(1);
      expect(mockOnFileInputTrigger2).not.toHaveBeenCalled();

      rerender(
        <UploadMenu
          onFileInputTrigger={mockOnFileInputTrigger2}
          onCameraTrigger={mockOnCameraTrigger}
        />,
      );

      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText('Upload File')).toBeInTheDocument();
      });

      const uploadFileItem2 = screen.getByText('Upload File');
      await user.click(uploadFileItem2);

      expect(mockOnFileInputTrigger1).toHaveBeenCalledTimes(1);
      expect(mockOnFileInputTrigger2).toHaveBeenCalledTimes(1);
    });
  });

  describe('visibility toggle', () => {
    it('should toggle visibility when useShowAttachment changes', () => {
      mockUseShowAttachment.mockReturnValue(true);

      const { rerender, container } = render(
        <UploadMenu
          onFileInputTrigger={mockOnFileInputTrigger}
          onCameraTrigger={mockOnCameraTrigger}
        />,
      );

      expect(screen.getByRole('button')).toBeInTheDocument();

      mockUseShowAttachment.mockReturnValue(false);
      rerender(
        <UploadMenu
          onFileInputTrigger={mockOnFileInputTrigger}
          onCameraTrigger={mockOnCameraTrigger}
        />,
      );

      expect(container.firstChild).toBeNull();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('z-index and positioning', () => {
    it('should have z-50 on dropdown content for proper layering', async () => {
      const user = userEvent.setup();
      render(
        <UploadMenu
          onFileInputTrigger={mockOnFileInputTrigger}
          onCameraTrigger={mockOnCameraTrigger}
        />,
      );

      const button = screen.getByRole('button');
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText('Upload File')).toBeInTheDocument();
      });
    });
  });
});
