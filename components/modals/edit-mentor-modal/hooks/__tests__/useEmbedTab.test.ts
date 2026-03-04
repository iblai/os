import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import useEmbedTab from '../useEmbedTab';
import * as dataLayer from '@iblai/iblai-js/data-layer';
import * as utils from '@/features/utils';
import * as embedUtils from '../../utils';
import { toast } from 'sonner';

// Mock module factories - these are hoisted, so use vi.fn() directly
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useCreateRedirectTokenMutation: vi.fn(() => [vi.fn(), { isLoading: false, data: null }]),
  useEditMentorMutation: vi.fn(() => [vi.fn()]),
  useGetMentorPublicSettingsQuery: vi.fn(() => ({
    data: {
      allow_anonymous: false,
      mentor_visibility: 'public',
      custom_css: '',
      embed_show_attachment: true,
      embed_show_voice_call: true,
      embed_show_voice_record: true,
      mentor_unique_id: 'mentor-123',
    },
  })),
}));

vi.mock('@/features/auth/api-slice', () => ({
  useGetIntegratedSsoProvidersQuery: vi.fn(() => ({
    data: [],
    isError: false,
  })),
}));

vi.mock('next/navigation', () => ({
  useParams: vi.fn(() => ({ tenantKey: 'test-tenant', mentorId: 'test-mentor' })),
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: vi.fn(() => 'test-user'),
}));

vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: vi.fn(() => ({
    getMentorId: vi.fn(() => 'test-mentor'),
  })),
}));

vi.mock('@/features/utils', () => ({
  getUserName: vi.fn(),
}));

vi.mock('../../utils', () => ({
  getEmbedCode: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock('@/lib/config', () => ({
  config: {
    dmUrl: vi.fn(() => 'https://test.dm.url'),
  },
}));

vi.mock('@/lib/constants', () => ({
  ANONYMOUS_USERNAME: 'anonymous',
}));

describe('useEmbedTab', () => {
  let mockCreateRedirectTokenFn: ReturnType<typeof vi.fn>;
  let mockUpdateMentorSettingsFn: ReturnType<typeof vi.fn>;
  let mockGetUserName: ReturnType<typeof vi.fn>;
  let mockGetEmbedCode: ReturnType<typeof vi.fn>;
  let mockToastError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Get references to mocked functions
    mockGetUserName = vi.mocked(utils.getUserName);
    mockGetEmbedCode = vi.mocked(embedUtils.getEmbedCode);
    mockToastError = vi.mocked(toast.error);

    // Create fresh mock functions for mutations
    mockCreateRedirectTokenFn = vi.fn();
    mockUpdateMentorSettingsFn = vi.fn();

    // Setup data layer mocks
    vi.mocked(dataLayer.useCreateRedirectTokenMutation).mockReturnValue([
      mockCreateRedirectTokenFn,
      { isLoading: false, data: null } as any,
    ]);
    vi.mocked(dataLayer.useEditMentorMutation).mockReturnValue([mockUpdateMentorSettingsFn] as any);

    // Setup default mock return values
    mockGetUserName.mockReturnValue('test-user');
    mockGetEmbedCode.mockResolvedValue('<embed-code>');
  });

  describe('initialization', () => {
    it('should initialize with default values from mentorPublicSettings', () => {
      const { result } = renderHook(() => useEmbedTab());

      expect(result.current.form).toBeDefined();
      expect(result.current.createTokenHandler).toBeDefined();
      expect(result.current.syncEmbedSettings).toBeDefined();
      expect(result.current.updateConfig).toBeDefined();
      expect(result.current.updateMultipleConfig).toBeDefined();
      expect(result.current.handleFloatingBubbleImageError).toBeDefined();
    });

    it('should initialize custom floating bubble config with correct defaults', () => {
      const { result } = renderHook(() => useEmbedTab());

      expect(result.current.customFloatingBubbleConfig).toEqual({
        image: 'https://test.dm.url/api/core/orgs/test-tenant/thumbnail/',
        position: 'bottom-right',
        size: 'small',
        backgroundColor: 'transparent',
        textColor: '#ffffff',
        subtitleTextColor: '#e5e7eb',
        accentColor: '#1d4ed8',
        borderRadius: 16,
        shadow: false,
        title: '',
        subtitle: '',
        height: 48,
        fontSize: 14,
        subtitleFontSize: 12,
        padding: 12,
        imageSize: 32,
        strokeColor: '#000',
        strokeWidth: 0,
      });
    });
  });

  describe('syncEmbedSettings', () => {
    it('should successfully sync settings for anonymous mode', async () => {
      mockUpdateMentorSettingsFn.mockResolvedValueOnce({ data: { success: true } });

      const { result } = renderHook(() => useEmbedTab());

      // Set form values to anonymous mode
      await act(async () => {
        result.current.form.setFieldValue('allow_anonymous', true);
        result.current.form.setFieldValue('website_url', '');
      });

      let syncResult;
      await act(async () => {
        syncResult = await result.current.syncEmbedSettings();
      });

      expect(syncResult).toEqual({ success: true, redirectToken: undefined });
      expect(mockCreateRedirectTokenFn).not.toHaveBeenCalled();
      expect(mockUpdateMentorSettingsFn).toHaveBeenCalledWith(
        expect.objectContaining({
          mentor: 'test-mentor',
          org: 'test-tenant',
          userId: 'test-user',
        }),
      );
    });

    it('should successfully sync settings for non-anonymous mode with valid URL', async () => {
      mockCreateRedirectTokenFn.mockResolvedValueOnce({
        data: { token: 'redirect-token-123' },
      });
      mockUpdateMentorSettingsFn.mockResolvedValueOnce({ data: { success: true } });

      const { result } = renderHook(() => useEmbedTab());

      await act(async () => {
        result.current.form.setFieldValue('allow_anonymous', false);
        result.current.form.setFieldValue('website_url', 'https://example.com');
      });

      let syncResult;
      await act(async () => {
        syncResult = await result.current.syncEmbedSettings();
      });

      expect(syncResult).toEqual({ success: true, redirectToken: 'redirect-token-123' });
      expect(mockCreateRedirectTokenFn).toHaveBeenCalledWith({
        org: 'test-tenant',
        requestBody: {
          url: 'https://example.com',
          mentor_unique_id: 'mentor-123',
        },
      });
      expect(mockUpdateMentorSettingsFn).toHaveBeenCalled();
    });

    it('should fail validation when non-anonymous mode has no URL', async () => {
      const { result } = renderHook(() => useEmbedTab());

      await act(async () => {
        result.current.form.setFieldValue('allow_anonymous', false);
        result.current.form.setFieldValue('website_url', '');
      });

      let syncResult;
      await act(async () => {
        syncResult = await result.current.syncEmbedSettings();
      });

      expect(syncResult).toEqual({ success: false });
      expect(result.current.createTokenError).toBe('Please specify a valid Website URL');
      expect(mockCreateRedirectTokenFn).not.toHaveBeenCalled();
      expect(mockUpdateMentorSettingsFn).not.toHaveBeenCalled();
    });

    it('should fail validation when non-anonymous mode has invalid URL', async () => {
      const { result } = renderHook(() => useEmbedTab());

      await act(async () => {
        result.current.form.setFieldValue('allow_anonymous', false);
        result.current.form.setFieldValue('website_url', 'not-a-valid-url');
      });

      let syncResult;
      await act(async () => {
        syncResult = await result.current.syncEmbedSettings();
      });

      expect(syncResult).toEqual({ success: false });
      expect(result.current.createTokenError).toBe('Please specify a valid Website URL');
      expect(mockCreateRedirectTokenFn).not.toHaveBeenCalled();
      expect(mockUpdateMentorSettingsFn).not.toHaveBeenCalled();
    });

    it('should handle redirect token API error response', async () => {
      mockCreateRedirectTokenFn.mockResolvedValueOnce({
        error: {
          error: {
            url: ['Invalid URL provided'],
          },
        },
      });

      const { result } = renderHook(() => useEmbedTab());

      await act(async () => {
        result.current.form.setFieldValue('allow_anonymous', false);
        result.current.form.setFieldValue('website_url', 'https://example.com');
      });

      let syncResult;
      await act(async () => {
        syncResult = await result.current.syncEmbedSettings();
      });

      expect(syncResult).toEqual({ success: false });
      expect(result.current.createTokenError).toContain('Failed to create redirect token');
      expect(mockUpdateMentorSettingsFn).not.toHaveBeenCalled();
    });

    it('should handle redirect token exception', async () => {
      mockCreateRedirectTokenFn.mockRejectedValueOnce(new Error('Network error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useEmbedTab());

      await act(async () => {
        result.current.form.setFieldValue('allow_anonymous', false);
        result.current.form.setFieldValue('website_url', 'https://example.com');
      });

      let syncResult;
      await act(async () => {
        syncResult = await result.current.syncEmbedSettings();
      });

      expect(syncResult).toEqual({ success: false });
      expect(result.current.createTokenError).toContain(
        'Failed to create redirect token for website',
      );
      expect(mockUpdateMentorSettingsFn).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle settings update error', async () => {
      mockUpdateMentorSettingsFn.mockResolvedValueOnce({
        error: {
          error: {
            error: 'Failed to update settings',
          },
        },
      });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useEmbedTab());

      await act(async () => {
        result.current.form.setFieldValue('allow_anonymous', true);
      });

      let syncResult;
      await act(async () => {
        syncResult = await result.current.syncEmbedSettings();
      });

      expect(syncResult).toEqual({ success: false });
      expect(mockToastError).toHaveBeenCalledWith('Failed to update settings');

      consoleSpy.mockRestore();
    });

    it('should set is_context_aware=true when mode is advanced', async () => {
      mockUpdateMentorSettingsFn.mockResolvedValueOnce({ data: { success: true } });

      const { result } = renderHook(() => useEmbedTab());

      await act(async () => {
        result.current.form.setFieldValue('allow_anonymous', true);
        result.current.form.setFieldValue('mode', 'advanced');
      });

      await act(async () => {
        await result.current.syncEmbedSettings();
      });

      expect(mockUpdateMentorSettingsFn).toHaveBeenCalledWith(
        expect.objectContaining({
          formData: expect.objectContaining({
            is_context_aware: true,
            mode: 'advanced',
          }),
        }),
      );
    });
  });

  describe('createTokenHandler', () => {
    it('should create redirect token with valid URL', async () => {
      mockCreateRedirectTokenFn.mockResolvedValueOnce({
        data: { token: 'test-token' },
      });

      const { result } = renderHook(() => useEmbedTab());

      await act(async () => {
        result.current.form.setFieldValue('website_url', 'https://example.com');
      });

      await act(async () => {
        await result.current.createTokenHandler();
      });

      expect(mockCreateRedirectTokenFn).toHaveBeenCalledWith({
        org: 'test-tenant',
        requestBody: { url: 'https://example.com' },
      });
    });

    it('should set error for invalid URL', async () => {
      const { result } = renderHook(() => useEmbedTab());

      await act(async () => {
        result.current.form.setFieldValue('website_url', 'invalid-url');
      });

      await act(async () => {
        await result.current.createTokenHandler();
      });

      expect(result.current.createTokenError).toBe('A valid url is required!');
      expect(mockCreateRedirectTokenFn).not.toHaveBeenCalled();
    });

    it('should set error for empty URL', async () => {
      const { result } = renderHook(() => useEmbedTab());

      await act(async () => {
        result.current.form.setFieldValue('website_url', '');
      });

      await act(async () => {
        await result.current.createTokenHandler();
      });

      expect(result.current.createTokenError).toBe('A valid url is required!');
      expect(mockCreateRedirectTokenFn).not.toHaveBeenCalled();
    });

    it('should handle API error response', async () => {
      mockCreateRedirectTokenFn.mockResolvedValueOnce({
        error: {
          error: {
            url: ['URL already exists'],
          },
        },
      });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useEmbedTab());

      await act(async () => {
        result.current.form.setFieldValue('website_url', 'https://example.com');
      });

      await act(async () => {
        await result.current.createTokenHandler();
      });

      expect(result.current.createTokenError).toBe('URL already exists');

      consoleSpy.mockRestore();
    });

    it('should handle API exception', async () => {
      mockCreateRedirectTokenFn.mockRejectedValueOnce(new Error('Network error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useEmbedTab());

      await act(async () => {
        result.current.form.setFieldValue('website_url', 'https://example.com');
      });

      await act(async () => {
        await result.current.createTokenHandler();
      });

      expect(result.current.createTokenError).toContain(
        'Failed to create redirect token for website',
      );

      consoleSpy.mockRestore();
    });
  });

  describe('updateConfig', () => {
    it('should update a basic config key', () => {
      const { result } = renderHook(() => useEmbedTab());

      act(() => {
        result.current.updateConfig('title', 'New Title');
      });

      expect(result.current.customFloatingBubbleConfig.title).toBe('New Title');
    });

    it('should update size and related configs for small size', () => {
      const { result } = renderHook(() => useEmbedTab());

      act(() => {
        result.current.updateConfig('size', 'small');
      });

      expect(result.current.customFloatingBubbleConfig.size).toBe('small');
      expect(result.current.customFloatingBubbleConfig.height).toBe(48);
      expect(result.current.customFloatingBubbleConfig.fontSize).toBe(16);
    });

    it('should update size and related configs for medium size', () => {
      const { result } = renderHook(() => useEmbedTab());

      act(() => {
        result.current.updateConfig('size', 'medium');
      });

      expect(result.current.customFloatingBubbleConfig.size).toBe('medium');
      expect(result.current.customFloatingBubbleConfig.height).toBe(64);
      expect(result.current.customFloatingBubbleConfig.fontSize).toBe(18);
    });

    it('should update size and related configs for large size', () => {
      const { result } = renderHook(() => useEmbedTab());

      act(() => {
        result.current.updateConfig('size', 'large');
      });

      expect(result.current.customFloatingBubbleConfig.size).toBe('large');
      expect(result.current.customFloatingBubbleConfig.height).toBe(80);
      expect(result.current.customFloatingBubbleConfig.fontSize).toBe(22);
    });

    it('should update position config', () => {
      const { result } = renderHook(() => useEmbedTab());

      act(() => {
        result.current.updateConfig('position', 'top-left');
      });

      expect(result.current.customFloatingBubbleConfig.position).toBe('top-left');
    });
  });

  describe('updateMultipleConfig', () => {
    it('should update multiple config keys at once', () => {
      const { result } = renderHook(() => useEmbedTab());

      act(() => {
        result.current.updateMultipleConfig({
          title: 'Multi Title',
          subtitle: 'Multi Subtitle',
          backgroundColor: '#ff0000',
        });
      });

      expect(result.current.customFloatingBubbleConfig.title).toBe('Multi Title');
      expect(result.current.customFloatingBubbleConfig.subtitle).toBe('Multi Subtitle');
      expect(result.current.customFloatingBubbleConfig.backgroundColor).toBe('#ff0000');
    });

    it('should merge configs without overwriting unspecified keys', () => {
      const { result } = renderHook(() => useEmbedTab());

      const originalPosition = result.current.customFloatingBubbleConfig.position;

      act(() => {
        result.current.updateMultipleConfig({
          title: 'New Title',
        });
      });

      expect(result.current.customFloatingBubbleConfig.title).toBe('New Title');
      expect(result.current.customFloatingBubbleConfig.position).toBe(originalPosition);
    });
  });

  describe('handleFloatingBubbleImageError', () => {
    it('should set fallback image on error', () => {
      // Mock window.location.origin
      Object.defineProperty(window, 'location', {
        value: {
          origin: 'https://test.example.com',
        },
        writable: true,
      });

      const { result } = renderHook(() => useEmbedTab());

      act(() => {
        result.current.handleFloatingBubbleImageError();
      });

      expect(result.current.customFloatingBubbleConfig.image).toBe(
        'https://test.example.com/message-circle.svg',
      );
    });
  });

  describe('form onSubmit', () => {
    it('should delegate to syncEmbedSettings and generate embed code on success', async () => {
      mockUpdateMentorSettingsFn.mockResolvedValueOnce({ data: { success: true } });
      mockGetEmbedCode.mockResolvedValueOnce('<generated-embed-code>');

      const { result } = renderHook(() => useEmbedTab());

      await act(async () => {
        result.current.form.setFieldValue('allow_anonymous', true);
        result.current.form.setFieldValue('icon_selection', 'default');
      });

      await act(async () => {
        await result.current.form.handleSubmit();
      });

      await waitFor(() => {
        expect(mockUpdateMentorSettingsFn).toHaveBeenCalled();
        expect(mockGetEmbedCode).toHaveBeenCalledWith(
          'test-tenant',
          expect.any(Object),
          '',
          false,
          expect.any(Object),
        );
        expect(result.current.embedCode).toBe('<generated-embed-code>');
      });
    });

    it('should not generate embed code when syncEmbedSettings fails', async () => {
      mockUpdateMentorSettingsFn.mockResolvedValueOnce({
        error: { error: { error: 'Update failed' } },
      });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useEmbedTab());

      await act(async () => {
        result.current.form.setFieldValue('allow_anonymous', true);
      });

      await act(async () => {
        await result.current.form.handleSubmit();
      });

      await waitFor(() => {
        expect(mockUpdateMentorSettingsFn).toHaveBeenCalled();
        expect(mockGetEmbedCode).not.toHaveBeenCalled();
        expect(result.current.embedCode).toBe('');
      });

      consoleSpy.mockRestore();
    });

    it('should pass custom icon flag to getEmbedCode when icon_selection is custom', async () => {
      mockUpdateMentorSettingsFn.mockResolvedValueOnce({ data: { success: true } });
      mockGetEmbedCode.mockResolvedValueOnce('<custom-embed-code>');

      const { result } = renderHook(() => useEmbedTab());

      await act(async () => {
        result.current.form.setFieldValue('allow_anonymous', true);
        result.current.form.setFieldValue('icon_selection', 'custom');
      });

      await act(async () => {
        await result.current.form.handleSubmit();
      });

      await waitFor(() => {
        expect(mockGetEmbedCode).toHaveBeenCalledWith(
          'test-tenant',
          expect.any(Object),
          '',
          true,
          expect.any(Object),
        );
      });
    });
  });

  describe('setCreateTokenError', () => {
    it('should allow setting and clearing token error', () => {
      const { result } = renderHook(() => useEmbedTab());

      act(() => {
        result.current.setCreateTokenError('Test error');
      });

      expect(result.current.createTokenError).toBe('Test error');

      act(() => {
        result.current.setCreateTokenError('');
      });

      expect(result.current.createTokenError).toBe('');
    });
  });

  describe('embedCode state', () => {
    it('should allow setting embed code', () => {
      const { result } = renderHook(() => useEmbedTab());

      act(() => {
        result.current.setEmbedCode('<test-embed-code>');
      });

      expect(result.current.embedCode).toBe('<test-embed-code>');
    });
  });

  describe('focusEditCustomFloatingBubble state', () => {
    it('should initialize as false and allow toggling', () => {
      const { result } = renderHook(() => useEmbedTab());

      expect(result.current.focusEditCustomFloatingBubble).toBe(false);

      act(() => {
        result.current.setFocusEditCustomFloatingBubble(true);
      });

      expect(result.current.focusEditCustomFloatingBubble).toBe(true);
    });
  });
});
