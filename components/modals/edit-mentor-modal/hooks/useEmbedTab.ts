'use client';

import { useGetIntegratedSsoProvidersQuery } from '@/features/auth/api-slice';
import { getUserName } from '@/features/utils';
import {
  useCreateRedirectTokenMutation,
  useEditMentorMutation,
  useGetMentorPublicSettingsQuery,
} from '@iblai/iblai-js/data-layer';
import { useForm } from '@tanstack/react-form';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { z } from 'zod';
import {
  buildEmbedIconSelectionData,
  buildFloatingBubbleConfigFromSettings,
  dataUrlToFile,
  getEmbedCode,
  hasCustomIconData,
  isDataUrl,
} from '../utils';
import { toast } from 'sonner';
import type { ChatMode } from '@iblai/iblai-js/web-utils';
import { useNavigate } from '@/hooks/user-navigate';
import { config } from '@/lib/config';
import { useUsername } from '@/hooks/use-user';
import { ANONYMOUS_USERNAME } from '@/lib/constants';

export interface EmbedFormValues {
  custom_css: string;
  description: string;
  website_url: string;
  mode: ChatMode;
  allow_anonymous: boolean;
  mentor_visibility: string | null;
  is_context_aware: boolean;
  safety_disclaimer: boolean;
  sso: boolean;
  auto_open: boolean;
  sso_provider: string;
  slug: string;
  metadata: {
    primary_color: string;
    secondary_color: string;
    safety_disclaimer: boolean;
  };
  icon_selection: string;
  embed_show_attachment: boolean;
  embed_show_voice_call: boolean;
  embed_show_voice_record: boolean;
  show_catalogue: boolean;
  starter_prompts: 'guided_prompt' | 'suggested_prompt';
}

export interface CustomFloatingBubbleConfig {
  image: string;
  //use_icon: boolean;
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  //offsetX: number;
  //offsetY: number;
  size: 'small' | 'medium' | 'large';
  backgroundColor: string;
  textColor: string;
  subtitleTextColor: string;
  accentColor: string;
  borderRadius: number;
  shadow: boolean;
  title: string;
  subtitle: string;
  height: number;
  padding: number;
  imageSize: number;
  fontSize: number;
  subtitleFontSize: number;
  strokeColor: string;
  strokeWidth: number;
  //autoOpen: boolean;
  //openDelay: number;
  //showOnPages: string[];
  //hideOnMobile: boolean;
  //animation: "bounce" | "fade" | "slide" | "none";
  //animationDuration: number;
}

const defaultEmbedFormValues: EmbedFormValues = {
  custom_css: '',
  description: '',
  website_url: '',
  mode: 'default',
  allow_anonymous: false,
  mentor_visibility: null,
  is_context_aware: false,
  safety_disclaimer: false,
  sso: false,
  auto_open: false,
  sso_provider: '',
  metadata: {
    primary_color: '#2467eb',
    secondary_color: '#000',
    safety_disclaimer: false,
  },
  slug: '',
  icon_selection: 'default',
  embed_show_attachment: true,
  embed_show_voice_call: true,
  embed_show_voice_record: true,
  show_catalogue: true,
  starter_prompts: 'guided_prompt',
};

const useEmbedTab = () => {
  const [embedCode, setEmbedCode] = useState('');
  const { getMentorId } = useNavigate();
  const username = useUsername();
  const params = useParams<{ tenantKey: string; mentorId: string }>();
  const tenantKey = params?.tenantKey;
  const mentorId = getMentorId() ?? params.mentorId;
  const { data: mentorPublicSettings } = useGetMentorPublicSettingsQuery({
    mentor: mentorId,
    org: params.tenantKey,
    // @ts-ignore
    userId: username ?? ANONYMOUS_USERNAME,
  });
  const [
    createRedirectToken,
    { isLoading: isCreateTokenLoading, data: redirectTokenData },
  ] = useCreateRedirectTokenMutation();
  const [updateMentorSettings] = useEditMentorMutation();
  const defaultFloatingBubbleConfig: CustomFloatingBubbleConfig = {
    image: `${config.dmUrl()}/api/core/orgs/${params.tenantKey}/thumbnail/`,
    //use_icon: false,
    position: 'bottom-right',
    //offsetX: 20,
    //offsetY: 20,
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
  };
  const [customFloatingBubbleConfig, setCustomFloatingBubbleConfig] =
    useState<CustomFloatingBubbleConfig>(defaultFloatingBubbleConfig);

  const updateConfig = (
    key: keyof typeof customFloatingBubbleConfig,
    value: any,
  ) => {
    let additionalConfig = {};
    if (key === 'size') {
      additionalConfig = {
        height: value === 'small' ? 48 : value === 'medium' ? 64 : 80,
        fontSize: value === 'small' ? 16 : value === 'medium' ? 18 : 22,
      };
    }
    setCustomFloatingBubbleConfig((prev) => ({
      ...prev,
      [key]: value,
      ...additionalConfig,
    }));
  };

  const updateMultipleConfig = (config: Record<string, any>) => {
    setCustomFloatingBubbleConfig((prev) => ({ ...prev, ...config }));
  };

  const handleFloatingBubbleImageError = () => {
    setCustomFloatingBubbleConfig({
      ...customFloatingBubbleConfig,
      image: `${window.location.origin}/message-circle.svg`,
    });
  };

  // Persist the mentor settings (the multipart PUT). Extracted from
  // `syncEmbedSettings` so the Save button can reuse it WITHOUT the
  // website-URL validation, redirect-token creation, embed-code generation, or
  // embed-code dialog. The payload is identical to what Create Embed sends, so
  // the icon persistence (custom JSON + image, and the `{}` clear for default
  // mode) behaves the same regardless of which button triggered it.
  const saveMentorSettings = async (): Promise<{ success: boolean }> => {
    const value = form.state.values;

    // Set is_context_aware for advanced mode
    const formValues = { ...value };
    if (formValues.mode === 'advanced') {
      formValues.is_context_aware = true;
    }

    // Update mentor settings
    const valid_values = Object.fromEntries(
      Object.entries(formValues).filter(
        ([key, value]) => value !== '' || key === 'custom_css',
      ),
    );

    // Persist the custom launcher icon config so it survives a page refresh.
    // The custom-vs-default mode is derived from whether
    // `embed_icon_selection_data` is a NON-EMPTY object (see `hasCustomIconData`
    // / `buildFloatingBubbleConfigFromSettings`), so:
    // - custom mode: persist the JSON map (bubble config minus the raw image
    //   binary) plus the image. The request helper JSON-stringifies objects
    //   automatically, so we pass a plain object.
    // - default mode: CLEAR the stored JSON by persisting an empty JSON object
    //   `{}` so a non-empty map unambiguously means custom and an empty map
    //   means default on the next reload.
    //
    // Clearing nuance — verified LIVE against the real API for this multipart
    // PUT field. `getFormData` JSON-stringifies a passed object, so the literal
    // `{}` below is sent as the string `"{}"`. The three candidate clear values
    // behave as:
    //   - `''`   (empty string)        -> HTTP 400 ("Value must be valid JSON").
    //   - `'null'` (JSON null, the old `JSON.stringify(null)` approach) -> HTTP
    //     200 but the field is NOT changed: DRF's partial-update silently
    //     ignores JSON null, so the old custom JSON persists. THIS WAS THE BUG.
    //   - `'{}'`  (empty JSON object)  -> HTTP 200 and the field IS set to `{}`.
    // Only `{}` actually clears, so default mode sends an empty object literal.
    // On hydrate, `{}` has no own keys, so `hasCustomIconData` is false and the
    // mode correctly derives back to 'default'.
    const isCustomIcon = formValues.icon_selection === 'custom';
    const embed_icon_selection_data: Record<string, unknown> = isCustomIcon
      ? buildEmbedIconSelectionData(customFloatingBubbleConfig)
      : {};

    // - `embed_custom_image`: when the user just uploaded an image it lives in
    //   state as a base64 data URL — convert it to a real File so it is sent as
    //   multipart binary. When it is already a resolved URL (unchanged image)
    //   we omit it so the previously-saved image isn't clobbered. In default
    //   mode we never send an image.
    const imageValue = customFloatingBubbleConfig.image;
    let embed_custom_image: File | undefined;
    if (isCustomIcon && isDataUrl(imageValue)) {
      embed_custom_image = dataUrlToFile(imageValue) ?? undefined;
    }

    const response = await updateMentorSettings({
      mentor: mentorId,
      org: params.tenantKey,
      // @ts-expect-error - userId is required by the API but not reflected in the type definition
      userId: getUserName(),
      // `embed_custom_image` is typed as `string` in the SDK request model, but
      // the endpoint is multipart and the request helper appends a File/Blob as
      // binary, so we send a File for new uploads via a narrow cast.
      formData: {
        ...valid_values,
        metadata: { safety_disclaimer: valid_values.safety_disclaimer },
        embed_icon_selection_data,
        // Only include the image key when we have a new File to upload so an
        // unchanged (already-persisted) image is left untouched by the backend.
        ...(embed_custom_image
          ? { embed_custom_image: embed_custom_image as unknown as string }
          : {}),
      },
    });
    if (response?.error) {
      console.error(
        `Failed to update mentor settings for mentor (${mentorId}) in org (${params.tenantKey})`,
        response.error,
      );
      const errorMessage =
        (response.error as any)?.error?.error ??
        'An Unknown error occurred. Please try again';
      setCreateTokenError(errorMessage);
      toast.error(errorMessage);
      return { success: false };
    }

    return { success: true };
  };

  const syncEmbedSettings = async (): Promise<{
    success: boolean;
    redirectToken?: string;
  }> => {
    const value = form.state.values;

    // Validate website URL if not anonymous
    if (
      !value.allow_anonymous &&
      (!value.website_url ||
        !z.string().url().safeParse(value.website_url).success)
    ) {
      setCreateTokenError('Please specify a valid Website URL');
      return { success: false };
    }

    let redirectTokenResponse: { data?: { token?: string } } | null = null;

    // Create redirect token if not anonymous
    if (!value.allow_anonymous) {
      try {
        const response = await createRedirectToken({
          org: params.tenantKey,
          requestBody: {
            url: value.website_url,
            mentor_unique_id: mentorPublicSettings?.mentor_unique_id,
          },
        });
        if (response.error) {
          const errorObj = response.error as any;
          const errorMessage =
            errorObj?.error?.url?.[0] ?? 'Unknown error occurred';
          throw new Error(errorMessage);
        }
        redirectTokenResponse = response;
      } catch (error) {
        console.error(
          `Failed to create redirect token for website (${value.website_url}) in org (${params.tenantKey})`,
          error,
        );
        setCreateTokenError(
          `Failed to create redirect token for website (${value.website_url}) in org (${params.tenantKey})`,
        );
        console.error(JSON.stringify({ tenant: tenantKey, error }));
        return { success: false };
      }
    }

    const saveResult = await saveMentorSettings();
    if (!saveResult.success) {
      return { success: false };
    }

    return { success: true, redirectToken: redirectTokenResponse?.data?.token };
  };

  const form = useForm({
    defaultValues: {
      ...defaultEmbedFormValues,
      slug: mentorId,
      generateShareableLink: false,
      allow_anonymous: mentorPublicSettings?.allow_anonymous ?? false,
      mentor_visibility: mentorPublicSettings?.mentor_visibility ?? '',
      custom_css: mentorPublicSettings?.custom_css ?? '',
      embed_show_attachment:
        mentorPublicSettings?.embed_show_attachment ?? true,
      embed_show_voice_call:
        mentorPublicSettings?.embed_show_voice_call ?? true,
      embed_show_voice_record:
        mentorPublicSettings?.embed_show_voice_record ?? true,
      // `show_catalogue` is exposed by the backend but not yet reflected in the
      // published MentorSettingsPublic type — read it via a narrow cast.
      show_catalogue:
        (mentorPublicSettings as { show_catalogue?: boolean } | undefined)
          ?.show_catalogue ?? true,
      // The custom-vs-default launcher icon mode is derived from whether the
      // persisted `embed_icon_selection_data` is a NON-EMPTY object (mirroring
      // `buildFloatingBubbleConfigFromSettings` via the shared
      // `hasCustomIconData` predicate, so both call sites stay in lockstep). A
      // cleared field reads back as the empty object `{}`, which must yield
      // 'default'. Initialize straight from settings so TanStack Form's reactive
      // defaultValues hydrate it the same way the sibling fields above are
      // hydrated — instead of an imperative `setFieldValue` in an effect that
      // the reactive re-init would clobber.
      icon_selection: hasCustomIconData(
        (
          mentorPublicSettings as
            | { embed_icon_selection_data?: unknown }
            | undefined
        )?.embed_icon_selection_data,
      )
        ? 'custom'
        : 'default',
      starter_prompts:
        mentorPublicSettings?.starter_prompts === 'suggested_prompt'
          ? 'suggested_prompt'
          : 'guided_prompt',
    },
    onSubmit: async ({ value }) => {
      const syncResult = await syncEmbedSettings();
      if (!syncResult.success) {
        return;
      }

      const embed = await getEmbedCode(
        params.tenantKey,
        // @ts-expect-error - value is not typed correctly
        value,
        syncResult.redirectToken ?? '',
        value.icon_selection === 'custom',
        customFloatingBubbleConfig,
      );
      setEmbedCode(embed);
    },
  });
  // Hydrate the custom launcher icon config from persisted mentor settings
  // once they load. Without this, the config only ever lived in local state, so
  // a refresh reverted the icon (and the generated embed snippet) to defaults.
  // We guard with a ref keyed on the settings identity so hydration runs on the
  // initial load / settings-id change only — never on every render — to avoid
  // clobbering in-progress user edits.
  const hydratedSettingsKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!mentorPublicSettings) return;

    const settings = mentorPublicSettings as {
      mentor_unique_id?: string;
      embed_icon_selection_data?: unknown;
      embed_custom_image?: string | null;
    };
    const settingsKey = settings.mentor_unique_id ?? mentorId;
    if (hydratedSettingsKeyRef.current === settingsKey) return;
    hydratedSettingsKeyRef.current = settingsKey;

    const hydrated = buildFloatingBubbleConfigFromSettings(
      defaultFloatingBubbleConfig,
      settings.embed_icon_selection_data,
      settings.embed_custom_image,
    );
    if (!hydrated) return;

    setCustomFloatingBubbleConfig(hydrated.config);
    // NOTE: the `icon_selection` form field is NOT set here. It hydrates from
    // settings via the form's reactive `defaultValues` (see the `useForm` block
    // above). Setting it imperatively here would be clobbered by that reactive
    // re-init when `mentorPublicSettings` loads, which was the root cause of the
    // refresh bug (#789). `buildFloatingBubbleConfigFromSettings` still returns
    // `iconSelection` for other consumers/tests; we simply don't apply it here.
    // Intentionally keyed on settings identity only — `form` and
    // `defaultFloatingBubbleConfig` are recreated each render but the ref guard
    // ensures this hydrates once per settings load, not on every render.
  }, [mentorPublicSettings, mentorId]);

  const {
    data: integratedSsoProviders,
    isError: isIntegratedSsoProvidersError = true,
  } = useGetIntegratedSsoProvidersQuery({
    platform_key: params.tenantKey,
    username: getUserName(),
  });

  const [createTokenError, setCreateTokenError] = useState('');
  const createTokenHandler = async () => {
    const websiteUrl = form.getFieldValue('website_url');
    if (!websiteUrl || !z.string().url().safeParse(websiteUrl).success) {
      setCreateTokenError('A valid url is required!');
      return;
    }

    try {
      const response = await createRedirectToken({
        org: params.tenantKey,
        requestBody: { url: websiteUrl },
      });
      if (response.error) {
        const errorObj = response.error as any;
        console.error(
          `Failed to create redirect token for website (${websiteUrl}) in org (${params.tenantKey})`,
          errorObj,
        );
        setCreateTokenError(
          errorObj?.error?.url?.[0] ?? 'Unknown error occurred',
        );
      }
    } catch (error) {
      console.error(
        `Failed to create redirect token for website (${websiteUrl}) in org (${params.tenantKey})`,
        error,
      );
      setCreateTokenError(
        `Failed to create redirect token for website (${websiteUrl}) in org (${params.tenantKey})`,
      );
      console.error(JSON.stringify({ tenant: tenantKey, error }));
    }
  };

  const [focusEditCustomFloatingBubble, setFocusEditCustomFloatingBubble] =
    useState(false);

  return {
    createTokenHandler,
    form,
    createTokenError,
    isCreateTokenLoading,
    redirectTokenData,
    setCreateTokenError,
    integratedSsoProviders,
    isIntegratedSsoProvidersError,
    embedCode,
    setEmbedCode,
    customFloatingBubbleConfig,
    setCustomFloatingBubbleConfig,
    handleFloatingBubbleImageError,
    focusEditCustomFloatingBubble,
    setFocusEditCustomFloatingBubble,
    updateConfig,
    updateMultipleConfig,
    syncEmbedSettings,
  };
};

export default useEmbedTab;
