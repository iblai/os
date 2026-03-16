import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMentorSettings } from '../use-mentor-settings';
import { MentorVisibilityEnum } from '@iblai/iblai-api';

// Mock dependencies
const mockUseParams = vi.fn();
vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

const mockUseUsername = vi.fn();
vi.mock('@/providers/use-user', () => ({
  useUsername: () => mockUseUsername(),
}));

const mockUseGetMentorSettingsQuery = vi.fn();
const mockUseGetMentorPublicSettingsQuery = vi.fn();
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetMentorSettingsQuery: (...args: unknown[]) => mockUseGetMentorSettingsQuery(...args),
  useGetMentorPublicSettingsQuery: (...args: unknown[]) =>
    mockUseGetMentorPublicSettingsQuery(...args),
}));

const mockGetCachedApiResponse = vi.fn();
const mockSetCachedApiResponse = vi.fn();
const mockIsTauriOfflineMode = vi.fn();
vi.mock('@/lib/tauri-api-cache', () => ({
  getCachedApiResponse: (...args: unknown[]) => mockGetCachedApiResponse(...args),
  setCachedApiResponse: (...args: unknown[]) => mockSetCachedApiResponse(...args),
  isTauriOfflineMode: () => mockIsTauriOfflineMode(),
  CacheKeys: {
    mentorSettings: (tenantKey: string, mentorId: string, userId: string) =>
      `mentor-settings-${tenantKey}-${mentorId}-${userId}`,
    mentorPublicSettings: (tenantKey: string, mentorId: string) =>
      `mentor-public-settings-${tenantKey}-${mentorId}`,
  },
}));

const mockIsTauriApp = vi.fn();
vi.mock('@/types/tauri', () => ({
  isTauriApp: () => mockIsTauriApp(),
}));

vi.mock('@/lib/config', () => ({
  config: {
    mainTenantKey: () => 'main-tenant',
  },
}));

vi.mock('@/lib/constants', () => ({
  ANONYMOUS_USERNAME: 'anonymous',
}));

describe('useMentorSettings', () => {
  const mockMentorSettings = {
    profile_image: 'https://example.com/profile.jpg',
    greeting_method: 'hello',
    proactive_response: true,
    llm_provider: 'openai',
    llm_name: 'gpt-4',
    mentor_unique_id: 'mentor-123',
    mentor: 'Test Mentor',
    enable_guided_prompts: true,
    mentor_slug: 'test-mentor',
    metadata: {
      safety_disclaimer: 'Safety first',
    },
    mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_ANYONE,
    platform_key: 'main-tenant',
    disclaimer: 'Test disclaimer',
    allow_anonymous: true,
    show_attachment: true,
    show_voice_call: false,
    show_voice_record: true,
    embed_show_attachment: false,
    embed_show_voice_call: true,
    embed_show_voice_record: false,
    llm_config: { temperature: 0.7 },
  };

  const mockPublicSettings = {
    profile_image: 'https://example.com/public-profile.jpg',
    greeting_method: 'hi',
    proactive_response: false,
    llm_name: 'gpt-3.5',
    mentor_unique_id: 'mentor-456',
    mentor: 'Public Mentor',
    enable_guided_prompts: false,
    mentor_slug: 'public-mentor',
    metadata: {
      safety_disclaimer: 'Public safety',
    },
    mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
    disclaimer: 'Public disclaimer',
    allow_anonymous: false,
    show_attachment: false,
    show_voice_call: true,
    show_voice_record: false,
    embed_show_attachment: true,
    embed_show_voice_call: false,
    embed_show_voice_record: true,
    llm_config: { temperature: 0.5 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({
      tenantKey: 'test-tenant',
      mentorId: 'test-mentor',
    });
    mockUseUsername.mockReturnValue('testuser');
    mockIsTauriApp.mockReturnValue(false);
    mockIsTauriOfflineMode.mockReturnValue(false);
    mockUseGetMentorSettingsQuery.mockReturnValue({
      data: mockMentorSettings,
      isLoading: false,
    });
    mockUseGetMentorPublicSettingsQuery.mockReturnValue({
      data: mockPublicSettings,
      isLoading: false,
    });
    mockGetCachedApiResponse.mockReturnValue(null);
  });

  describe('authenticated user', () => {
    it('should return mentor settings for logged in user', () => {
      const { result } = renderHook(() => useMentorSettings());

      expect(result.current.data.profileImage).toBe('https://example.com/profile.jpg');
      expect(result.current.data.greetingMethod).toBe('hello');
      expect(result.current.data.llmProvider).toBe('openai');
      expect(result.current.data.llmName).toBe('gpt-4');
      expect(result.current.isLoading).toBe(false);
    });

    it('should query with correct parameters', () => {
      renderHook(() => useMentorSettings());

      expect(mockUseGetMentorSettingsQuery).toHaveBeenCalledWith(
        {
          mentor: 'test-mentor',
          org: 'test-tenant',
          userId: 'testuser',
        },
        {
          skip: false,
        },
      );
    });

    it('should identify community mentor', () => {
      mockUseGetMentorSettingsQuery.mockReturnValue({
        data: {
          ...mockMentorSettings,
          mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_ANYONE,
          platform_key: 'main-tenant',
        },
        isLoading: false,
      });

      const { result } = renderHook(() => useMentorSettings());

      expect(result.current.data.isCommunityMentor).toBe(true);
    });

    it('should not identify as community mentor when platform_key differs', () => {
      mockUseGetMentorSettingsQuery.mockReturnValue({
        data: {
          ...mockMentorSettings,
          mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_ANYONE,
          platform_key: 'other-tenant',
        },
        isLoading: false,
      });

      const { result } = renderHook(() => useMentorSettings());

      expect(result.current.data.isCommunityMentor).toBe(false);
    });

    it('should return all mentor settings fields', () => {
      const { result } = renderHook(() => useMentorSettings());

      expect(result.current.data).toMatchObject({
        profileImage: 'https://example.com/profile.jpg',
        greetingMethod: 'hello',
        proactiveResponse: true,
        llmProvider: 'openai',
        llmName: 'gpt-4',
        mentorUniqueId: 'mentor-123',
        mentorName: 'Test Mentor',
        enableGuidedPrompts: true,
        mentorSlug: 'test-mentor',
        safetyDisclaimer: 'Safety first',
        disclaimer: 'Test disclaimer',
        mentorVisibility: MentorVisibilityEnum.VIEWABLE_BY_ANYONE,
        allowAnonymous: true,
        showAttachment: true,
        showVoiceCall: false,
        showVoiceRecord: true,
        embedShowAttachment: false,
        embedShowVoiceCall: true,
        embedShowVoiceRecord: false,
        llmConfig: { temperature: 0.7 },
      });
    });
  });

  describe('unauthenticated user', () => {
    beforeEach(() => {
      mockUseUsername.mockReturnValue(null);
      // When not logged in, mentor settings query should return undefined
      mockUseGetMentorSettingsQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
      });
    });

    it('should return public settings for anonymous user', () => {
      const { result } = renderHook(() => useMentorSettings());

      expect(result.current.data.profileImage).toBe('https://example.com/public-profile.jpg');
      expect(result.current.data.greetingMethod).toBe('hi');
      expect(result.current.data.llmProvider).toBe('');
      expect(result.current.data.llmName).toBe('gpt-3.5');
    });

    it('should query with anonymous username', () => {
      renderHook(() => useMentorSettings());

      expect(mockUseGetMentorPublicSettingsQuery).toHaveBeenCalledWith(
        {
          mentor: 'test-mentor',
          org: 'test-tenant',
          userId: 'anonymous',
        },
        {
          skip: false,
        },
      );
    });

    it('should skip mentor settings query', () => {
      renderHook(() => useMentorSettings());

      expect(mockUseGetMentorSettingsQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ skip: true }),
      );
    });

    it('should not identify as community mentor when not logged in', () => {
      const { result } = renderHook(() => useMentorSettings());

      expect(result.current.data.isCommunityMentor).toBe(false);
    });
  });

  describe('props override', () => {
    it('should use mentorId from props over params', () => {
      renderHook(() => useMentorSettings({ mentorId: 'props-mentor' }));

      expect(mockUseGetMentorSettingsQuery).toHaveBeenCalledWith(
        expect.objectContaining({ mentor: 'props-mentor' }),
        expect.anything(),
      );
    });

    it('should use tenantKey from props over params', () => {
      renderHook(() => useMentorSettings({ tenantKey: 'props-tenant' }));

      expect(mockUseGetMentorSettingsQuery).toHaveBeenCalledWith(
        expect.objectContaining({ org: 'props-tenant' }),
        expect.anything(),
      );
    });

    it('should use both props when provided', () => {
      renderHook(() => useMentorSettings({ mentorId: 'props-mentor', tenantKey: 'props-tenant' }));

      expect(mockUseGetMentorSettingsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          mentor: 'props-mentor',
          org: 'props-tenant',
        }),
        expect.anything(),
      );
    });
  });

  describe('offline mode (Tauri)', () => {
    beforeEach(() => {
      mockIsTauriApp.mockReturnValue(true);
      mockIsTauriOfflineMode.mockReturnValue(true);
    });

    it('should skip queries when offline', () => {
      renderHook(() => useMentorSettings());

      expect(mockUseGetMentorSettingsQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ skip: true }),
      );
      expect(mockUseGetMentorPublicSettingsQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ skip: true }),
      );
    });

    it('should use cached settings when offline', () => {
      mockGetCachedApiResponse.mockReturnValue(mockMentorSettings);

      const { result } = renderHook(() => useMentorSettings());

      expect(result.current.data.profileImage).toBe('https://example.com/profile.jpg');
      expect(result.current.data.greetingMethod).toBe('hello');
    });

    it('should use cached public settings when offline', () => {
      mockGetCachedApiResponse
        .mockReturnValueOnce(null) // No mentor settings cache
        .mockReturnValueOnce(mockPublicSettings); // Has public settings cache

      const { result } = renderHook(() => useMentorSettings());

      expect(result.current.data.profileImage).toBe('https://example.com/public-profile.jpg');
    });

    it('should show loading when offline without cache', () => {
      mockGetCachedApiResponse.mockReturnValue(null);

      const { result } = renderHook(() => useMentorSettings());

      expect(result.current.isLoading).toBe(true);
    });

    it('should not show loading when offline with cache', () => {
      mockGetCachedApiResponse.mockReturnValue(mockMentorSettings);

      const { result } = renderHook(() => useMentorSettings());

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('caching (Tauri online)', () => {
    beforeEach(() => {
      mockIsTauriApp.mockReturnValue(true);
      mockIsTauriOfflineMode.mockReturnValue(false);
    });

    it('should cache mentor settings when online', async () => {
      renderHook(() => useMentorSettings());

      await waitFor(() => {
        expect(mockSetCachedApiResponse).toHaveBeenCalledWith(
          'mentor-settings-test-tenant-test-mentor-testuser',
          mockMentorSettings,
          {
            org: 'test-tenant',
            mentor: 'test-mentor',
            userId: 'testuser',
          },
        );
      });
    });

    it('should cache public settings when online', async () => {
      renderHook(() => useMentorSettings());

      await waitFor(() => {
        expect(mockSetCachedApiResponse).toHaveBeenCalledWith(
          'mentor-public-settings-test-tenant-test-mentor',
          mockPublicSettings,
          {
            org: 'test-tenant',
            mentor: 'test-mentor',
          },
        );
      });
    });

    it('should not cache when data is undefined', async () => {
      mockUseGetMentorSettingsQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
      });

      renderHook(() => useMentorSettings());

      await waitFor(() => {
        expect(mockSetCachedApiResponse).not.toHaveBeenCalledWith(
          expect.stringContaining('mentor-settings'),
          expect.anything(),
          expect.anything(),
        );
      });
    });
  });

  describe('loading states', () => {
    it('should combine loading states for authenticated user', () => {
      mockUseGetMentorSettingsQuery.mockReturnValue({
        data: null,
        isLoading: true,
      });
      mockUseGetMentorPublicSettingsQuery.mockReturnValue({
        data: null,
        isLoading: false,
      });

      const { result } = renderHook(() => useMentorSettings());

      expect(result.current.isLoading).toBe(true);
    });

    it('should be loading when public settings are loading', () => {
      mockUseGetMentorSettingsQuery.mockReturnValue({
        data: mockMentorSettings,
        isLoading: false,
      });
      mockUseGetMentorPublicSettingsQuery.mockReturnValue({
        data: null,
        isLoading: true,
      });

      const { result } = renderHook(() => useMentorSettings());

      expect(result.current.isLoading).toBe(true);
    });

    it('should not be loading when both queries complete', () => {
      mockUseGetMentorSettingsQuery.mockReturnValue({
        data: mockMentorSettings,
        isLoading: false,
      });
      mockUseGetMentorPublicSettingsQuery.mockReturnValue({
        data: mockPublicSettings,
        isLoading: false,
      });

      const { result } = renderHook(() => useMentorSettings());

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('fallback to public settings', () => {
    beforeEach(() => {
      mockUseGetMentorSettingsQuery.mockReturnValue({
        data: {
          ...mockMentorSettings,
          profile_image: undefined,
          greeting_method: undefined,
        },
        isLoading: false,
      });
    });

    it('should fallback to public settings for missing fields', () => {
      const { result } = renderHook(() => useMentorSettings());

      expect(result.current.data.profileImage).toBe('https://example.com/public-profile.jpg');
      expect(result.current.data.greetingMethod).toBe('hi');
    });

    it('should fallback to public settings llm_provider when mentor settings llm_provider is missing', () => {
      mockUseGetMentorSettingsQuery.mockReturnValue({
        data: {
          ...mockMentorSettings,
          llm_provider: undefined,
        },
        isLoading: false,
      });
      mockUseGetMentorPublicSettingsQuery.mockReturnValue({
        data: {
          ...mockPublicSettings,
          llm_provider: 'anthropic',
        },
        isLoading: false,
      });

      const { result } = renderHook(() => useMentorSettings());

      expect(result.current.data.llmProvider).toBe('anthropic');
    });

    it('should use mentor settings llm_provider when available over public settings', () => {
      mockUseGetMentorSettingsQuery.mockReturnValue({
        data: {
          ...mockMentorSettings,
          llm_provider: 'openai',
        },
        isLoading: false,
      });
      mockUseGetMentorPublicSettingsQuery.mockReturnValue({
        data: {
          ...mockPublicSettings,
          llm_provider: 'anthropic',
        },
        isLoading: false,
      });

      const { result } = renderHook(() => useMentorSettings());

      expect(result.current.data.llmProvider).toBe('openai');
    });
  });

  describe('skip conditions', () => {
    it('should skip when mentorId is missing', () => {
      mockUseParams.mockReturnValue({ tenantKey: 'test-tenant' });

      renderHook(() => useMentorSettings());

      expect(mockUseGetMentorSettingsQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ skip: true }),
      );
    });

    it('should skip when tenantKey is missing', () => {
      mockUseParams.mockReturnValue({ mentorId: 'test-mentor' });

      renderHook(() => useMentorSettings());

      expect(mockUseGetMentorSettingsQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ skip: true }),
      );
    });

    it('should skip mentor settings when not logged in', () => {
      mockUseUsername.mockReturnValue(null);

      renderHook(() => useMentorSettings());

      expect(mockUseGetMentorSettingsQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ skip: true }),
      );
    });
  });
});
