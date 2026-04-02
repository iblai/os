import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock next/navigation
const mockUseParams = vi.fn();
vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock data-layer
const mockAddTrainingDocument = vi.fn();
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useAddTrainingDocumentMutation: () => [mockAddTrainingDocument],
}));

// Mock useNavigate
const mockGetMentorId = vi.fn();
vi.mock('../user-navigate', () => ({
  useNavigate: () => ({
    getMentorId: () => mockGetMentorId(),
  }),
}));

// Mock useUsername
const mockUseUsername = vi.fn();
vi.mock('../use-user', () => ({
  useUsername: () => mockUseUsername(),
}));

// Mock extractErrorMessage
vi.mock(
  '@/components/modals/edit-mentor-modal/tabs/datasets-tab/resource-modal/utils',
  () => ({
    extractErrorMessage: vi.fn(
      (error: unknown, defaultMsg: string) =>
        (error as { message?: string })?.message || defaultMsg,
    ),
  }),
);

import { useWebsiteCrawlerResource } from '../use-website-crawler-resource';
import { toast } from 'sonner';
import type { ResourceType } from '@/components/modals/edit-mentor-modal/tabs/datasets-tab/resource-types';

describe('useWebsiteCrawlerResource', () => {
  const mockResource = {
    id: 'webcrawler',
    name: 'Web Crawler',
    icon: null,
    bgColor: 'bg-gray-100',
    isActive: true,
    type: 'webcrawler',
  } as ResourceType;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({
      tenantKey: 'tenant-1',
      mentorId: 'mentor-1',
    });
    mockGetMentorId.mockReturnValue('mentor-from-navigate');
    mockUseUsername.mockReturnValue('testuser');
    mockAddTrainingDocument.mockReturnValue({
      unwrap: () => Promise.resolve({}),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('handleCheckUrlIsValid', () => {
    it('should return true for valid URLs', () => {
      const { result } = renderHook(() =>
        useWebsiteCrawlerResource(mockResource),
      );

      expect(result.current.handleCheckUrlIsValid('https://example.com')).toBe(
        true,
      );
      expect(result.current.handleCheckUrlIsValid('http://example.com')).toBe(
        true,
      );
      expect(
        result.current.handleCheckUrlIsValid('https://example.com/path'),
      ).toBe(true);
    });

    it('should return false for invalid URLs', () => {
      const { result } = renderHook(() =>
        useWebsiteCrawlerResource(mockResource),
      );

      expect(result.current.handleCheckUrlIsValid('not-a-url')).toBe(false);
      expect(result.current.handleCheckUrlIsValid('example.com')).toBe(false);
      expect(result.current.handleCheckUrlIsValid('')).toBe(false);
    });
  });

  describe('form', () => {
    it('should have correct default values', () => {
      const { result } = renderHook(() =>
        useWebsiteCrawlerResource(mockResource),
      );

      expect(result.current.form.state.values).toEqual({
        url: '',
        type: 'webcrawler',
        crawler_max_depth: 1,
        crawler_max_pages_limit: 1,
        crawler_match_patterns: [],
        crawler_pattern_type: 'glob',
        temp_crawler_match_patterns: '',
      });
    });
  });

  describe('crawlerMatchPatterns', () => {
    it('should initialize with empty array', () => {
      const { result } = renderHook(() =>
        useWebsiteCrawlerResource(mockResource),
      );

      expect(result.current.crawlerMatchPatterns).toEqual([]);
    });

    it('should update when setCrawlerMatchPatterns is called', () => {
      const { result } = renderHook(() =>
        useWebsiteCrawlerResource(mockResource),
      );

      act(() => {
        result.current.setCrawlerMatchPatterns(['*.html', '*.php']);
      });

      expect(result.current.crawlerMatchPatterns).toEqual(['*.html', '*.php']);
    });
  });

  describe('form submission', () => {
    it('should call addTrainingDocument on submit', async () => {
      const { result } = renderHook(() =>
        useWebsiteCrawlerResource(mockResource),
      );

      // Set form values
      await act(async () => {
        result.current.form.setFieldValue('url', 'https://example.com');
      });

      // Submit form
      await act(async () => {
        await result.current.form.handleSubmit();
      });

      expect(mockAddTrainingDocument).toHaveBeenCalledWith({
        org: 'tenant-1',
        formData: {
          type: 'webcrawler',
          pathway: 'mentor-from-navigate',
          url: 'https://example.com',
          crawler_max_depth: 1,
          crawler_max_pages_limit: 1,
          crawler_match_patterns: [],
          crawler_pattern_type: 'glob',
        },
        userId: 'testuser',
      });
    });

    it('should show success toast on successful submission', async () => {
      const { result } = renderHook(() =>
        useWebsiteCrawlerResource(mockResource),
      );

      await act(async () => {
        result.current.form.setFieldValue('url', 'https://example.com');
      });

      await act(async () => {
        await result.current.form.handleSubmit();
      });

      expect(toast.success).toHaveBeenCalledWith(
        'Web crawl started and queued for training',
      );
    });

    it('should reset form and crawlerMatchPatterns on success', async () => {
      const { result } = renderHook(() =>
        useWebsiteCrawlerResource(mockResource),
      );

      // Set values
      await act(async () => {
        result.current.form.setFieldValue('url', 'https://example.com');
        result.current.setCrawlerMatchPatterns(['*.html']);
      });

      // Submit
      await act(async () => {
        await result.current.form.handleSubmit();
      });

      expect(result.current.crawlerMatchPatterns).toEqual([]);
    });

    it('should show error toast on submission failure', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockAddTrainingDocument.mockReturnValue({
        unwrap: () => Promise.reject({ message: 'API Error' }),
      });

      const { result } = renderHook(() =>
        useWebsiteCrawlerResource(mockResource),
      );

      await act(async () => {
        result.current.form.setFieldValue('url', 'https://example.com');
      });

      await act(async () => {
        await result.current.form.handleSubmit();
      });

      expect(toast.error).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should use mentorId from params when getMentorId returns null', async () => {
      mockGetMentorId.mockReturnValue(null);

      const { result } = renderHook(() =>
        useWebsiteCrawlerResource(mockResource),
      );

      await act(async () => {
        result.current.form.setFieldValue('url', 'https://example.com');
      });

      await act(async () => {
        await result.current.form.handleSubmit();
      });

      expect(mockAddTrainingDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          formData: expect.objectContaining({
            pathway: 'mentor-1',
          }),
        }),
      );
    });

    it('should use empty string for username when null', async () => {
      mockUseUsername.mockReturnValue(null);

      const { result } = renderHook(() =>
        useWebsiteCrawlerResource(mockResource),
      );

      await act(async () => {
        result.current.form.setFieldValue('url', 'https://example.com');
      });

      await act(async () => {
        await result.current.form.handleSubmit();
      });

      expect(mockAddTrainingDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: '',
        }),
      );
    });

    it('should include crawlerMatchPatterns in submission', async () => {
      const { result } = renderHook(() =>
        useWebsiteCrawlerResource(mockResource),
      );

      await act(async () => {
        result.current.form.setFieldValue('url', 'https://example.com');
        result.current.setCrawlerMatchPatterns(['*.html', '*.php']);
      });

      await act(async () => {
        await result.current.form.handleSubmit();
      });

      expect(mockAddTrainingDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          formData: expect.objectContaining({
            crawler_match_patterns: ['*.html', '*.php'],
          }),
        }),
      );
    });

    it('should use resource type in lowercase', async () => {
      const uppercaseResource = {
        ...mockResource,
        type: 'webcrawler',
      } as ResourceType;

      const { result } = renderHook(() =>
        useWebsiteCrawlerResource(uppercaseResource),
      );

      await act(async () => {
        result.current.form.setFieldValue('url', 'https://example.com');
      });

      await act(async () => {
        await result.current.form.handleSubmit();
      });

      expect(mockAddTrainingDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          formData: expect.objectContaining({
            type: 'webcrawler',
          }),
        }),
      );
    });
  });
});
