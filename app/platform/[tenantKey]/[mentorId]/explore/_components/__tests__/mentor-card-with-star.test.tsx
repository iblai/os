import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MentorCardWithStar } from '../mentor-card-with-star';
import {
  ExplorePageContext,
  ExplorePageContextValue,
} from '../explore-page-context';
import { TooltipProvider } from '@/components/ui/tooltip';

/**
 * Test suite for MentorCardWithStar component
 *
 * Tests the mentor card display and star/favorite functionality.
 */
describe('MentorCardWithStar', () => {
  const mockToggleFavorite = vi.fn();
  const mockHandleMentorClick = vi.fn();

  const mockContextValue: ExplorePageContextValue = {
    tenantKey: 'test-tenant',
    username: 'test-user',
    debouncedSearch: '',
    isSearching: false,
    filters: {
      categories: null,
      subjects: null,
      llm_providers: null,
      types: null,
      is_featured: null,
    },
    createdBy: 'my-organization',
    includeMainPublicMentors: false,
    togglingMentorId: null,
    toggleFavorite: mockToggleFavorite,
    handleMentorClick: mockHandleMentorClick,
    starredMentorsLoading: false,
    setStarredMentorsLoading: vi.fn(),
    customMentorsLoading: false,
    setCustomMentorsLoading: vi.fn(),
    featuredMentorsLoading: false,
    setFeaturedMentorsLoading: vi.fn(),
    defaultMentorsLoading: false,
    setDefaultMentorsLoading: vi.fn(),
  };

  const mockMentor = {
    id: '1',
    name: 'Test Mentor',
    unique_id: 'test-mentor-1',
    profile_image: 'https://example.com/avatar.jpg',
    description: 'A helpful mentor for testing',
    updated_at: '2024-01-15T10:00:00Z',
  };

  type MentorType = {
    id: string | number;
    name: string;
    unique_id?: string;
    profile_image?: string;
    description?: string;
    updated_at?: string;
    starred?: boolean;
  };

  const renderWithContext = (
    mentor: MentorType,
    contextOverrides: Partial<ExplorePageContextValue> = {},
  ) => {
    return render(
      <TooltipProvider>
        <ExplorePageContext.Provider
          value={{ ...mockContextValue, ...contextOverrides }}
        >
          <MentorCardWithStar mentor={mentor} />
        </ExplorePageContext.Provider>
      </TooltipProvider>,
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic rendering', () => {
    it('renders mentor name', () => {
      renderWithContext(mockMentor);

      expect(screen.getByText('Test Mentor')).toBeInTheDocument();
    });

    it('renders mentor description', () => {
      renderWithContext(mockMentor);

      expect(
        screen.getByText('A helpful mentor for testing'),
      ).toBeInTheDocument();
    });

    it('renders avatar component when profile_image is provided', () => {
      renderWithContext(mockMentor);

      // Avatar component renders with a fallback visible initially (image loads async)
      const avatar = document.querySelector('[data-slot="avatar"]');
      expect(avatar).toBeInTheDocument();
    });

    it('renders avatar with fallback initials', () => {
      renderWithContext({ ...mockMentor, profile_image: undefined });

      expect(screen.getByText('TE')).toBeInTheDocument();
    });

    it('renders updated date when provided', () => {
      renderWithContext(mockMentor);

      expect(screen.getByText(/Updated on/)).toBeInTheDocument();
    });

    it('does not render updated date when not provided', () => {
      renderWithContext({ ...mockMentor, updated_at: undefined });

      expect(screen.queryByText(/Updated on/)).not.toBeInTheDocument();
    });

    it('does not render updated date when null', () => {
      renderWithContext({
        ...mockMentor,
        updated_at: null as unknown as string,
      });

      expect(screen.queryByText(/Updated on/)).not.toBeInTheDocument();
    });
  });

  describe('Star button', () => {
    it('renders star button with add to favorites label when not starred', () => {
      renderWithContext(mockMentor);

      expect(
        screen.getByRole('button', { name: /Add to favorites/i }),
      ).toBeInTheDocument();
    });

    it('renders star button with remove from favorites label when starred', () => {
      const starredMentor = { ...mockMentor, starred: true };
      renderWithContext(starredMentor);

      expect(
        screen.getByRole('button', { name: /Remove from favorites/i }),
      ).toBeInTheDocument();
    });

    it('calls toggleFavorite when star button is clicked', async () => {
      const user = userEvent.setup();
      renderWithContext(mockMentor);

      const starButton = screen.getByRole('button', {
        name: /Add to favorites/i,
      });
      await user.click(starButton);

      expect(mockToggleFavorite).toHaveBeenCalledWith(
        mockMentor,
        expect.any(Object),
      );
    });

    it('disables star button when username is not available', () => {
      renderWithContext(mockMentor, { username: null });

      const starButton = screen.getByRole('button', {
        name: /Add to favorites/i,
      });
      expect(starButton).toBeDisabled();
    });

    it('disables star button when toggling is in progress for this mentor', () => {
      renderWithContext(mockMentor, { togglingMentorId: '1' });

      const starButton = screen.getByRole('button', {
        name: /Add to favorites/i,
      });
      expect(starButton).toBeDisabled();
    });

    it('shows loading spinner when toggling this mentor', () => {
      renderWithContext(mockMentor, { togglingMentorId: '1' });

      // Loading spinner should be visible (Loader2 component)
      const starButton = screen.getByRole('button', {
        name: /Add to favorites/i,
      });
      expect(starButton.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('does not show loading spinner when toggling a different mentor', () => {
      renderWithContext(mockMentor, { togglingMentorId: '999' });

      const starButton = screen.getByRole('button', {
        name: /Add to favorites/i,
      });
      expect(starButton.querySelector('.animate-spin')).not.toBeInTheDocument();
    });

    it('star icon is unfilled when not starred', () => {
      renderWithContext(mockMentor);

      const starButton = screen.getByRole('button', {
        name: /Add to favorites/i,
      });
      const starIcon = starButton.querySelector('svg');
      expect(starIcon).toHaveClass('text-gray-400');
      expect(starIcon).not.toHaveClass('fill-current');
    });

    it('star icon is filled when starred', () => {
      const starredMentor = { ...mockMentor, starred: true };
      renderWithContext(starredMentor);

      const starButton = screen.getByRole('button', {
        name: /Remove from favorites/i,
      });
      const starIcon = starButton.querySelector('svg');
      expect(starIcon).toHaveClass('text-[#38A1E5]');
      expect(starIcon).toHaveClass('fill-current');
    });

    it('prevents event propagation when star button is clicked', async () => {
      const user = userEvent.setup();
      renderWithContext(mockMentor);

      const starButton = screen.getByRole('button', {
        name: /Add to favorites/i,
      });
      await user.click(starButton);

      // toggleFavorite should be called, but handleMentorClick should not
      expect(mockToggleFavorite).toHaveBeenCalledTimes(1);
      expect(mockHandleMentorClick).not.toHaveBeenCalled();
    });

    it('disables star button when username is empty string', () => {
      renderWithContext(mockMentor, { username: '' });

      const starButton = screen.getByRole('button', {
        name: /Add to favorites/i,
      });
      expect(starButton).toBeDisabled();
    });

    it('enables star button when not toggling and username is available', () => {
      renderWithContext(mockMentor);

      const starButton = screen.getByRole('button', {
        name: /Add to favorites/i,
      });
      expect(starButton).not.toBeDisabled();
    });

    it('handles toggling for mentor with numeric id', () => {
      const numericIdMentor = { id: 123, name: 'Numeric' };
      renderWithContext(numericIdMentor, { togglingMentorId: '123' });

      const starButton = screen.getByRole('button', {
        name: /Add to favorites/i,
      });
      expect(starButton).toBeDisabled();
      expect(starButton.querySelector('.animate-spin')).toBeInTheDocument();
    });
  });

  describe('Card interactions', () => {
    it('calls handleMentorClick when card is clicked', async () => {
      const user = userEvent.setup();
      renderWithContext(mockMentor);

      const card = screen.getByLabelText(/Explore agent/i);
      await user.click(card);

      expect(mockHandleMentorClick).toHaveBeenCalledWith(mockMentor);
    });

    it('does not call handleMentorClick when star button is clicked', async () => {
      const user = userEvent.setup();
      renderWithContext(mockMentor);

      const starButton = screen.getByRole('button', {
        name: /Add to favorites/i,
      });
      await user.click(starButton);

      expect(mockHandleMentorClick).not.toHaveBeenCalled();
    });

    it('navigates to mentor on Enter key press', () => {
      renderWithContext(mockMentor);

      const card = screen.getByLabelText(/Explore agent/i);
      fireEvent.keyDown(card, { key: 'Enter' });

      expect(mockHandleMentorClick).toHaveBeenCalledWith(mockMentor);
    });

    it('navigates to mentor on Space key press', () => {
      renderWithContext(mockMentor);

      const card = screen.getByLabelText(/Explore agent/i);
      fireEvent.keyDown(card, { key: ' ' });

      expect(mockHandleMentorClick).toHaveBeenCalledWith(mockMentor);
    });

    it('does not navigate on other key press', () => {
      renderWithContext(mockMentor);

      const card = screen.getByLabelText(/Explore agent/i);
      fireEvent.keyDown(card, { key: 'Tab' });

      expect(mockHandleMentorClick).not.toHaveBeenCalled();
    });

    it('does not navigate when Enter is pressed on star button', () => {
      renderWithContext(mockMentor);

      const starButton = screen.getByRole('button', {
        name: /Add to favorites/i,
      });
      fireEvent.keyDown(starButton, { key: 'Enter' });

      expect(mockHandleMentorClick).not.toHaveBeenCalled();
    });

    it('does not navigate when Space is pressed on star button', () => {
      renderWithContext(mockMentor);

      const starButton = screen.getByRole('button', {
        name: /Add to favorites/i,
      });
      fireEvent.keyDown(starButton, { key: ' ' });

      expect(mockHandleMentorClick).not.toHaveBeenCalled();
    });

    it('calls handleMentorClick only once on Enter key press', () => {
      renderWithContext(mockMentor);

      const card = screen.getByLabelText(/Explore agent/i);
      fireEvent.keyDown(card, { key: 'Enter' });
      fireEvent.keyDown(card, { key: 'Enter' });

      // Each Enter press should call handleMentorClick
      expect(mockHandleMentorClick).toHaveBeenCalledTimes(2);
    });

    it('handles Escape key without navigating', () => {
      renderWithContext(mockMentor);

      const card = screen.getByLabelText(/Explore agent/i);
      fireEvent.keyDown(card, { key: 'Escape' });

      expect(mockHandleMentorClick).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has proper aria-label on card with description', () => {
      renderWithContext(mockMentor);

      const card = screen.getByLabelText(/Explore agent: Test Mentor/i);
      expect(card).toHaveAttribute(
        'aria-label',
        'Explore agent: Test Mentor. A helpful mentor for testing',
      );
    });

    it('has proper aria-label on card without description', () => {
      const noDescMentor = { ...mockMentor, description: undefined };
      renderWithContext(noDescMentor);

      const card = screen.getByLabelText(/Explore agent: Test Mentor/i);
      expect(card).toHaveAttribute(
        'aria-label',
        'Explore agent: Test Mentor. ',
      );
    });

    it('card is focusable with tabIndex', () => {
      renderWithContext(mockMentor);

      const card = screen.getByLabelText(/Explore agent/i);
      expect(card).toHaveAttribute('tabindex', '0');
    });

    it('star button has proper aria-label when not starred', () => {
      renderWithContext(mockMentor);

      expect(screen.getByLabelText(/Add to favorites/i)).toBeInTheDocument();
    });

    it('star button has proper aria-label when starred', () => {
      const starredMentor = { ...mockMentor, starred: true };
      renderWithContext(starredMentor);

      expect(
        screen.getByLabelText(/Remove from favorites/i),
      ).toBeInTheDocument();
    });

    it('avatar has accessible fallback text', () => {
      renderWithContext({ ...mockMentor, profile_image: undefined });

      // Avatar fallback shows initials
      expect(screen.getByText('TE')).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('handles mentor with minimal data', () => {
      const minimalMentor = {
        id: '2',
        name: 'Minimal',
      };

      renderWithContext(minimalMentor);

      expect(screen.getByText('Minimal')).toBeInTheDocument();
      expect(screen.getByText('MI')).toBeInTheDocument(); // Avatar fallback
    });

    it('handles mentor with numeric id', () => {
      const numericIdMentor = {
        id: 123,
        name: 'Numeric ID Mentor',
      };

      renderWithContext(numericIdMentor);

      expect(screen.getByText('Numeric ID Mentor')).toBeInTheDocument();
    });

    it('handles empty description', () => {
      const noDescMentor = {
        ...mockMentor,
        description: '',
      };

      renderWithContext(noDescMentor);

      expect(screen.getByText('Test Mentor')).toBeInTheDocument();
    });

    it('handles mentor with starred explicitly set to false', () => {
      const notStarredMentor = { ...mockMentor, starred: false };
      renderWithContext(notStarredMentor);

      expect(
        screen.getByRole('button', { name: /Add to favorites/i }),
      ).toBeInTheDocument();
      const starButton = screen.getByRole('button', {
        name: /Add to favorites/i,
      });
      const starIcon = starButton.querySelector('svg');
      expect(starIcon).not.toHaveClass('fill-current');
    });

    it('handles single character name for avatar fallback', () => {
      const singleCharMentor = {
        id: '3',
        name: 'X',
      };

      renderWithContext(singleCharMentor);

      // Should still render correctly (substring(0,2) on 'X' gives 'X')
      // Both name and fallback will show 'X', so check both exist
      const allX = screen.getAllByText('X');
      expect(allX.length).toBe(2); // One in h3, one in fallback
    });

    it('handles mentor with long description', () => {
      const longDescMentor = {
        ...mockMentor,
        description: 'A'.repeat(500),
      };

      renderWithContext(longDescMentor);

      expect(screen.getByText('A'.repeat(500))).toBeInTheDocument();
    });

    it('handles mentor with special characters in name', () => {
      const specialCharMentor = {
        id: '4',
        name: 'Test & Mentor <Script>',
      };

      renderWithContext(specialCharMentor);

      expect(screen.getByText('Test & Mentor <Script>')).toBeInTheDocument();
    });

    it('handles mentor id conversion for toggling state', () => {
      // Test that numeric ID is converted to string correctly for comparison
      const numericIdMentor = { id: 42, name: 'Numeric' };

      // togglingMentorId '42' should match id 42 converted to string
      renderWithContext(numericIdMentor, { togglingMentorId: '42' });

      const starButton = screen.getByRole('button', {
        name: /Add to favorites/i,
      });
      expect(starButton).toBeDisabled();
    });
  });
});
