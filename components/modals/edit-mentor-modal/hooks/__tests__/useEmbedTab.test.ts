import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import useEmbedTab from '../useEmbedTab';
import * as dataLayer from '@iblai/iblai-js/data-layer';
import * as utils from '@/features/utils';
import * as embedUtils from '../../utils';
import { toast } from 'sonner';

// Mock module factories - these are hoisted, so use vi.fn() directly
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useCreateRedirectTokenMutation: vi.fn(() => [
    vi.fn(),
    { isLoading: false, data: null },
  ]),
  useEditMentorMutation: vi.fn(() => [vi.fn()]),
  useGetMentorPublicSettingsQuery: vi.fn(() => ({
    data: {
      allow_anonymous: false,
      mentor_visibility: 'public',
      custom_css: '',
      embed_show_attachment: true,
      embed_show_voice_call: true,
      embed_show_voice_record: true,
      show_catalogue: true,
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
  useParams: vi.fn(() => ({
    tenantKey: 'test-tenant',
    mentorId: 'test-mentor',
  })),
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

vi.mock('../../utils', async () => {
  // Keep the real pure helpers (isDataUrl, dataUrlToFile, build* serializers)
  // so the save/load wiring exercises actual round-trip behavior; only stub the
  // async `getEmbedCode` snippet builder.
  const actual =
    await vi.importActual<typeof import('../../utils')>('../../utils');
  return {
    ...actual,
    getEmbedCode: vi.fn(),
  };
});

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
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
  let mockToastSuccess: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Get references to mocked functions
    mockGetUserName = vi.mocked(utils.getUserName);
    mockGetEmbedCode = vi.mocked(embedUtils.getEmbedCode);
    mockToastError = vi.mocked(toast.error);
    mockToastSuccess = vi.mocked(toast.success);

    // Create fresh mock functions for mutations
    mockCreateRedirectTokenFn = vi.fn();
    mockUpdateMentorSettingsFn = vi.fn();

    // Setup data layer mocks
    vi.mocked(dataLayer.useCreateRedirectTokenMutation).mockReturnValue([
      mockCreateRedirectTokenFn,
      { isLoading: false, data: null } as any,
    ]);
    vi.mocked(dataLayer.useEditMentorMutation).mockReturnValue([
      mockUpdateMentorSettingsFn,
    ] as any);

    // Setup default mock return values
    mockGetUserName.mockReturnValue('test-user');
    mockGetEmbedCode.mockResolvedValue('<embed-code>');

    // Reset the public-settings query to its default shape so a per-test
    // `mockReturnValue` override (used by the hydration tests) doesn't leak into
    // subsequent tests — `vi.clearAllMocks` clears call history but not the
    // implementation set via `mockReturnValue`.
    vi.mocked(dataLayer.useGetMentorPublicSettingsQuery).mockReturnValue({
      data: {
        allow_anonymous: false,
        mentor_visibility: 'public',
        custom_css: '',
        embed_show_attachment: true,
        embed_show_voice_call: true,
        embed_show_voice_record: true,
        show_catalogue: true,
        mentor_unique_id: 'mentor-123',
      },
    } as any);
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

    it('should hydrate show_catalogue from mentorPublicSettings', () => {
      const { result } = renderHook(() => useEmbedTab());

      expect(result.current.form.getFieldValue('show_catalogue')).toBe(true);
    });

    it('should default show_catalogue to true when mentorPublicSettings is undefined', () => {
      vi.mocked(dataLayer.useGetMentorPublicSettingsQuery).mockReturnValueOnce({
        data: undefined,
      } as any);

      const { result } = renderHook(() => useEmbedTab());

      expect(result.current.form.getFieldValue('show_catalogue')).toBe(true);
    });

    it('should default show_catalogue to true when field is missing from mentorPublicSettings', () => {
      vi.mocked(dataLayer.useGetMentorPublicSettingsQuery).mockReturnValueOnce({
        data: {
          allow_anonymous: false,
          mentor_visibility: 'public',
          custom_css: '',
          embed_show_attachment: true,
          embed_show_voice_call: true,
          embed_show_voice_record: true,
          mentor_unique_id: 'mentor-123',
        },
      } as any);

      const { result } = renderHook(() => useEmbedTab());

      expect(result.current.form.getFieldValue('show_catalogue')).toBe(true);
    });

    it('initializes icon_selection to "custom" when embed_icon_selection_data exists', () => {
      // Regression for #789: the mode must hydrate from the form's reactive
      // defaultValues (existence of the persisted JSON map), NOT from an
      // imperative setFieldValue that the reactive re-init would clobber.
      vi.mocked(dataLayer.useGetMentorPublicSettingsQuery).mockReturnValue({
        data: {
          mentor_unique_id: 'mentor-123',
          embed_icon_selection_data: { title: 'Persisted' },
        },
      } as any);

      const { result } = renderHook(() => useEmbedTab());

      expect(result.current.form.getFieldValue('icon_selection')).toBe(
        'custom',
      );
    });

    it('initializes icon_selection to "default" when embed_icon_selection_data is an empty object (cleared state)', () => {
      // The backend clears the field by storing `{}` (verified live). An empty
      // object has no own keys, so the mode must derive to 'default'.
      vi.mocked(dataLayer.useGetMentorPublicSettingsQuery).mockReturnValue({
        data: {
          mentor_unique_id: 'mentor-123',
          embed_icon_selection_data: {},
        },
      } as any);

      const { result } = renderHook(() => useEmbedTab());

      expect(result.current.form.getFieldValue('icon_selection')).toBe(
        'default',
      );
    });

    it('initializes icon_selection to "default" for an empty object even when a stale embed_custom_image lingers', () => {
      // A leftover image URL after switching to default must NOT force 'custom';
      // the mode depends ONLY on the (empty) JSON map.
      vi.mocked(dataLayer.useGetMentorPublicSettingsQuery).mockReturnValue({
        data: {
          mentor_unique_id: 'mentor-123',
          embed_icon_selection_data: {},
          embed_custom_image: 'https://cdn.example.com/stale-icon.png',
        },
      } as any);

      const { result } = renderHook(() => useEmbedTab());

      expect(result.current.form.getFieldValue('icon_selection')).toBe(
        'default',
      );
    });

    it('initializes icon_selection to "default" when embed_icon_selection_data is an empty string', () => {
      vi.mocked(dataLayer.useGetMentorPublicSettingsQuery).mockReturnValue({
        data: {
          mentor_unique_id: 'mentor-123',
          embed_icon_selection_data: '',
        },
      } as any);

      const { result } = renderHook(() => useEmbedTab());

      expect(result.current.form.getFieldValue('icon_selection')).toBe(
        'default',
      );
    });

    it('initializes icon_selection to "default" when embed_icon_selection_data is absent', () => {
      vi.mocked(dataLayer.useGetMentorPublicSettingsQuery).mockReturnValue({
        data: {
          mentor_unique_id: 'mentor-123',
        },
      } as any);

      const { result } = renderHook(() => useEmbedTab());

      expect(result.current.form.getFieldValue('icon_selection')).toBe(
        'default',
      );
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
      mockUpdateMentorSettingsFn.mockResolvedValueOnce({
        data: { success: true },
      });

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
      mockUpdateMentorSettingsFn.mockResolvedValueOnce({
        data: { success: true },
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

      expect(syncResult).toEqual({
        success: true,
        redirectToken: 'redirect-token-123',
      });
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
      expect(result.current.createTokenError).toBe(
        'Please specify a valid Website URL',
      );
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
      expect(result.current.createTokenError).toBe(
        'Please specify a valid Website URL',
      );
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
      expect(result.current.createTokenError).toContain(
        'Failed to create redirect token',
      );
      expect(mockUpdateMentorSettingsFn).not.toHaveBeenCalled();
    });

    it('should handle redirect token exception', async () => {
      mockCreateRedirectTokenFn.mockRejectedValueOnce(
        new Error('Network error'),
      );
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

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
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

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

    it('should pass show_catalogue through to updateMentorSettings payload', async () => {
      mockUpdateMentorSettingsFn.mockResolvedValueOnce({
        data: { success: true },
      });

      const { result } = renderHook(() => useEmbedTab());

      await act(async () => {
        result.current.form.setFieldValue('allow_anonymous', true);
        result.current.form.setFieldValue('show_catalogue', true);
      });

      await act(async () => {
        await result.current.syncEmbedSettings();
      });

      expect(mockUpdateMentorSettingsFn).toHaveBeenCalledWith(
        expect.objectContaining({
          formData: expect.objectContaining({
            show_catalogue: true,
          }),
        }),
      );
    });

    it('should set is_context_aware=true when mode is advanced', async () => {
      mockUpdateMentorSettingsFn.mockResolvedValueOnce({
        data: { success: true },
      });

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

  describe('handleSaveSettings', () => {
    it('persists settings via updateMentorSettings and shows a success toast without creating a token or embed code', async () => {
      mockUpdateMentorSettingsFn.mockResolvedValueOnce({
        data: { success: true },
      });

      const { result } = renderHook(() => useEmbedTab());

      // No URL / not anonymous: save must NOT validate the website URL.
      await act(async () => {
        result.current.form.setFieldValue('allow_anonymous', false);
        result.current.form.setFieldValue('website_url', '');
        result.current.form.setFieldValue('show_catalogue', true);
      });

      await act(async () => {
        await result.current.handleSaveSettings();
      });

      expect(mockUpdateMentorSettingsFn).toHaveBeenCalledWith(
        expect.objectContaining({
          mentor: 'test-mentor',
          org: 'test-tenant',
          userId: 'test-user',
          formData: expect.objectContaining({ show_catalogue: true }),
        }),
      );
      expect(mockToastSuccess).toHaveBeenCalledWith('Settings saved');
      // No URL validation error was set despite the empty website_url.
      expect(result.current.createTokenError).toBe('');
      // Save must not create a redirect token, generate embed code, or open the
      // embed dialog.
      expect(mockCreateRedirectTokenFn).not.toHaveBeenCalled();
      expect(mockGetEmbedCode).not.toHaveBeenCalled();
      expect(result.current.embedCode).toBe('');
    });

    it('does not show the success toast and surfaces an error toast on failure', async () => {
      mockUpdateMentorSettingsFn.mockResolvedValueOnce({
        error: { error: { error: 'Save failed' } },
      });
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const { result } = renderHook(() => useEmbedTab());

      await act(async () => {
        await result.current.handleSaveSettings();
      });

      expect(mockToastError).toHaveBeenCalledWith('Save failed');
      expect(mockToastSuccess).not.toHaveBeenCalled();
      expect(mockCreateRedirectTokenFn).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('toggles isSavingSettings around the save call', async () => {
      let resolveSave: (v: unknown) => void = () => {};
      mockUpdateMentorSettingsFn.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveSave = resolve;
        }),
      );

      const { result } = renderHook(() => useEmbedTab());

      expect(result.current.isSavingSettings).toBe(false);

      let savePromise: Promise<void>;
      act(() => {
        savePromise = result.current.handleSaveSettings();
      });

      await waitFor(() => {
        expect(result.current.isSavingSettings).toBe(true);
      });

      await act(async () => {
        resolveSave({ data: { success: true } });
        await savePromise;
      });

      expect(result.current.isSavingSettings).toBe(false);
    });
  });

  describe('custom launcher icon persistence', () => {
    // 1x1 transparent PNG data URL used as a freshly-uploaded image preview.
    const dataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

    it('in custom mode sends embed_icon_selection_data (object) without an icon_selection key', async () => {
      mockUpdateMentorSettingsFn.mockResolvedValueOnce({
        data: { success: true },
      });

      const { result } = renderHook(() => useEmbedTab());

      await act(async () => {
        result.current.form.setFieldValue('allow_anonymous', true);
        result.current.form.setFieldValue('icon_selection', 'custom');
        result.current.updateMultipleConfig({
          title: 'Ask me',
          subtitle: 'How can I help?',
          backgroundColor: '#ff0000',
        });
      });

      await act(async () => {
        await result.current.syncEmbedSettings();
      });

      const payload = mockUpdateMentorSettingsFn.mock.calls[0][0];
      expect(payload.formData.embed_icon_selection_data).toEqual(
        expect.objectContaining({
          title: 'Ask me',
          subtitle: 'How can I help?',
          backgroundColor: '#ff0000',
          position: 'bottom-right',
        }),
      );
      // Mode is derived from existence, so the JSON must NOT carry the key.
      expect(payload.formData.embed_icon_selection_data).not.toHaveProperty(
        'icon_selection',
      );
      // The raw image binary must NOT be embedded in the JSON map.
      expect(payload.formData.embed_icon_selection_data).not.toHaveProperty(
        'image',
      );
    });

    it('in default mode clears embed_icon_selection_data with an empty JSON object and sends no image', async () => {
      mockUpdateMentorSettingsFn.mockResolvedValueOnce({
        data: { success: true },
      });

      const { result } = renderHook(() => useEmbedTab());

      await act(async () => {
        result.current.form.setFieldValue('allow_anonymous', true);
        result.current.form.setFieldValue('icon_selection', 'default');
        // Even if a data-URL image lingers in config, default mode must not
        // upload it.
        result.current.updateMultipleConfig({ image: dataUrl });
      });

      await act(async () => {
        await result.current.syncEmbedSettings();
      });

      const payload = mockUpdateMentorSettingsFn.mock.calls[0][0];
      // The empty JSON object `{}` is the verified clearing value: live testing
      // showed `''` is rejected (HTTP 400) and JSON null is silently ignored by
      // DRF's partial update, while `{}` actually sets the field to `{}`. We
      // pass a plain object literal; the SDK's getFormData JSON-stringifies it
      // to the string "{}". On reload, `{}` has no own keys so the mode derives
      // back to 'default'.
      expect(payload.formData.embed_icon_selection_data).toEqual({});
      expect(payload.formData).not.toHaveProperty('embed_custom_image');
    });

    it('converts a newly-uploaded data URL image into a File for embed_custom_image', async () => {
      mockUpdateMentorSettingsFn.mockResolvedValueOnce({
        data: { success: true },
      });

      const { result } = renderHook(() => useEmbedTab());

      await act(async () => {
        result.current.form.setFieldValue('allow_anonymous', true);
        result.current.form.setFieldValue('icon_selection', 'custom');
        result.current.updateMultipleConfig({ image: dataUrl });
      });

      await act(async () => {
        await result.current.syncEmbedSettings();
      });

      const payload = mockUpdateMentorSettingsFn.mock.calls[0][0];
      expect(payload.formData.embed_custom_image).toBeInstanceOf(File);
      expect(payload.formData.embed_custom_image.type).toBe('image/png');
    });

    it('omits embed_custom_image when the image is an unchanged resolved URL', async () => {
      mockUpdateMentorSettingsFn.mockResolvedValueOnce({
        data: { success: true },
      });

      const { result } = renderHook(() => useEmbedTab());

      await act(async () => {
        result.current.form.setFieldValue('allow_anonymous', true);
        result.current.form.setFieldValue('icon_selection', 'custom');
        // Default image is a resolved thumbnail URL, not a data URL.
      });

      await act(async () => {
        await result.current.syncEmbedSettings();
      });

      const payload = mockUpdateMentorSettingsFn.mock.calls[0][0];
      expect(payload.formData).not.toHaveProperty('embed_custom_image');
    });

    it('omits embed_custom_image when the image was removed (null)', async () => {
      mockUpdateMentorSettingsFn.mockResolvedValueOnce({
        data: { success: true },
      });

      const { result } = renderHook(() => useEmbedTab());

      await act(async () => {
        result.current.form.setFieldValue('allow_anonymous', true);
        result.current.form.setFieldValue('icon_selection', 'custom');
        result.current.updateMultipleConfig({ image: null });
      });

      await act(async () => {
        await result.current.syncEmbedSettings();
      });

      const payload = mockUpdateMentorSettingsFn.mock.calls[0][0];
      expect(payload.formData).not.toHaveProperty('embed_custom_image');
    });

    it('hydrates customFloatingBubbleConfig + icon_selection from persisted settings', () => {
      vi.mocked(dataLayer.useGetMentorPublicSettingsQuery).mockReturnValue({
        data: {
          allow_anonymous: false,
          mentor_visibility: 'public',
          custom_css: '',
          embed_show_attachment: true,
          embed_show_voice_call: true,
          embed_show_voice_record: true,
          show_catalogue: true,
          mentor_unique_id: 'mentor-123',
          embed_icon_selection_data: {
            icon_selection: 'custom',
            title: 'Persisted Title',
            backgroundColor: '#abcdef',
            position: 'top-left',
          },
          embed_custom_image: 'https://cdn.example.com/saved-icon.png',
        },
      } as any);

      const { result } = renderHook(() => useEmbedTab());

      expect(result.current.form.getFieldValue('icon_selection')).toBe(
        'custom',
      );
      expect(result.current.customFloatingBubbleConfig.title).toBe(
        'Persisted Title',
      );
      expect(result.current.customFloatingBubbleConfig.backgroundColor).toBe(
        '#abcdef',
      );
      expect(result.current.customFloatingBubbleConfig.position).toBe(
        'top-left',
      );
      expect(result.current.customFloatingBubbleConfig.image).toBe(
        'https://cdn.example.com/saved-icon.png',
      );
    });

    it('hydrates using mentorId as the settings key when mentor_unique_id is absent', () => {
      vi.mocked(dataLayer.useGetMentorPublicSettingsQuery).mockReturnValue({
        data: {
          // no mentor_unique_id -> settings key falls back to mentorId
          embed_icon_selection_data: {
            icon_selection: 'custom',
            title: 'Keyed By MentorId',
          },
          embed_custom_image: 'https://cdn.example.com/keyed.png',
        },
      } as any);

      const { result } = renderHook(() => useEmbedTab());

      expect(result.current.customFloatingBubbleConfig.title).toBe(
        'Keyed By MentorId',
      );
      expect(result.current.form.getFieldValue('icon_selection')).toBe(
        'custom',
      );
    });

    it('derives icon_selection "custom" from a JSON map even without a stored key', () => {
      vi.mocked(dataLayer.useGetMentorPublicSettingsQuery).mockReturnValue({
        data: {
          mentor_unique_id: 'mentor-123',
          // No icon_selection key — mode is derived purely from existence.
          embed_icon_selection_data: { title: 'No Selection' },
          embed_custom_image: 'https://cdn.example.com/x.png',
        },
      } as any);

      const { result } = renderHook(() => useEmbedTab());

      expect(result.current.customFloatingBubbleConfig.title).toBe(
        'No Selection',
      );
      // The JSON map exists, so the mode derives to 'custom'.
      expect(result.current.form.getFieldValue('icon_selection')).toBe(
        'custom',
      );
    });

    it('derives icon_selection "default" when the JSON is cleared (empty string) even if a stale image lingers', () => {
      vi.mocked(dataLayer.useGetMentorPublicSettingsQuery).mockReturnValue({
        data: {
          mentor_unique_id: 'mentor-123',
          embed_icon_selection_data: '',
          embed_custom_image: 'https://cdn.example.com/stale.png',
        },
      } as any);

      const { result } = renderHook(() => useEmbedTab());

      // No JSON map (empty string) => default, regardless of the lingering image.
      expect(result.current.form.getFieldValue('icon_selection')).toBe(
        'default',
      );
    });

    it('does not hydrate when there is no persisted icon data or image', () => {
      // The default public-settings mock has neither field.
      const { result } = renderHook(() => useEmbedTab());

      expect(result.current.form.getFieldValue('icon_selection')).toBe(
        'default',
      );
      expect(result.current.customFloatingBubbleConfig.title).toBe('');
    });

    it('does not clobber in-progress edits on re-render once already hydrated', () => {
      vi.mocked(dataLayer.useGetMentorPublicSettingsQuery).mockReturnValue({
        data: {
          mentor_unique_id: 'mentor-123',
          embed_icon_selection_data: {
            icon_selection: 'custom',
            title: 'Persisted Title',
          },
          embed_custom_image: 'https://cdn.example.com/saved-icon.png',
        },
      } as any);

      const { result, rerender } = renderHook(() => useEmbedTab());

      // User edits after initial hydration.
      act(() => {
        result.current.updateMultipleConfig({ title: 'User Edit' });
      });
      expect(result.current.customFloatingBubbleConfig.title).toBe('User Edit');

      // A re-render with the same settings identity must NOT re-hydrate.
      rerender();
      expect(result.current.customFloatingBubbleConfig.title).toBe('User Edit');
    });

    it('round-trips: a saved icon hydrates back on a fresh mount', async () => {
      mockUpdateMentorSettingsFn.mockResolvedValueOnce({
        data: { success: true },
      });

      // First mount: user uploads + saves.
      const first = renderHook(() => useEmbedTab());
      await act(async () => {
        first.result.current.form.setFieldValue('allow_anonymous', true);
        first.result.current.form.setFieldValue('icon_selection', 'custom');
        first.result.current.updateMultipleConfig({
          image: dataUrl,
          title: 'RoundTrip',
        });
      });
      await act(async () => {
        await first.result.current.syncEmbedSettings();
      });

      const savedPayload = mockUpdateMentorSettingsFn.mock.calls[0][0].formData;
      first.unmount();

      // Simulate the backend persisting the data and returning it (the image
      // becomes a resolved URL after upload).
      vi.mocked(dataLayer.useGetMentorPublicSettingsQuery).mockReturnValue({
        data: {
          mentor_unique_id: 'mentor-123',
          embed_icon_selection_data: savedPayload.embed_icon_selection_data,
          embed_custom_image: 'https://cdn.example.com/round-trip.png',
        },
      } as any);

      // Second mount: the icon persists.
      const second = renderHook(() => useEmbedTab());
      expect(second.result.current.form.getFieldValue('icon_selection')).toBe(
        'custom',
      );
      expect(second.result.current.customFloatingBubbleConfig.title).toBe(
        'RoundTrip',
      );
      expect(second.result.current.customFloatingBubbleConfig.image).toBe(
        'https://cdn.example.com/round-trip.png',
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
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

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
      mockCreateRedirectTokenFn.mockRejectedValueOnce(
        new Error('Network error'),
      );
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

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

      expect(result.current.customFloatingBubbleConfig.position).toBe(
        'top-left',
      );
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

      expect(result.current.customFloatingBubbleConfig.title).toBe(
        'Multi Title',
      );
      expect(result.current.customFloatingBubbleConfig.subtitle).toBe(
        'Multi Subtitle',
      );
      expect(result.current.customFloatingBubbleConfig.backgroundColor).toBe(
        '#ff0000',
      );
    });

    it('should merge configs without overwriting unspecified keys', () => {
      const { result } = renderHook(() => useEmbedTab());

      const originalPosition =
        result.current.customFloatingBubbleConfig.position;

      act(() => {
        result.current.updateMultipleConfig({
          title: 'New Title',
        });
      });

      expect(result.current.customFloatingBubbleConfig.title).toBe('New Title');
      expect(result.current.customFloatingBubbleConfig.position).toBe(
        originalPosition,
      );
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
      mockUpdateMentorSettingsFn.mockResolvedValueOnce({
        data: { success: true },
      });
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
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

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
      mockUpdateMentorSettingsFn.mockResolvedValueOnce({
        data: { success: true },
      });
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
