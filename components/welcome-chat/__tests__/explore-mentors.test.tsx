import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExploreMentors } from '../explore-mentors';

// Mock hooks
const mockNavigateToExplore = vi.fn();
const mockNavigateToMentor = vi.fn();
vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({
    navigateToExplore: mockNavigateToExplore,
    navigateToMentor: mockNavigateToMentor,
  }),
}));

const mockUseUsername = vi.fn((): string | null => 'test-user');
vi.mock('@/hooks/use-user', () => ({
  useUsername: () => mockUseUsername(),
}));

const mockUseParams = vi.fn((): { tenantKey?: string; mentorId: string } => ({
  tenantKey: 'test-tenant',
  mentorId: 'test-mentor',
}));
vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

const mockUseTenantMetadata = vi.fn(
  (): { metadata?: { mentor_include_community_mentors: boolean } } => ({
    metadata: {
      mentor_include_community_mentors: true,
    },
  }),
);
vi.mock('@iblai/iblai-js/web-utils', () => ({
  useTenantMetadata: () => mockUseTenantMetadata(),
}));

// Mock data-layer hooks
const mockUseGetAiSearchMentorsQuery = vi.fn();
const mockUseGetPublicMentorsQuery = vi.fn();

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetAiSearchMentorsQuery: (...args: unknown[]) =>
    mockUseGetAiSearchMentorsQuery(...args),
  useGetPublicMentorsQuery: (...args: unknown[]) =>
    mockUseGetPublicMentorsQuery(...args),
}));

// Mock date-fns
vi.mock('date-fns', () => ({
  format: (_date: Date, _formatStr: string) => 'Jan 15, 2025',
}));

describe('ExploreMentors', () => {
  const mockMentors = [
    {
      unique_id: 'mentor-1',
      name: 'Test Mentor 1',
      description: 'A helpful AI mentor for testing',
      profile_image: 'https://example.com/avatar1.png',
      updated_at: '2025-01-15T10:00:00Z',
    },
    {
      unique_id: 'mentor-2',
      name: 'Test Mentor 2',
      description: 'Another great mentor',
      profile_image: 'https://example.com/avatar2.png',
      updated_at: '2025-01-10T10:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseUsername.mockReturnValue('test-user');
    mockUseParams.mockReturnValue({
      tenantKey: 'test-tenant',
      mentorId: 'test-mentor',
    });
    mockUseTenantMetadata.mockReturnValue({
      metadata: {
        mentor_include_community_mentors: true,
      },
    });

    mockUseGetAiSearchMentorsQuery.mockReturnValue({
      data: { results: mockMentors },
    });

    mockUseGetPublicMentorsQuery.mockReturnValue({
      data: { results: mockMentors },
    });
  });

  describe('Basic rendering', () => {
    it('renders the section title', () => {
      render(<ExploreMentors />);

      expect(screen.getByText('Explore Agents')).toBeInTheDocument();
    });

    it('renders the Browse All button', () => {
      render(<ExploreMentors />);

      expect(screen.getByText('Browse All')).toBeInTheDocument();
    });

    it('renders mentor cards when mentors are available', () => {
      render(<ExploreMentors />);

      expect(screen.getByText('Test Mentor 1')).toBeInTheDocument();
      expect(screen.getByText('Test Mentor 2')).toBeInTheDocument();
    });

    it('renders mentor descriptions', () => {
      render(<ExploreMentors />);

      expect(
        screen.getByText('A helpful AI mentor for testing'),
      ).toBeInTheDocument();
      expect(screen.getByText('Another great mentor')).toBeInTheDocument();
    });

    it('renders updated dates', () => {
      render(<ExploreMentors />);

      const dateElements = screen.getAllByText(/Updated on Jan 15, 2025/);
      expect(dateElements.length).toBeGreaterThan(0);
    });

    it('renders avatar fallback with first two characters of name', () => {
      render(<ExploreMentors />);

      const avatarFallbacks = screen.getAllByText('Te');
      expect(avatarFallbacks.length).toBe(2);
    });
  });

  describe('Empty state', () => {
    it('returns null when no mentors are available', () => {
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: { results: [] },
      });

      const { container } = render(<ExploreMentors />);

      expect(container.firstChild).toBeNull();
    });

    it('returns null when results is undefined', () => {
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: {},
      });

      const { container } = render(<ExploreMentors />);

      expect(container.firstChild).toBeNull();
    });

    it('returns null when data is undefined', () => {
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: undefined,
      });

      const { container } = render(<ExploreMentors />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('Navigation', () => {
    it('calls navigateToExplore when Browse All is clicked', () => {
      render(<ExploreMentors />);

      const browseAllButton = screen.getByText('Browse All');
      fireEvent.click(browseAllButton);

      expect(mockNavigateToExplore).toHaveBeenCalledTimes(1);
    });

    it('calls navigateToMentor when a mentor card is clicked', () => {
      render(<ExploreMentors />);

      const mentorCard = screen.getByLabelText(
        /Explore agent: Test Mentor 1\. A helpful AI mentor for testing/,
      );
      fireEvent.click(mentorCard);

      expect(mockNavigateToMentor).toHaveBeenCalledWith('mentor-1');
    });

    it('calls navigateToMentor with empty string when mentor has no unique_id', () => {
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: {
          results: [
            {
              unique_id: undefined,
              name: 'No ID Mentor',
              description: 'A mentor without ID',
              updated_at: '2025-01-15T10:00:00Z',
            },
          ],
        },
      });

      render(<ExploreMentors />);

      const mentorCard = screen.getByLabelText(/Explore agent: No ID Mentor/);
      fireEvent.click(mentorCard);

      expect(mockNavigateToMentor).toHaveBeenCalledWith('');
    });
  });

  describe('Keyboard accessibility', () => {
    it('navigates to mentor when Enter key is pressed', () => {
      render(<ExploreMentors />);

      const mentorCard = screen.getByLabelText(
        /Explore agent: Test Mentor 1\. A helpful AI mentor for testing/,
      );
      fireEvent.keyDown(mentorCard, { key: 'Enter' });

      expect(mockNavigateToMentor).toHaveBeenCalledWith('mentor-1');
    });

    it('navigates to mentor when Space key is pressed', () => {
      render(<ExploreMentors />);

      const mentorCard = screen.getByLabelText(
        /Explore agent: Test Mentor 1\. A helpful AI mentor for testing/,
      );
      fireEvent.keyDown(mentorCard, { key: ' ' });

      expect(mockNavigateToMentor).toHaveBeenCalledWith('mentor-1');
    });

    it('does not navigate when other keys are pressed', () => {
      render(<ExploreMentors />);

      const mentorCard = screen.getByLabelText(
        /Explore agent: Test Mentor 1\. A helpful AI mentor for testing/,
      );
      fireEvent.keyDown(mentorCard, { key: 'Tab' });

      expect(mockNavigateToMentor).not.toHaveBeenCalled();
    });

    it('mentor cards have correct role and tabIndex', () => {
      render(<ExploreMentors />);

      const mentorCard = screen.getByLabelText(
        /Explore agent: Test Mentor 1\. A helpful AI mentor for testing/,
      );
      expect(mentorCard).toHaveAttribute('role', 'button');
      expect(mentorCard).toHaveAttribute('tabIndex', '0');
    });

    it('navigates with empty string when Enter is pressed on mentor without unique_id', () => {
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: {
          results: [
            {
              unique_id: undefined,
              name: 'No ID Mentor',
              description: 'A mentor without ID',
              updated_at: '2025-01-15T10:00:00Z',
            },
          ],
        },
      });

      render(<ExploreMentors />);

      const mentorCard = screen.getByLabelText(/Explore agent: No ID Mentor/);
      fireEvent.keyDown(mentorCard, { key: 'Enter' });

      expect(mockNavigateToMentor).toHaveBeenCalledWith('');
    });

    it('navigates with empty string when Space is pressed on mentor without unique_id', () => {
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: {
          results: [
            {
              unique_id: undefined,
              name: 'No ID Mentor',
              description: 'A mentor without ID',
              updated_at: '2025-01-15T10:00:00Z',
            },
          ],
        },
      });

      render(<ExploreMentors />);

      const mentorCard = screen.getByLabelText(/Explore agent: No ID Mentor/);
      fireEvent.keyDown(mentorCard, { key: ' ' });

      expect(mockNavigateToMentor).toHaveBeenCalledWith('');
    });
  });

  describe('Authenticated user behavior', () => {
    it('uses useGetAiSearchMentorsQuery for authenticated users', () => {
      mockUseUsername.mockReturnValue('test-user');
      render(<ExploreMentors />);

      expect(mockUseGetAiSearchMentorsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          platform_key: 'test-tenant',
          limit: 6,
          include_main_public_mentors: true,
        }),
        expect.objectContaining({
          skip: false,
        }),
      );
    });

    it('skips useGetPublicMentorsQuery for authenticated users', () => {
      mockUseUsername.mockReturnValue('test-user');
      render(<ExploreMentors />);

      // The component passes username directly as skip value (truthy check)
      expect(mockUseGetPublicMentorsQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          skip: 'test-user',
        }),
      );
    });

    it('uses empty string for platform_key when tenantKey is undefined', () => {
      mockUseParams.mockReturnValue({
        tenantKey: undefined,
        mentorId: 'test-mentor',
      });
      mockUseUsername.mockReturnValue('test-user');
      render(<ExploreMentors />);

      expect(mockUseGetAiSearchMentorsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          platform_key: '',
        }),
        expect.objectContaining({
          skip: true,
        }),
      );
    });
  });

  describe('Anonymous user behavior', () => {
    it('uses useGetPublicMentorsQuery for anonymous users', () => {
      mockUseUsername.mockReturnValue(null);
      mockUseGetPublicMentorsQuery.mockReturnValue({
        data: { results: mockMentors },
      });

      render(<ExploreMentors />);

      // The component passes username directly as skip value (falsy null means don't skip)
      expect(mockUseGetPublicMentorsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          includeMainPublicMentors: true,
          limit: 6,
          orderBy: 'recently_accessed_at',
        }),
        expect.objectContaining({
          skip: null,
        }),
      );
    });

    it('skips useGetAiSearchMentorsQuery when tenantKey is missing', () => {
      mockUseParams.mockReturnValue({
        tenantKey: undefined,
        mentorId: 'test-mentor',
      });
      mockUseUsername.mockReturnValue(null);

      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: { results: mockMentors },
      });

      render(<ExploreMentors />);

      // Verify the query was called with skip: true due to missing tenantKey
      expect(mockUseGetAiSearchMentorsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          platform_key: '',
        }),
        expect.objectContaining({
          skip: true,
        }),
      );
    });
  });

  describe('Tenant metadata handling', () => {
    it('includes main public mentors when mentor_include_community_mentors is true', () => {
      mockUseTenantMetadata.mockReturnValue({
        metadata: {
          mentor_include_community_mentors: true,
        },
      });

      render(<ExploreMentors />);

      expect(mockUseGetAiSearchMentorsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          include_main_public_mentors: true,
        }),
        expect.anything(),
      );
    });

    it('excludes main public mentors when mentor_include_community_mentors is false', () => {
      mockUseTenantMetadata.mockReturnValue({
        metadata: {
          mentor_include_community_mentors: false,
        },
      });

      render(<ExploreMentors />);

      expect(mockUseGetAiSearchMentorsQuery).toHaveBeenCalledWith(
        expect.not.objectContaining({
          include_main_public_mentors: true,
        }),
        expect.anything(),
      );
    });

    it('includes main public mentors when metadata is undefined', () => {
      mockUseTenantMetadata.mockReturnValue({
        metadata: undefined,
      });

      render(<ExploreMentors />);

      expect(mockUseGetAiSearchMentorsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          include_main_public_mentors: true,
        }),
        expect.anything(),
      );
    });
  });

  describe('Mentor description fallback', () => {
    it('shows "No description available" when mentor has no description', () => {
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: {
          results: [
            {
              unique_id: 'mentor-no-desc',
              name: 'No Description Mentor',
              updated_at: '2025-01-15T10:00:00Z',
            },
          ],
        },
      });

      render(<ExploreMentors />);

      expect(
        screen.getAllByText('No description available').length,
      ).toBeGreaterThan(0);
    });
  });

  describe('Updated date fallback', () => {
    it('uses current date when updated_at is not provided', () => {
      mockUseGetAiSearchMentorsQuery.mockReturnValue({
        data: {
          results: [
            {
              unique_id: 'mentor-no-date',
              name: 'No Date Mentor',
              description: 'A mentor without date',
            },
          ],
        },
      });

      render(<ExploreMentors />);

      // Should still render with the mocked date format
      expect(screen.getByText(/Updated on/)).toBeInTheDocument();
    });
  });
});
