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
import { useState } from 'react';

import { z } from 'zod';
import { getEmbedCode } from '../utils';
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
  const [customFloatingBubbleConfig, setCustomFloatingBubbleConfig] =
    useState<CustomFloatingBubbleConfig>({
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
    });

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

    // Set is_context_aware for advanced mode
    const formValues = { ...value };
    if (formValues.mode === 'advanced') {
      formValues.is_context_aware = true;
    }

    let redirectTokenResponse: { data?: { token?: string } } | null = null;

    // Create redirect token if not anonymous
    if (!formValues.allow_anonymous) {
      try {
        const response = await createRedirectToken({
          org: params.tenantKey,
          requestBody: {
            url: formValues.website_url,
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
          `Failed to create redirect token for website (${formValues.website_url}) in org (${params.tenantKey})`,
          error,
        );
        setCreateTokenError(
          `Failed to create redirect token for website (${formValues.website_url}) in org (${params.tenantKey})`,
        );
        console.error(JSON.stringify({ tenant: tenantKey, error }));
        return { success: false };
      }
    }

    // Update mentor settings
    const valid_values = Object.fromEntries(
      Object.entries(formValues).filter(
        ([key, value]) => value !== '' || key === 'custom_css',
      ),
    );
    const response = await updateMentorSettings({
      mentor: mentorId,
      org: params.tenantKey,
      // @ts-expect-error - userId is required by the API but not reflected in the type definition
      userId: getUserName(),
      formData: {
        ...valid_values,
        metadata: { safety_disclaimer: valid_values.safety_disclaimer },
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
