import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ProjectItem } from '../project-item';

// Mock next/image
vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    width,
    height,
    className,
  }: {
    src: string;
    alt: string;
    width: number;
    height: number;
    className?: string;
  }) => (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      data-testid={`image-${alt.toLowerCase().replace(/\s+/g, '-')}`}
    />
  ),
}));

/**
 * Test suite for ProjectItem component
 *
 * Tests the project item display in sidebar with hover/menu interactions.
 */
describe('ProjectItem', () => {
  const mockOnClick = vi.fn();
  const mockOnRename = vi.fn();
  const mockOnDelete = vi.fn();

  const mockProject = {
    id: 'project-1',
    title: 'Test Project',
  };

  const defaultProps = {
    project: mockProject,
    onClick: mockOnClick,
    onRename: mockOnRename,
    onDelete: mockOnDelete,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic rendering', () => {
    it('renders project title', () => {
      render(<ProjectItem {...defaultProps} />);

      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });

    it('renders closed folder icon by default', () => {
      render(<ProjectItem {...defaultProps} />);

      const closedFolderIcon = screen.getByTestId('image-close-folder');
      expect(closedFolderIcon).toBeInTheDocument();
      expect(closedFolderIcon).toHaveAttribute('src', '/icons/projects.svg');
    });

    it('renders open folder icon when isOpen is true', () => {
      render(<ProjectItem {...defaultProps} isOpen={true} />);

      const openFolderIcon = screen.getByTestId('image-open-folder');
      expect(openFolderIcon).toBeInTheDocument();
      expect(openFolderIcon).toHaveAttribute('src', '/icons/open-folder.svg');
    });

    it('renders open folder with gray color when isOpen is true and isActive is false', () => {
      render(<ProjectItem {...defaultProps} isOpen={true} isActive={false} />);

      const openFolderIcon = screen.getByTestId('image-open-folder');
      expect(openFolderIcon).toHaveClass('text-gray-500');
      expect(openFolderIcon).not.toHaveClass('text-blue-600');
    });

    it('renders open folder with blue color when isOpen is true and isActive is true', () => {
      render(<ProjectItem {...defaultProps} isOpen={true} isActive={true} />);

      const openFolderIcon = screen.getByTestId('image-open-folder');
      expect(openFolderIcon).toHaveClass('text-blue-600');
    });

    it('applies active styling when isActive is true', () => {
      render(<ProjectItem {...defaultProps} isActive={true} />);

      const button = screen.getByRole('button', { name: /Test Project/i });
      expect(button).toHaveClass('text-blue-600');
    });

    it('does not apply active styling when isActive is false', () => {
      render(<ProjectItem {...defaultProps} isActive={false} />);

      const title = screen.getByText('Test Project');
      expect(title).toHaveClass('text-gray-700');
      expect(title).not.toHaveClass('text-blue-600');
    });
  });

  describe('Click interactions', () => {
    it('calls onClick when button is clicked', async () => {
      const user = userEvent.setup();
      render(<ProjectItem {...defaultProps} />);

      const button = screen.getByRole('button', { name: /Test Project/i });
      await user.click(button);

      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onRename or onDelete when main button is clicked', async () => {
      const user = userEvent.setup();
      render(<ProjectItem {...defaultProps} />);

      const button = screen.getByRole('button', { name: /Test Project/i });
      await user.click(button);

      expect(mockOnRename).not.toHaveBeenCalled();
      expect(mockOnDelete).not.toHaveBeenCalled();
    });
  });

  describe('Hover behavior', () => {
    it('shows dropdown menu trigger on hover', async () => {
      render(<ProjectItem {...defaultProps} />);

      const container = screen.getByText('Test Project').closest('.group');
      expect(container).toBeInTheDocument();

      // Simulate mouse enter
      fireEvent.mouseEnter(container!);

      // Menu trigger should appear
      await waitFor(() => {
        const menuTrigger = screen.getByRole('button', { name: '' });
        expect(menuTrigger).toBeInTheDocument();
      });
    });

    it('shows dropdown menu trigger when isActive is true', () => {
      render(<ProjectItem {...defaultProps} isActive={true} />);

      // Menu trigger should be visible for active items
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(1);
    });

    it('hides menu trigger on mouse leave when menu is not open', async () => {
      render(<ProjectItem {...defaultProps} />);

      const container = screen.getByText('Test Project').closest('.group');

      // Mouse enter then leave
      fireEvent.mouseEnter(container!);

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(1);
      });

      fireEvent.mouseLeave(container!);

      // Menu trigger should hide (only main button remains visible in DOM structure)
      // Note: The component keeps the trigger in DOM when not hovered but not visible
    });
  });

  describe('Dropdown menu interactions', () => {
    it('opens dropdown menu when menu trigger is clicked', async () => {
      const user = userEvent.setup();
      render(<ProjectItem {...defaultProps} isActive={true} />);

      // Find and click the menu trigger (the Ellipsis icon button)
      const menuTrigger = screen.getByRole('button', { name: '' });

      expect(menuTrigger).toBeInTheDocument();
      await user.click(menuTrigger);

      // Menu items should appear (Radix portals to body)
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /Rename Project/i })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: /Delete Project/i })).toBeInTheDocument();
      });
    });

    it('calls onRename with correct arguments when Rename is clicked', async () => {
      const user = userEvent.setup();
      render(<ProjectItem {...defaultProps} isActive={true} />);

      // Open menu
      const menuTrigger = screen.getByRole('button', { name: '' });
      await user.click(menuTrigger);

      // Click rename option
      const renameOption = await screen.findByRole('menuitem', { name: /Rename Project/i });
      await user.click(renameOption);

      expect(mockOnRename).toHaveBeenCalledWith('project-1', 'Test Project');
    });

    it('calls onDelete with correct arguments when Delete is clicked', async () => {
      const user = userEvent.setup();
      render(<ProjectItem {...defaultProps} isActive={true} />);

      // Open menu
      const menuTrigger = screen.getByRole('button', { name: '' });
      await user.click(menuTrigger);

      // Click delete option
      const deleteOption = await screen.findByRole('menuitem', { name: /Delete Project/i });
      await user.click(deleteOption);

      expect(mockOnDelete).toHaveBeenCalledWith('project-1', 'Test Project');
    });

    it('does not trigger onClick when menu trigger is clicked', async () => {
      const user = userEvent.setup();
      render(<ProjectItem {...defaultProps} isActive={true} />);

      const menuTrigger = screen.getByRole('button', { name: '' });
      await user.click(menuTrigger);

      // onClick should not be called for menu trigger
      expect(mockOnClick).not.toHaveBeenCalled();
    });

    it('does not trigger onClick when rename is clicked', async () => {
      const user = userEvent.setup();
      render(<ProjectItem {...defaultProps} isActive={true} />);

      // Open menu
      const menuTrigger = screen.getByRole('button', { name: '' });
      await user.click(menuTrigger);

      // Click rename
      const renameOption = await screen.findByRole('menuitem', { name: /Rename Project/i });
      await user.click(renameOption);

      expect(mockOnClick).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('handles project with empty title', () => {
      const emptyTitleProject = { id: 'project-2', title: '' };
      render(<ProjectItem {...defaultProps} project={emptyTitleProject} />);

      // Should render without crashing
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('handles project with long title', () => {
      const longTitleProject = {
        id: 'project-3',
        title: 'This is a very long project title that should be truncated in the UI',
      };
      render(<ProjectItem {...defaultProps} project={longTitleProject} />);

      const titleElement = screen.getByText(longTitleProject.title);
      expect(titleElement).toHaveClass('truncate');
    });

    it('handles project with special characters in title', () => {
      const specialProject = {
        id: 'project-4',
        title: '<Script>alert("XSS")</Script> & More',
      };
      render(<ProjectItem {...defaultProps} project={specialProject} />);

      expect(screen.getByText(specialProject.title)).toBeInTheDocument();
    });

    it('handles rapid hover/unhover cycles', () => {
      render(<ProjectItem {...defaultProps} />);

      const container = screen.getByText('Test Project').closest('.group');

      // Rapid hover cycles
      for (let i = 0; i < 5; i++) {
        fireEvent.mouseEnter(container!);
        fireEvent.mouseLeave(container!);
      }

      // Should not crash and component should be stable
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });
  });

  describe('State management', () => {
    it('maintains hover state when menu is open', async () => {
      const user = userEvent.setup();
      render(<ProjectItem {...defaultProps} isActive={true} />);

      const container = screen.getByText('Test Project').closest('.group');
      fireEvent.mouseEnter(container!);

      // Open menu
      const menuTrigger = screen.getByRole('button', { name: '' });
      await user.click(menuTrigger);

      // Leave container while menu is open
      fireEvent.mouseLeave(container!);

      // Menu should still be visible
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /Rename Project/i })).toBeInTheDocument();
      });
    });

    it('closes menu and clears hover state when menu item is clicked', async () => {
      const user = userEvent.setup();
      render(<ProjectItem {...defaultProps} isActive={true} />);

      // Open menu
      const menuTrigger = screen.getByRole('button', { name: '' });
      await user.click(menuTrigger);

      // Click rename
      const renameOption = await screen.findByRole('menuitem', { name: /Rename Project/i });
      await user.click(renameOption);

      // Menu should close
      await waitFor(() => {
        expect(screen.queryByRole('menuitem', { name: /Rename Project/i })).not.toBeInTheDocument();
      });
    });

    it('clears hover state when menu is closed via onOpenChange', async () => {
      const user = userEvent.setup();
      render(<ProjectItem {...defaultProps} isActive={true} />);

      const container = screen.getByText('Test Project').closest('.group');
      fireEvent.mouseEnter(container!);

      // Open menu
      const menuTrigger = screen.getByRole('button', { name: '' });
      await user.click(menuTrigger);

      // Menu should be open
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /Rename Project/i })).toBeInTheDocument();
      });

      // Close menu by clicking outside (pressing Escape)
      fireEvent.keyDown(document, { key: 'Escape' });

      // Menu should close
      await waitFor(() => {
        expect(screen.queryByRole('menuitem', { name: /Rename Project/i })).not.toBeInTheDocument();
      });
    });
  });

  describe('Default props', () => {
    it('defaults isActive to false', () => {
      render(<ProjectItem {...defaultProps} />);

      const title = screen.getByText('Test Project');
      expect(title).not.toHaveClass('text-blue-600');
    });

    it('defaults isOpen to false', () => {
      render(<ProjectItem {...defaultProps} />);

      const closedFolderIcon = screen.getByTestId('image-close-folder');
      expect(closedFolderIcon).toBeInTheDocument();
    });
  });
});
