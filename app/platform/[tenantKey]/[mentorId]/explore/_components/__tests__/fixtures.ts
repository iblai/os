import { vi } from 'vitest';
import type { ExplorePageContextValue } from '../explore-page-context';

export const mockMentor = {
  id: 'mentor-123',
  name: 'Test Mentor',
  unique_id: 'test-mentor-unique',
  profile_image: 'https://example.com/image.jpg',
  description: 'Test mentor description',
  updated_at: '2024-01-01T00:00:00Z',
  starred: false,
  metadata: {},
};

export const mockStarredMentor = {
  ...mockMentor,
  id: 'starred-mentor-123',
  name: 'Starred Mentor',
  unique_id: 'starred-mentor-unique',
  starred: true,
};

export const mockMentorsList = {
  results: [
    mockMentor,
    {
      ...mockMentor,
      id: 'mentor-456',
      name: 'Another Mentor',
      unique_id: 'another-mentor',
    },
  ],
  next: null,
  count: 2,
  facets: {},
};

export const mockMentorsListWithPagination = {
  results: [
    mockMentor,
    {
      ...mockMentor,
      id: 'mentor-456',
      name: 'Another Mentor',
      unique_id: 'another-mentor',
    },
  ],
  next: 'https://api.example.com/mentors?page=2',
  count: 10,
  facets: {},
};

export const mockEmptyMentorsList = {
  results: [],
  next: null,
  count: 0,
  facets: {},
};

export const mockExplorePageContext: ExplorePageContextValue = {
  tenantKey: 'test-tenant',
  username: 'testuser',
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
  toggleFavorite: vi.fn(),
  handleMentorClick: vi.fn(),
  starredMentorsLoading: false,
  setStarredMentorsLoading: vi.fn(),
  customMentorsLoading: false,
  setCustomMentorsLoading: vi.fn(),
  featuredMentorsLoading: false,
  setFeaturedMentorsLoading: vi.fn(),
  defaultMentorsLoading: false,
  setDefaultMentorsLoading: vi.fn(),
};

export const createMockContext = (
  overrides?: Partial<ExplorePageContextValue>,
): ExplorePageContextValue => ({
  ...mockExplorePageContext,
  ...overrides,
});
