'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Info,
  MessageCircle,
  Palette,
  RefreshCw,
  Settings,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Check,
  AlertTriangle,
  Code2,
  ShieldAlert,
  Mail,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import useEmbedTab from '../hooks/useEmbedTab';
import { validateWebsiteUrl } from '../utils';
import { CopyCodeBlock } from '@/components/copy-code-block';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { useParams } from 'next/navigation';
import { useNavigate } from '@/hooks/user-navigate';
import WithFormPermissions from '@/hoc/withPermissions';
import {
  useCreateShareableLinkMutation,
  useGetMentorSettingsQuery,
  useGetShareableLinkQuery,
  useUpdateShareableLinkMutation,
} from '@iblai/iblai-js/data-layer';
import { useUsername } from '@/hooks/use-user';
import { Spinner } from '@iblai/iblai-js/web-containers';
import { useToast } from '@/components/ui/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';
import { Tabs, TabsContent, TabsList } from '@/components/ui/tabs';
import { TabsTrigger } from '@/components/tabs';
import { Label } from '@/components/ui/label';
import { MENTOR_VISIBILITY } from '@/lib/constants';
import type { ChatMode } from '@iblai/iblai-js/web-utils';
import { toast as sonnerToast } from 'sonner';
import { cn } from '@/lib/utils';
import { useEditMentorMutation } from '@iblai/iblai-js/data-layer';
import { useTenantMetadata } from '@iblai/iblai-js/web-utils';
import { config } from '@/lib/config';
import { useTranslations } from 'next-intl';

interface CssValidationResult {
  isValid: boolean;
  errors: string[];
}

interface JsValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateCss(css: string): CssValidationResult {
  if (!css.trim()) {
    return { isValid: true, errors: [] };
  }

  const errors: string[] = [];

  // Check for balanced braces
  const openBraces = (css.match(/\{/g) || []).length;
  const closeBraces = (css.match(/\}/g) || []).length;
  if (openBraces !== closeBraces) {
    errors.push(
      `Missing ${openBraces > closeBraces ? 'closing' : 'opening'} brace(s)`,
    );
  }

  // Check for balanced parentheses
  const openParens = (css.match(/\(/g) || []).length;
  const closeParens = (css.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    errors.push(`Unbalanced parentheses`);
  }

  // Check for unclosed strings
  const singleQuotes = (css.match(/'/g) || []).length;
  const doubleQuotes = (css.match(/"/g) || []).length;
  if (singleQuotes % 2 !== 0) {
    errors.push(`Unclosed single quote`);
  }
  if (doubleQuotes % 2 !== 0) {
    errors.push(`Unclosed double quote`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateJavaScript(js: string): JsValidationResult {
  if (!js.trim()) {
    return { isValid: true, errors: [], warnings: [] };
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for smart/curly quotes (common when copying from Word, websites, etc.)
  const hasSmartQuotes = /[\u2018\u2019\u201C\u201D]/.test(js);
  if (hasSmartQuotes) {
    errors.push(
      'Smart quotes detected (" " \' \'). Replace with straight quotes (" \')',
    );
  }

  // Check for balanced braces
  const openBraces = (js.match(/\{/g) || []).length;
  const closeBraces = (js.match(/\}/g) || []).length;
  if (openBraces !== closeBraces) {
    errors.push(
      `Missing ${openBraces > closeBraces ? 'closing' : 'opening'} brace(s)`,
    );
  }

  // Check for balanced brackets
  const openBrackets = (js.match(/\[/g) || []).length;
  const closeBrackets = (js.match(/\]/g) || []).length;
  if (openBrackets !== closeBrackets) {
    errors.push(
      `Missing ${openBrackets > closeBrackets ? 'closing' : 'opening'} bracket(s)`,
    );
  }

  // Check for balanced parentheses
  const openParens = (js.match(/\(/g) || []).length;
  const closeParens = (js.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    errors.push(`Unbalanced parentheses`);
  }

  // Check for unclosed strings across the entire code (not per-line, to handle wrapped/multiline content)
  // Use negative lookbehind to avoid stripping URLs (e.g., https://) as comments
  const jsWithoutComments = js
    .replace(/(?<!:)\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const singleQuotes = (jsWithoutComments.match(/(?<!\\)'/g) || []).length;
  const doubleQuotes = (jsWithoutComments.match(/(?<!\\)"/g) || []).length;
  const templateLiterals = (jsWithoutComments.match(/(?<!\\)`/g) || []).length;

  if (singleQuotes % 2 !== 0) {
    errors.push('Unclosed single quote');
  }
  if (doubleQuotes % 2 !== 0) {
    errors.push('Unclosed double quote');
  }
  if (templateLiterals % 2 !== 0) {
    errors.push('Unclosed template literal');
  }

  // Warnings for potentially risky patterns
  if (js.includes('eval(')) {
    warnings.push('Usage of eval() is discouraged for security reasons');
  }
  if (js.includes('document.write')) {
    warnings.push('document.write() may cause unexpected behavior');
  }
  if (js.includes('innerHTML')) {
    warnings.push('innerHTML usage detected - ensure content is sanitized');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

export function EmbedTab() {
  const t = useTranslations('tabsEmbedTab');
  // Dynamically import web component to avoid HTMLElement ReferenceError during SSR pre-warming
  useEffect(() => {
    import('@iblai/iblai-web-mentor');
  }, []);

  const { tenantKey, mentorId: paramsMentorId } =
    useParams<TenantKeyMentorIdParams>();
  const username = useUsername();
  const { getMentorId } = useNavigate();
  const mentorId = getMentorId() ?? paramsMentorId;
  const [shareableToken, setShareableToken] = useState<any>();
  const { data: shareableTokenData } = useGetShareableLinkQuery({
    mentor: mentorId,
    org: tenantKey,
    // @ts-expect-error - userId parameter may not exist in API but is passed from legacy code
    userId: username,
  });
  const [createShareableLink, { data: createShareableLinkData }] =
    useCreateShareableLinkMutation();
  const [isLoadingShareableLink, setIsLoadingShareableLink] = useState(false);
  const [updateShareableLink] = useUpdateShareableLinkMutation();
  useEffect(() => {
    setShareableToken(shareableTokenData);
  }, [shareableTokenData]);
  const {
    form,
    createTokenHandler,
    createTokenError,
    setCreateTokenError,
    isCreateTokenLoading,
    redirectTokenData,
    integratedSsoProviders,
    isIntegratedSsoProvidersError,
    embedCode,
    setEmbedCode,
    customFloatingBubbleConfig,
    handleFloatingBubbleImageError,
    focusEditCustomFloatingBubble,
    setFocusEditCustomFloatingBubble,
    updateConfig,
    updateMultipleConfig,
    syncEmbedSettings,
  } = useEmbedTab();
  const toast = useToast();
  const { data: mentorSettings, isLoading: isLoadingSettings } =
    useGetMentorSettingsQuery(
      // @ts-expect-error userId is not part of useGetMentorSettingsQuery Query definition
      { mentor: mentorId, org: tenantKey, userId: username ?? '' },
      { skip: !username || !mentorId || !tenantKey },
    );

  const [editMentor, { isLoading: isSavingAdvanced }] = useEditMentorMutation();

  const { metadata } = useTenantMetadata({ org: tenantKey });
  const supportEmail = metadata?.support_email || config.supportEmail();

  // TODO: Uncomment when enable_custom_javascript is supported by API
  const isCustomJsEnabled =
    (mentorSettings as any as { enable_custom_javascript: boolean })
      ?.enable_custom_javascript === true;
  //const isCustomJsEnabled = true;

  // Advanced CSS state
  const [isCssExpanded, setIsCssExpanded] = useState(false);
  const [cssValue, setCssValue] = useState('');
  const [originalCssValue, setOriginalCssValue] = useState('');
  const [cssValidation, setCssValidation] = useState<CssValidationResult>({
    isValid: true,
    errors: [],
  });

  // Advanced JS state
  const [isJsExpanded, setIsJsExpanded] = useState(false);
  const [jsValue, setJsValue] = useState('');
  const [originalJsValue, setOriginalJsValue] = useState('');
  const [jsValidation, setJsValidation] = useState<JsValidationResult>({
    isValid: true,
    errors: [],
    warnings: [],
  });

  // Initialize CSS value from settings
  useEffect(() => {
    if (mentorSettings?.custom_css !== undefined) {
      setCssValue(mentorSettings.custom_css || '');
      setOriginalCssValue(mentorSettings.custom_css || '');
    }
  }, [mentorSettings?.custom_css]);

  // Initialize JS value from settings
  useEffect(() => {
    if (mentorSettings?.custom_javascript !== undefined) {
      setJsValue(mentorSettings.custom_javascript || '');
      setOriginalJsValue(mentorSettings.custom_javascript || '');
    }
  }, [mentorSettings]);

  // Validate CSS on change
  useEffect(() => {
    const result = validateCss(cssValue);
    setCssValidation(result);
  }, [cssValue]);

  // Validate JS on change
  useEffect(() => {
    const result = validateJavaScript(jsValue);
    setJsValidation(result);
  }, [jsValue]);

  const hasCssChanges = useMemo(
    () => cssValue !== originalCssValue,
    [cssValue, originalCssValue],
  );
  const canSaveCss =
    hasCssChanges && cssValidation.isValid && !isSavingAdvanced;

  const hasJsChanges = useMemo(
    () => jsValue !== originalJsValue,
    [jsValue, originalJsValue],
  );
  const canSaveJs = hasJsChanges && jsValidation.isValid && !isSavingAdvanced;

  const handleSaveCss = useCallback(async () => {
    if (!canSaveCss) return;

    try {
      await editMentor({
        mentor: mentorId,
        org: tenantKey,
        // @ts-expect-error - userId is required by the API but not reflected in the type definition
        userId: username,
        formData: {
          custom_css: cssValue,
        },
      }).unwrap();

      setOriginalCssValue(cssValue);
      sonnerToast.success(t('toastCssSaveSuccess'));
    } catch (error) {
      console.error('Failed to save advanced CSS:', error);
      sonnerToast.error(t('toastCssSaveFail'));
    }
  }, [canSaveCss, cssValue, editMentor, mentorId, tenantKey, username]);

  const handleDiscardCss = useCallback(() => {
    setCssValue(originalCssValue);
  }, [originalCssValue]);

  const handleSaveJs = useCallback(async () => {
    if (!canSaveJs) return;

    try {
      await editMentor({
        mentor: mentorId,
        org: tenantKey,
        // @ts-expect-error - userId is supported by API but not in generated types
        userId: username,
        formData: {
          custom_javascript: jsValue,
        } as any,
      }).unwrap();

      setOriginalJsValue(jsValue);
      sonnerToast.success(t('toastJsSaveSuccess'));
    } catch (error) {
      console.error('Failed to save advanced JavaScript:', error);
      sonnerToast.error(t('toastJsSaveFail'));
    }
  }, [canSaveJs, jsValue, editMentor, mentorId, tenantKey, username]);

  const handleDiscardJs = useCallback(() => {
    setJsValue(originalJsValue);
  }, [originalJsValue]);

  const isAdvancedDisabled = isLoadingSettings || isSavingAdvanced;

  useEffect(() => {
    setShareableToken(createShareableLinkData);
  }, [createShareableLinkData]);

  useEffect(() => {
    setShareableToken(shareableTokenData);
  }, [shareableTokenData]);

  const handleRegenerateToken = async () => {
    try {
      setIsLoadingShareableLink(true);
      await createShareableLink({
        mentor: mentorId,
        org: tenantKey,
        // @ts-expect-error - userId parameter may not exist in API but is passed from legacy code
        userId: username,
      }).unwrap();
      setShareableToken(createShareableLinkData);

      // Sync embed settings after shareable link creation
      await syncEmbedSettings();

      setIsLoadingShareableLink(false);
      toast.toast({
        description: t('toastRegenerateSuccess'),
      });
    } catch (error) {
      console.error('handleRegenerateToken (regenerate token) error: ', error);
      setIsLoadingShareableLink(false);
      toast.toast({
        description: t('toastRegenerateFail'),
      });
      console.error(JSON.stringify({ tenant: tenantKey, error }));
    }
  };

  const handleShareableTokenToggle = async (checked: boolean) => {
    if (checked) {
      if (shareableToken && !shareableToken.enabled) {
        try {
          setIsLoadingShareableLink(true);
          await updateShareableLink({
            mentor: mentorId,
            org: tenantKey,
            userId: username,
            // @ts-expect-error - API expects full ShareableMentorLink but only partial updates are supported
            requestBody: {
              enabled: true,
            },
          }).unwrap();
          setShareableToken({ ...shareableToken, enabled: true });

          // Sync embed settings after enabling shareable link
          await syncEmbedSettings();

          setIsLoadingShareableLink(false);
          toast.toast({
            description: t('toastEnableSuccess'),
          });
        } catch (error) {
          console.error(
            'handleShareableTokenToggle (revoke token) error: ',
            error,
          );
          setIsLoadingShareableLink(false);
          toast.toast({
            description: t('toastEnableFail'),
          });
          console.error(JSON.stringify({ tenant: tenantKey, error }));
        }
      } else {
        try {
          setIsLoadingShareableLink(true);
          await createShareableLink({
            mentor: mentorId,
            org: tenantKey,
            // @ts-expect-error - userId parameter may not exist in API but is passed from legacy code
            userId: username,
          }).unwrap();

          // Sync embed settings after creating shareable link
          await syncEmbedSettings();

          setIsLoadingShareableLink(false);
          toast.toast({
            description: t('toastCreateSuccess'),
          });
        } catch (error) {
          console.error(
            'handleShareableTokenToggle (revoke token) error: ',
            error,
          );
          setIsLoadingShareableLink(false);
          toast.toast({
            description: t('toastCreateFail'),
          });
          console.error(JSON.stringify({ tenant: tenantKey, error }));
        }
      }
    } else {
      try {
        setIsLoadingShareableLink(true);
        await updateShareableLink({
          mentor: mentorId,
          org: tenantKey,
          userId: username,
          // @ts-expect-error - API expects full ShareableMentorLink but only partial updates are supported
          requestBody: {
            enabled: false,
          },
        }).unwrap();
        setShareableToken({ ...shareableToken, enabled: false });

        // Sync embed settings after disabling shareable link
        await syncEmbedSettings();

        setIsLoadingShareableLink(false);
        toast.toast({
          description: t('toastDisableSuccess'),
        });
      } catch (error) {
        console.error(
          'handleShareableTokenToggle (disable token) error: ',
          error,
        );
        setIsLoadingShareableLink(false);
        toast.toast({
          description: t('toastDisableFail'),
        });
        console.error(JSON.stringify({ tenant: tenantKey, error }));
      }
    }
  };

  return (
    <>
      <div className="hidden h-[73px] flex-shrink-0 items-center border-b border-gray-200 bg-white p-4 lg:flex">
        <div>
          <h3 className="mb-1 text-base font-medium text-gray-900">
            {t('heading')}
          </h3>
          <p className="text-xs text-gray-600">{t('headingDescription')}</p>
        </div>
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <div
          className="flex-1 space-y-4 px-3 pt-3"
          style={{
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
          <form
            onSubmit={(formEvent) => {
              formEvent.preventDefault();
              formEvent.stopPropagation();
              form.handleSubmit();
            }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_1fr]">
              <div className="space-y-6">
                {/* Advanced CSS Card */}
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                  <button
                    type="button"
                    onClick={() => setIsCssExpanded(!isCssExpanded)}
                    className="flex w-full items-center justify-between p-4 transition-colors hover:bg-gray-50"
                    aria-expanded={isCssExpanded}
                    aria-label={
                      isCssExpanded
                        ? t('collapseAdvancedCss')
                        : t('expandAdvancedCss')
                    }
                  >
                    <div className="flex items-center gap-3">
                      <Palette className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">
                        {t('advancedCssLabel')}
                      </span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger
                            asChild
                            onClick={(e) => e.stopPropagation()}
                            aria-label={t('moreInfoAdvancedCss')}
                          >
                            <Info className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                          </TooltipTrigger>
                          <TooltipContent className="ibl-tooltip-content">
                            <p>{t('advancedCssTooltip')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasCssChanges && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                          {t('unsavedChanges')}
                        </span>
                      )}
                      {isCssExpanded ? (
                        <ChevronUp className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {isCssExpanded && (
                    <div className="border-t border-gray-100">
                      <WithFormPermissions
                        name="custom_css"
                        // @ts-ignore
                        permissions={mentorSettings?.permissions?.field}
                      >
                        {({ disabled }) => (
                          <div className="space-y-4 p-4">
                            <div className="relative">
                              <Textarea
                                value={cssValue}
                                onChange={(e) => setCssValue(e.target.value)}
                                placeholder={`/* Example CSS */
.chat-ai-message-response {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 12px;
}

.chat-submit-message-button {
  background: #6366f1 !important;
}`}
                                className={cn(
                                  'min-h-[200px] resize-y font-mono text-sm',
                                  'border-gray-200 bg-gray-50',
                                  'focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20',
                                  !cssValidation.isValid &&
                                    'border-red-300 focus:border-red-500 focus:ring-red-500/20',
                                )}
                                disabled={isAdvancedDisabled || disabled}
                                aria-label={t('customCssInputLabel')}
                                aria-invalid={!cssValidation.isValid}
                                aria-describedby={
                                  !cssValidation.isValid
                                    ? 'css-errors'
                                    : undefined
                                }
                              />

                              <div className="absolute top-3 right-3">
                                {cssValue.trim() && (
                                  <div
                                    className={cn(
                                      'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium',
                                      cssValidation.isValid
                                        ? 'bg-green-50 text-green-700'
                                        : 'bg-red-50 text-red-700',
                                    )}
                                  >
                                    {cssValidation.isValid ? (
                                      <>
                                        <Check className="h-3.5 w-3.5" />
                                        {t('validationValid')}
                                      </>
                                    ) : (
                                      <>
                                        <AlertCircle className="h-3.5 w-3.5" />
                                        {t('validationInvalid')}
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {!cssValidation.isValid && (
                              <div
                                id="css-errors"
                                className="rounded-lg border border-red-100 bg-red-50 p-3"
                                role="alert"
                              >
                                <p className="mb-1 text-sm font-medium text-red-800">
                                  {t('cssValidationErrors')}
                                </p>
                                <ul className="list-inside list-disc space-y-0.5 text-sm text-red-700">
                                  {cssValidation.errors.map((error, index) => (
                                    <li key={index}>{error}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            <div className="flex items-center justify-between pt-2">
                              <p className="text-xs text-gray-500">
                                {t('cssChangesHint')}
                              </p>
                              <div className="flex items-center gap-2">
                                {hasCssChanges && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleDiscardCss}
                                    disabled={isAdvancedDisabled || disabled}
                                    aria-label={t('discardChanges')}
                                  >
                                    {t('discard')}
                                  </Button>
                                )}
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={handleSaveCss}
                                  disabled={!canSaveCss || disabled}
                                  className="bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white hover:opacity-90"
                                  aria-label={t('saveAdvancedCss')}
                                >
                                  {isSavingAdvanced ? t('saving') : t('save')}
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </WithFormPermissions>
                    </div>
                  )}
                </div>

                {/* Advanced JS Card */}
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                  <button
                    type="button"
                    onClick={() => setIsJsExpanded(!isJsExpanded)}
                    className="flex w-full items-center justify-between p-4 transition-colors hover:bg-gray-50"
                    aria-expanded={isJsExpanded}
                    aria-label={
                      isJsExpanded
                        ? t('collapseAdvancedJs')
                        : t('expandAdvancedJs')
                    }
                  >
                    <div className="flex items-center gap-3">
                      <Code2 className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">
                        {t('advancedJsLabel')}
                      </span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger
                            asChild
                            onClick={(e) => e.stopPropagation()}
                            aria-label={t('moreInfoAdvancedJs')}
                          >
                            <Info className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                          </TooltipTrigger>
                          <TooltipContent className="ibl-tooltip-content">
                            <p>{t('advancedJsTooltip')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasJsChanges && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                          {t('unsavedChanges')}
                        </span>
                      )}
                      {isJsExpanded ? (
                        <ChevronUp className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {isJsExpanded && (
                    <div className="border-t border-gray-100">
                      {/* Feature Disabled Notice */}
                      {!isLoadingSettings && !isCustomJsEnabled ? (
                        <div className="flex flex-col items-center justify-center px-6 py-12">
                          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                            <ShieldAlert
                              className="h-7 w-7 text-gray-400"
                              aria-hidden="true"
                            />
                          </div>
                          <h4 className="mb-2 text-center text-base font-semibold text-gray-900">
                            {t('customJsDisabledTitle')}
                          </h4>
                          <p className="mb-4 max-w-sm text-center text-xs text-gray-600">
                            {t('customJsDisabledDescription')}
                          </p>
                          <div className="flex flex-col items-center gap-2">
                            <p className="text-center text-xs text-gray-500">
                              {t('contactSupportPrompt')}
                            </p>
                            <a
                              href={`mailto:${supportEmail}?subject=Request%20to%20Enable%20Custom%20JavaScript&body=Hello%2C%0A%0AI%20would%20like%20to%20request%20access%20to%20the%20Custom%20JavaScript%20feature%20for%20my%20agent.%0A%0AAgent%20ID%3A%20${mentorId}%0ATenant%3A%20${tenantKey}%0A%0AThank%20you.`}
                              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
                            >
                              <Mail className="h-3.5 w-3.5" />
                              {t('contactSupport')}
                            </a>
                            <span className="text-xs text-gray-400">
                              {supportEmail}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4 p-4">
                          {/* Security Notice */}
                          <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
                            <p className="text-xs text-blue-700">
                              {t('jsSecurityNotice')}
                            </p>
                          </div>

                          <div className="relative">
                            <Textarea
                              value={jsValue}
                              onChange={(e) => setJsValue(e.target.value)}
                              placeholder={`// Example JavaScript
(function() {
  // Custom initialization code
  console.log('Custom agent script loaded');

  // Example: Track chat interactions
  document.addEventListener('click', function(e) {
    if (e.target.matches('.chat-submit-message-button')) {
      console.log('Message sent');
    }
  });
})();`}
                              className={cn(
                                'min-h-[200px] resize-y font-mono text-sm',
                                'border-gray-200 bg-gray-50',
                                'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20',
                                !jsValidation.isValid &&
                                  'border-red-300 focus:border-red-500 focus:ring-red-500/20',
                              )}
                              disabled={isAdvancedDisabled}
                              aria-label={t('customJsInputLabel')}
                              aria-invalid={!jsValidation.isValid}
                              aria-describedby={
                                !jsValidation.isValid
                                  ? 'js-errors'
                                  : jsValidation.warnings.length > 0
                                    ? 'js-warnings'
                                    : undefined
                              }
                            />

                            <div className="absolute top-3 right-3">
                              {jsValue.trim() && (
                                <div
                                  className={cn(
                                    'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium',
                                    jsValidation.isValid
                                      ? jsValidation.warnings.length > 0
                                        ? 'bg-blue-50 text-blue-700'
                                        : 'bg-green-50 text-green-700'
                                      : 'bg-red-50 text-red-700',
                                  )}
                                >
                                  {jsValidation.isValid ? (
                                    jsValidation.warnings.length > 0 ? (
                                      <>
                                        <AlertTriangle className="h-3.5 w-3.5" />
                                        {t('validationWarnings')}
                                      </>
                                    ) : (
                                      <>
                                        <Check className="h-3.5 w-3.5" />
                                        {t('validationValid')}
                                      </>
                                    )
                                  ) : (
                                    <>
                                      <AlertCircle className="h-3.5 w-3.5" />
                                      {t('validationInvalid')}
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {!jsValidation.isValid && (
                            <div
                              id="js-errors"
                              className="rounded-lg border border-red-100 bg-red-50 p-3"
                              role="alert"
                            >
                              <p className="mb-1 text-sm font-medium text-red-800">
                                {t('jsValidationErrors')}
                              </p>
                              <ul className="list-inside list-disc space-y-0.5 text-sm text-red-700">
                                {jsValidation.errors.map((error, index) => (
                                  <li key={index}>{error}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {jsValidation.isValid &&
                            jsValidation.warnings.length > 0 && (
                              <div
                                id="js-warnings"
                                className="rounded-lg border border-blue-100 bg-blue-50 p-3"
                                role="status"
                              >
                                <p className="mb-1 text-sm font-medium text-blue-800">
                                  {t('warningsLabel')}
                                </p>
                                <ul className="list-inside list-disc space-y-0.5 text-sm text-blue-700">
                                  {jsValidation.warnings.map(
                                    (warning, index) => (
                                      <li key={index}>{warning}</li>
                                    ),
                                  )}
                                </ul>
                              </div>
                            )}

                          <div className="flex items-center justify-between pt-2">
                            <p className="text-xs text-gray-500">
                              {t('jsChangesHint')}
                            </p>
                            <div className="flex items-center gap-2">
                              {hasJsChanges && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={handleDiscardJs}
                                  disabled={isAdvancedDisabled}
                                  aria-label={t('discardChanges')}
                                >
                                  {t('discard')}
                                </Button>
                              )}
                              <Button
                                type="button"
                                size="sm"
                                onClick={handleSaveJs}
                                disabled={!canSaveJs}
                                className="bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white hover:opacity-90"
                                aria-label={t('saveAdvancedJs')}
                              >
                                {isSavingAdvanced ? t('saving') : t('save')}
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* CUSTOM FLOATING BUBBLE */}
                <form.Subscribe
                  selector={(formState) => [formState.values.icon_selection]}
                >
                  {([iconSelection]) => (
                    <>
                      <form.Field name="icon_selection">
                        {(field) => (
                          <div className="space-y-2">
                            <h3 className="text-sm font-medium text-[#646464]">
                              {t('iconSelectionLabel')}
                            </h3>
                            <Select
                              defaultValue={field.state.value}
                              onValueChange={(value) =>
                                field.handleChange(value)
                              }
                              disabled={form.state.isSubmitting}
                            >
                              <SelectTrigger
                                className="text-[#646464]"
                                aria-label={t('selectEmbedModeAriaLabel')}
                              >
                                <SelectValue
                                  placeholder={t('selectModePlaceholder')}
                                  className="text-[#646464]"
                                />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem
                                  value="default"
                                  className="text-[#646464]"
                                >
                                  {t('iconSelectionDefault')}
                                </SelectItem>
                                <SelectItem
                                  value="custom"
                                  className="text-[#646464]"
                                >
                                  {t('iconSelectionCustom')}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </form.Field>
                      {iconSelection === 'custom' && (
                        <div className="flex w-full flex-col items-center gap-4">
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full bg-gray-50 text-gray-700 hover:bg-gray-100"
                            onClick={() =>
                              setFocusEditCustomFloatingBubble(true)
                            }
                            //disabled={form.state.isSubmitting}
                          >
                            {t('iconEditorButton')}
                          </Button>
                          <Card>
                            <CardHeader className="mb-0 pt-4 pb-0">
                              <CardTitle className="text-sm font-medium text-[#646464]">
                                {t('livePreview')}
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="mt-0">
                              <InteractiveBubbleConfigDisplay
                                customFloatingBubbleConfig={
                                  customFloatingBubbleConfig
                                }
                                handleFloatingBubbleImageError={
                                  handleFloatingBubbleImageError
                                }
                              />
                            </CardContent>
                          </Card>
                        </div>
                      )}
                    </>
                  )}
                </form.Subscribe>
                <hr className="my-4 border-t border-gray-200" />
                <form.Field name="mode">
                  {(field) => (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-[#646464]">
                        {t('modeSelectionLabel')}
                      </h3>
                      <Select
                        defaultValue={field.state.value}
                        onValueChange={(value) =>
                          field.handleChange(value as ChatMode)
                        }
                        disabled={form.state.isSubmitting}
                      >
                        <SelectTrigger
                          className="text-[#646464]"
                          aria-label={t('selectEmbedModeAriaLabel')}
                        >
                          <SelectValue
                            placeholder={t('selectModePlaceholder')}
                            className="text-[#646464]"
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem
                            value="default"
                            className="text-[#646464]"
                          >
                            {t('iconSelectionDefault')}
                          </SelectItem>
                          <SelectItem
                            value="advanced"
                            className="text-[#646464]"
                          >
                            {t('modeAdvanced')}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </form.Field>

                <form.Field name="starter_prompts">
                  {(field) => (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-[#646464]">
                          {t('starterPromptsLabel')}
                        </h3>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger
                              aria-label={t('moreInfoStarterPrompts')}
                            >
                              <Info className="h-4 w-4 text-gray-400" />
                            </TooltipTrigger>
                            <TooltipContent className="ibl-tooltip-content">
                              <p>{t('starterPromptsTooltip')}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <Select
                        value={field.state.value}
                        onValueChange={(value) =>
                          field.handleChange(
                            value as 'guided_prompt' | 'suggested_prompt',
                          )
                        }
                        disabled={form.state.isSubmitting}
                      >
                        <SelectTrigger
                          className="text-[#646464]"
                          aria-label={t('selectStarterPromptsAriaLabel')}
                        >
                          <SelectValue
                            placeholder={t('selectStarterPromptsPlaceholder')}
                            className="text-[#646464]"
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem
                            value="guided_prompt"
                            className="text-[#646464]"
                          >
                            {t('guidedPrompts')}
                          </SelectItem>
                          <SelectItem
                            value="suggested_prompt"
                            className="text-[#646464]"
                          >
                            {t('suggestedPrompts')}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </form.Field>

                <WithFormPermissions
                  name="mentor_visibility"
                  // @ts-ignore
                  permissions={mentorSettings?.permissions?.field}
                >
                  {({ disabled }) => (
                    <form.Field name="mentor_visibility">
                      {(field) => (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Label className="text-sm font-medium text-[#646464]">
                              {t('whoCanViewLabel')}
                            </Label>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger
                                  aria-label={t('moreInfoChatAccess')}
                                >
                                  <Info className="h-4 w-4 text-gray-400" />
                                </TooltipTrigger>
                                <TooltipContent className="ibl-tooltip-content">
                                  <p>{t('whoCanViewTooltip')}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <Select
                            value={
                              typeof field.state.value === 'string'
                                ? field.state.value
                                : ''
                            }
                            onValueChange={(value) => field.handleChange(value)}
                            disabled={form.state.isSubmitting || disabled}
                          >
                            <SelectTrigger
                              className="text-[#646464]"
                              aria-label={t('selectWhoCanViewAriaLabel')}
                            >
                              <SelectValue
                                placeholder={t('selectWhoCanViewPlaceholder')}
                                className="text-[#646464]"
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {MENTOR_VISIBILITY.map((visibility) => (
                                <SelectItem
                                  key={visibility.value}
                                  value={visibility.value}
                                  className="text-[#646464]"
                                >
                                  {visibility.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </form.Field>
                  )}
                </WithFormPermissions>

                <WithFormPermissions
                  name="allow_anonymous"
                  // @ts-ignore
                  permissions={mentorSettings?.permissions?.field}
                >
                  {({ disabled }) => (
                    <form.Field name="allow_anonymous">
                      {(field) => (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Label className="text-sm font-medium text-[#646464]">
                              {t('whoCanChatLabel')}
                            </Label>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger
                                  aria-label={t('moreInfoChatAccess')}
                                >
                                  <Info className="h-4 w-4 text-gray-400" />
                                </TooltipTrigger>
                                <TooltipContent className="ibl-tooltip-content">
                                  <p>{t('whoCanChatTooltip')}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <Select
                            value={field.state.value ? 'true' : 'false'}
                            onValueChange={(value) =>
                              field.handleChange(value === 'true')
                            }
                            disabled={form.state.isSubmitting || disabled}
                          >
                            <SelectTrigger
                              className="text-[#646464]"
                              aria-label={t('selectWhoCanChatAriaLabel')}
                            >
                              <SelectValue
                                placeholder={t('selectWhoCanChatPlaceholder')}
                                className="text-[#646464]"
                              />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem
                                value="true"
                                className="text-[#646464]"
                              >
                                {t('anyone')}
                              </SelectItem>
                              <SelectItem
                                value="false"
                                className="text-[#646464]"
                              >
                                {t('authenticatedUsers')}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </form.Field>
                  )}
                </WithFormPermissions>

                <form.Subscribe
                  selector={(formState) => [formState.values.allow_anonymous]}
                >
                  {([allowAnonymous]) =>
                    !allowAnonymous && (
                      <>
                        <form.Field
                          name="website_url"
                          validators={{
                            onChange: ({ value }) => validateWebsiteUrl(value),
                          }}
                        >
                          {(field) => (
                            <div className="space-y-2">
                              <h3 className="text-sm font-medium text-[#646464]">
                                {t('websiteUrlLabel')}
                              </h3>
                              <Input
                                placeholder="https://ibl.ai"
                                type="url"
                                value={field.state.value}
                                onChange={(e) => {
                                  setCreateTokenError('');
                                  field.handleChange(e.target.value);
                                }}
                                disabled={form.state.isSubmitting}
                              />
                              <p className="text-sm text-red-500">
                                {field.state.meta.errors?.[0] ??
                                  createTokenError}
                              </p>
                            </div>
                          )}
                        </form.Field>
                        {redirectTokenData?.token && (
                          <CopyCodeBlock code={redirectTokenData?.token} />
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full bg-gray-50 text-gray-700 hover:bg-gray-100"
                          onClick={createTokenHandler}
                          disabled={form.state.isSubmitting}
                        >
                          {isCreateTokenLoading
                            ? t('generatingToken')
                            : t('getToken')}
                        </Button>
                      </>
                    )
                  }
                </form.Subscribe>

                <form.Field name="is_context_aware">
                  {(field) => (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#646464]">
                          {t('contextAwareLabel')}
                        </span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger
                              aria-label={t('moreInfoContextAwareness')}
                            >
                              <Info className="h-4 w-4 text-gray-400" />
                            </TooltipTrigger>
                            <TooltipContent className="ibl-tooltip-content">
                              <p>{t('enableContextAwareness')}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <Switch
                        checked={field.state.value}
                        onCheckedChange={(checked) =>
                          field.handleChange(checked)
                        }
                        disabled={form.state.isSubmitting}
                        aria-label={
                          field.state.value
                            ? t('contextAwarenessEnabled')
                            : t('contextAwarenessDisabled')
                        }
                      />
                    </div>
                  )}
                </form.Field>

                <form.Field name="strip_page_content_html">
                  {(field) => (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#646464]">
                          Optimize Page Context Tokens
                        </span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger aria-label="More info about optimizing page context tokens">
                              <Info className="h-4 w-4 text-gray-400" />
                            </TooltipTrigger>
                            <TooltipContent className="ibl-tooltip-content">
                              <p>
                                Strips HTML tags from page context before it's
                                sent to the model. Cuts token usage; leave on
                                unless you need the raw HTML.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <Switch
                        checked={field.state.value}
                        onCheckedChange={(checked) =>
                          field.handleChange(checked)
                        }
                        disabled={form.state.isSubmitting}
                        aria-label={`Optimize page context tokens ${field.state.value ? 'enabled' : 'disabled'}`}
                      />
                    </div>
                  )}
                </form.Field>

                {/* <form.Field name="safety_disclaimer">
                {(field) => (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[#646464]">
                        Safety Disclaimer
                      </span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger aria-label="More info about safety disclaimer">
                            <Info className="h-4 w-4 text-gray-400" />
                          </TooltipTrigger>
                          <TooltipContent className="ibl-tooltip-content">
                            <p>Show Safety Disclaimer</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Switch
                      checked={field.state.value}
                      onCheckedChange={(checked) => field.handleChange(checked)}
                      disabled={form.state.isSubmitting}
                      aria-label={`Safety disclaimer ${field.state.value ? "enabled" : "disabled"}`}
                    />
                  </div>
                )}
              </form.Field> */}

                {!isIntegratedSsoProvidersError && (
                  <form.Field name="sso">
                    {(field) => (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[#646464]">
                            {t('singleSignOnLabel')}
                          </span>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="h-4 w-4 text-gray-400" />
                              </TooltipTrigger>
                              <TooltipContent className="ibl-tooltip-content">
                                <p>{t('enableSingleSignOn')}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <Switch
                          checked={field.state.value}
                          onCheckedChange={(checked) =>
                            field.handleChange(checked)
                          }
                          disabled={form.state.isSubmitting}
                        />
                      </div>
                    )}
                  </form.Field>
                )}
                <form.Subscribe
                  selector={(formState) => [
                    formState.values.sso,
                    formState.values.allow_anonymous,
                    form,
                  ]}
                >
                  {([ssoProvider, allowAnonymous]) =>
                    ssoProvider &&
                    !allowAnonymous && (
                      <form.Field name="sso_provider">
                        {(field) => (
                          <div className="space-y-2">
                            <Select
                              defaultValue={field.state.value}
                              onValueChange={(value) =>
                                field.handleChange(value)
                              }
                              disabled={form.state.isSubmitting}
                            >
                              <SelectTrigger className="text-[#646464]">
                                <SelectValue
                                  placeholder={t('selectOneProvider')}
                                  className="text-[#646464]"
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {integratedSsoProviders?.providers.map(
                                  (provider) => (
                                    <SelectItem
                                      key={provider.backend_uri}
                                      value={provider.backend_uri}
                                      className="text-[#646464]"
                                    >
                                      {provider.slug}
                                    </SelectItem>
                                  ),
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </form.Field>
                    )
                  }
                </form.Subscribe>
                <form.Field name="auto_open">
                  {(field) => (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#646464]">
                          {t('openByDefaultLabel')}
                        </span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger
                              aria-label={t('moreInfoOpenByDefault')}
                            >
                              <Info className="h-4 w-4 text-gray-400" />
                            </TooltipTrigger>
                            <TooltipContent className="ibl-tooltip-content">
                              <p>{t('openChatInterfaceByDefault')}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <Switch
                        checked={field.state.value}
                        onCheckedChange={(checked) =>
                          field.handleChange(checked)
                        }
                        disabled={form.state.isSubmitting}
                        aria-label={
                          field.state.value
                            ? t('openByDefaultEnabled')
                            : t('openByDefaultDisabled')
                        }
                      />
                    </div>
                  )}
                </form.Field>

                <form.Field name="embed_show_attachment">
                  {(field) => (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#646464]">
                          {t('showAttachmentLabel')}
                        </span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger
                              aria-label={t('moreInfoShowAttachment')}
                            >
                              <Info className="h-4 w-4 text-gray-400" />
                            </TooltipTrigger>
                            <TooltipContent className="ibl-tooltip-content">
                              <p>{t('showAttachmentTooltip')}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <Switch
                        checked={field.state.value}
                        onCheckedChange={(checked) =>
                          field.handleChange(checked)
                        }
                        disabled={form.state.isSubmitting}
                        aria-label={
                          field.state.value
                            ? t('showAttachmentEnabled')
                            : t('showAttachmentDisabled')
                        }
                      />
                    </div>
                  )}
                </form.Field>

                <form.Field name="embed_show_voice_call">
                  {(field) => (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#646464]">
                          {t('showVoiceCallLabel')}
                        </span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger
                              aria-label={t('moreInfoShowVoiceCall')}
                            >
                              <Info className="h-4 w-4 text-gray-400" />
                            </TooltipTrigger>
                            <TooltipContent className="ibl-tooltip-content">
                              <p>{t('showVoiceCallTooltip')}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <Switch
                        checked={field.state.value}
                        onCheckedChange={(checked) =>
                          field.handleChange(checked)
                        }
                        disabled={form.state.isSubmitting}
                        aria-label={
                          field.state.value
                            ? t('showVoiceCallEnabled')
                            : t('showVoiceCallDisabled')
                        }
                      />
                    </div>
                  )}
                </form.Field>

                <form.Field name="embed_show_voice_record">
                  {(field) => (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#646464]">
                          {t('showVoiceRecordLabel')}
                        </span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger
                              aria-label={t('moreInfoShowVoiceRecord')}
                            >
                              <Info className="h-4 w-4 text-gray-400" />
                            </TooltipTrigger>
                            <TooltipContent className="ibl-tooltip-content">
                              <p>{t('showVoiceRecordTooltip')}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <Switch
                        checked={field.state.value}
                        onCheckedChange={(checked) =>
                          field.handleChange(checked)
                        }
                        disabled={form.state.isSubmitting}
                        aria-label={
                          field.state.value
                            ? t('showVoiceRecordEnabled')
                            : t('showVoiceRecordDisabled')
                        }
                      />
                    </div>
                  )}
                </form.Field>

                <form.Field name="show_catalogue">
                  {(field) => (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#646464]">
                          {t('showCatalogueLabel')}
                        </span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger
                              aria-label={t('moreInfoShowCatalogue')}
                            >
                              <Info className="h-4 w-4 text-gray-400" />
                            </TooltipTrigger>
                            <TooltipContent className="ibl-tooltip-content">
                              <p>{t('showCatalogueTooltip')}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <Switch
                        checked={field.state.value}
                        onCheckedChange={(checked) =>
                          field.handleChange(checked)
                        }
                        disabled={form.state.isSubmitting}
                        aria-label={
                          field.state.value
                            ? t('showCatalogueEnabled')
                            : t('showCatalogueDisabled')
                        }
                      />
                    </div>
                  )}
                </form.Field>
                <hr className="my-4 border-t border-gray-200" />
                <form.Field name="generateShareableLink">
                  {(field) => (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#646464]">
                          {t('shareableLinkLabel')}
                        </span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger
                              aria-label={t('moreInfoShareableLink')}
                            >
                              <Info className="h-4 w-4 text-gray-400" />
                            </TooltipTrigger>
                            <TooltipContent className="ibl-tooltip-content">
                              <p>{t('shareableLinkTooltip')}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      {isLoadingShareableLink ? (
                        <Spinner />
                      ) : (
                        <div className="flex">
                          <RefreshCw
                            onClick={handleRegenerateToken}
                            className="mr-2 cursor-pointer text-[#646464]"
                          ></RefreshCw>
                          <Switch
                            checked={shareableToken && shareableToken.enabled}
                            onCheckedChange={(checked) =>
                              handleShareableTokenToggle(checked)
                            }
                            aria-label={
                              field.state.value
                                ? t('shareableLinkEnabled')
                                : t('shareableLinkDisabled')
                            }
                          />
                        </div>
                      )}
                    </div>
                  )}
                </form.Field>
                <div>
                  {shareableToken && (
                    <div className="mb-4 w-full lg:w-[500px]">
                      <CopyCodeBlock
                        code={`${window.location.origin}/platform/${tenantKey}/${mentorId}?token=${shareableToken.token}`}
                      ></CopyCodeBlock>
                    </div>
                  )}
                </div>
              </div>

              <div className="h-[75vh] overflow-hidden rounded-lg border bg-gray-50">
                <form.Subscribe
                  selector={(formState) => [formState.values.mode]}
                >
                  {([mode]) => (
                    <iframe
                      id="embed-mentor-preview"
                      title="embed-mentor-preview"
                      src={`${window.location.origin}/platform/${tenantKey}/${mentorId}?mentor=${mentorId}&embed=true&internalPreview=true&tenant=${tenantKey}&mode=anonymous&chat=${mode}`}
                      style={{
                        height: '100%',
                        minHeight: '580px',
                        width: '100%',
                        minWidth: '280px',
                      }}
                      frameBorder="0"
                    ></iframe>
                  )}
                </form.Subscribe>
              </div>
            </div>
            <Toaster />
            {focusEditCustomFloatingBubble && (
              <Dialog
                open={focusEditCustomFloatingBubble}
                onOpenChange={(open) => setFocusEditCustomFloatingBubble(open)}
              >
                <DialogContent className="max-h-[80vh] max-w-[600px] overflow-y-auto">
                  <DialogHeader className="mb-1">
                    <DialogTitle className="ibl-dialog-title">
                      {t('iconEditorButton')}
                    </DialogTitle>
                    <p className="text-xs text-gray-600">
                      {t('iconEditorDialogSubtitle')}
                    </p>
                  </DialogHeader>
                  <Tabs defaultValue="appearance" className="w-full">
                    <TabsList className="mb-4 grid h-10 w-full grid-cols-3">
                      <TabsTrigger
                        value="appearance"
                        className="flex items-center gap-2"
                      >
                        <Palette className="h-4 w-4" />
                        {t('tabAppearance')}
                      </TabsTrigger>
                      <TabsTrigger
                        value="position"
                        className="flex items-center gap-2"
                      >
                        <Settings className="h-4 w-4" />
                        {t('tabPosition')}
                      </TabsTrigger>
                      <TabsTrigger
                        value="content"
                        className="flex items-center gap-2"
                      >
                        <MessageCircle className="h-4 w-4" />
                        {t('tabContent')}
                      </TabsTrigger>
                      {/* <TabsTrigger
                        value="behavior"
                        className="flex items-center gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        Behavior
                      </TabsTrigger> */}
                    </TabsList>

                    <TabsContent value="appearance" className="space-y-6">
                      <Card>
                        <CardHeader className="mb-0 px-4 py-3">
                          <CardTitle className="text-sm font-medium text-gray-600">
                            {t('visualStylingCard')}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-2">
                          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label
                                htmlFor="backgroundColor"
                                className="text-sm text-gray-600"
                              >
                                {t('backgroundColorLabel')}
                              </Label>
                              <div className="mt-2 flex gap-2">
                                <Input
                                  id="backgroundColor"
                                  type="color"
                                  value={
                                    customFloatingBubbleConfig.backgroundColor
                                  }
                                  onChange={(e) =>
                                    updateConfig(
                                      'backgroundColor',
                                      e.target.value,
                                    )
                                  }
                                  className="h-10 w-16 rounded border p-1"
                                />
                                <Input
                                  value={
                                    customFloatingBubbleConfig.backgroundColor
                                  }
                                  onChange={(e) =>
                                    updateConfig(
                                      'backgroundColor',
                                      e.target.value,
                                    )
                                  }
                                  placeholder="#3b82f6"
                                  className="flex-1"
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label
                                htmlFor="textColor"
                                className="text-sm text-gray-600"
                              >
                                {t('titleTextColorLabel')}
                              </Label>
                              <div className="mt-2 flex gap-2">
                                <Input
                                  id="textColor"
                                  type="color"
                                  value={customFloatingBubbleConfig.textColor}
                                  onChange={(e) =>
                                    updateConfig('textColor', e.target.value)
                                  }
                                  className="h-10 w-16 rounded border p-1"
                                />
                                <Input
                                  value={customFloatingBubbleConfig.textColor}
                                  onChange={(e) =>
                                    updateConfig('textColor', e.target.value)
                                  }
                                  placeholder="#ffffff"
                                  className="flex-1"
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label
                                htmlFor="subtitleTextColor"
                                className="text-sm text-gray-600"
                              >
                                {t('subtitleTextColorLabel')}
                              </Label>
                              <div className="mt-2 flex gap-2">
                                <Input
                                  id="subtitleTextColor"
                                  type="color"
                                  value={
                                    customFloatingBubbleConfig.subtitleTextColor
                                  }
                                  onChange={(e) =>
                                    updateConfig(
                                      'subtitleTextColor',
                                      e.target.value,
                                    )
                                  }
                                  className="h-10 w-16 rounded border p-1"
                                />
                                <Input
                                  value={
                                    customFloatingBubbleConfig.subtitleTextColor
                                  }
                                  onChange={(e) =>
                                    updateConfig(
                                      'subtitleTextColor',
                                      e.target.value,
                                    )
                                  }
                                  placeholder="#e5e7eb"
                                  className="flex-1"
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label
                                htmlFor="borderRadius"
                                className="text-sm text-gray-600"
                              >
                                {t('borderRadiusLabel')}
                              </Label>
                              <div className="mt-2 flex gap-2">
                                <Input
                                  value={
                                    customFloatingBubbleConfig.borderRadius
                                  }
                                  onChange={(e) =>
                                    updateConfig('borderRadius', e.target.value)
                                  }
                                  placeholder="16"
                                  type="range"
                                  min={0}
                                  max={100}
                                  step={1}
                                  className="flex-1"
                                  id="borderRadius"
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label
                                htmlFor="imageSize"
                                className="text-sm text-gray-600"
                              >
                                {t('imageSizeLabel')}
                              </Label>
                              <div className="mt-2 flex gap-2">
                                <Input
                                  value={customFloatingBubbleConfig.imageSize}
                                  onChange={(e) =>
                                    updateConfig('imageSize', e.target.value)
                                  }
                                  placeholder="16"
                                  type="range"
                                  min={0}
                                  max={100}
                                  step={1}
                                  className="flex-1"
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label
                                htmlFor="fontSize"
                                className="text-sm text-gray-600"
                              >
                                {t('titleFontSizeLabel')}
                              </Label>
                              <div className="mt-2 flex gap-2">
                                <Input
                                  id="fontSize"
                                  value={customFloatingBubbleConfig.fontSize}
                                  onChange={(e) =>
                                    updateConfig('fontSize', e.target.value)
                                  }
                                  placeholder="16"
                                  type="range"
                                  min={10}
                                  max={24}
                                  step={1}
                                  className="flex-1"
                                />
                                <span className="flex min-w-[30px] items-center text-xs text-gray-500">
                                  {customFloatingBubbleConfig.fontSize}px
                                </span>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label
                                htmlFor="subtitleFontSize"
                                className="text-sm text-gray-600"
                              >
                                {t('subtitleFontSizeLabel')}
                              </Label>
                              <div className="mt-2 flex gap-2">
                                <Input
                                  id="subtitleFontSize"
                                  value={
                                    customFloatingBubbleConfig.subtitleFontSize
                                  }
                                  onChange={(e) =>
                                    updateConfig(
                                      'subtitleFontSize',
                                      e.target.value,
                                    )
                                  }
                                  placeholder="12"
                                  type="range"
                                  min={8}
                                  max={20}
                                  step={1}
                                  className="flex-1"
                                />
                                <span className="flex min-w-[30px] items-center text-xs text-gray-500">
                                  {customFloatingBubbleConfig.subtitleFontSize}
                                  px
                                </span>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label
                                htmlFor="shadow"
                                className="text-sm text-gray-600"
                              >
                                {t('useShadowLabel')}
                              </Label>
                              <div className="mt-2">
                                <Select
                                  value={
                                    customFloatingBubbleConfig.shadow
                                      ? '1'
                                      : '0'
                                  }
                                  onValueChange={(value: string) =>
                                    updateConfig('shadow', value === '1')
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value={'1'}>
                                      {t('yes')}
                                    </SelectItem>
                                    <SelectItem value={'0'}>
                                      {t('no')}
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label
                                htmlFor="padding"
                                className="text-sm text-gray-600"
                              >
                                {t('paddingLabel')}
                              </Label>
                              <div className="mt-2 flex gap-2">
                                <Input
                                  value={customFloatingBubbleConfig.padding}
                                  onChange={(e) =>
                                    updateConfig('padding', e.target.value)
                                  }
                                  placeholder="1"
                                  type="range"
                                  min={0}
                                  max={50}
                                  step={1}
                                  className="flex-1"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label
                                htmlFor="strokeWidth"
                                className="text-sm text-gray-600"
                              >
                                {t('strokeThicknessLabel')}
                              </Label>
                              <div className="mt-2 flex gap-2">
                                <Input
                                  value={customFloatingBubbleConfig.strokeWidth}
                                  onChange={(e) =>
                                    updateConfig('strokeWidth', e.target.value)
                                  }
                                  placeholder="1"
                                  type="range"
                                  min={0}
                                  max={10}
                                  step={1}
                                  className="flex-1"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label
                                htmlFor="strokeColor"
                                className="text-sm text-gray-600"
                              >
                                {t('strokeColorLabel')}
                              </Label>
                              <div className="mt-2 flex gap-2">
                                <Input
                                  id="strokeColor"
                                  type="color"
                                  value={customFloatingBubbleConfig.strokeColor}
                                  onChange={(e) =>
                                    updateConfig('strokeColor', e.target.value)
                                  }
                                  className="h-10 w-16 rounded border p-1"
                                />
                                <Input
                                  value={customFloatingBubbleConfig.strokeColor}
                                  onChange={(e) =>
                                    updateConfig('strokeColor', e.target.value)
                                  }
                                  placeholder="#3b82f6"
                                  className="flex-1"
                                />
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="position" className="space-y-6">
                      <Card>
                        <CardHeader className="mb-0 px-4 py-3">
                          <CardTitle className="text-sm font-medium text-gray-600">
                            {t('positionLayoutCard')}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-0">
                          <div className="space-y-2">
                            <Label
                              htmlFor="position"
                              className="text-sm text-gray-600"
                            >
                              {t('screenPositionLabel')}
                            </Label>
                            <div className="mt-2">
                              <Select
                                value={customFloatingBubbleConfig.position}
                                onValueChange={(value: any) =>
                                  updateConfig('position', value)
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="bottom-right">
                                    {t('bottomRight')}
                                  </SelectItem>
                                  <SelectItem value="bottom-left">
                                    {t('bottomLeft')}
                                  </SelectItem>
                                  <SelectItem value="top-right">
                                    {t('topRight')}
                                  </SelectItem>
                                  <SelectItem value="top-left">
                                    {t('topLeft')}
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="content" className="space-y-6">
                      <Card>
                        <CardHeader className="mb-0 px-4 py-3">
                          <CardTitle className="text-sm font-medium text-gray-600">
                            {t('textContentCard')}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-0">
                          <div className="space-y-2">
                            <Label
                              htmlFor="title"
                              className="text-sm text-gray-600"
                            >
                              {t('titleInputLabel')}
                            </Label>
                            <Input
                              id="title"
                              value={customFloatingBubbleConfig.title}
                              onChange={(e) =>
                                updateConfig('title', e.target.value)
                              }
                              placeholder={t('titleInputPlaceholder')}
                              className="mt-2"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label
                              htmlFor="subtitle"
                              className="text-sm text-gray-600"
                            >
                              {t('subtitleTextLabel')}
                            </Label>
                            <Input
                              id="subtitle"
                              value={customFloatingBubbleConfig.subtitle}
                              onChange={(e) =>
                                updateConfig('subtitle', e.target.value)
                              }
                              placeholder={t('subtitleInputPlaceholder')}
                              className="mt-2"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label
                              htmlFor="iconImage"
                              className="text-sm text-gray-600"
                            >
                              {t('iconImageLabel')}
                            </Label>
                            <div className="mt-2 space-y-1">
                              <Input
                                id="iconImage"
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onload = (event) => {
                                      updateMultipleConfig({
                                        image: event.target?.result as string,
                                        //use_icon: false,
                                      });
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                                className="h-[45px] file:mr-4 file:rounded-full file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                              />
                              {customFloatingBubbleConfig.image && (
                                <div className="my-3 flex items-center gap-3">
                                  <img
                                    src={
                                      customFloatingBubbleConfig.image ||
                                      '/placeholder.svg'
                                    }
                                    alt={t('chatIconPreviewAlt')}
                                    className="h-12 w-12 rounded-lg border bg-gray-100 object-cover p-1"
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      updateMultipleConfig({
                                        image: null,
                                        //use_icon: true,
                                      })
                                    }
                                  >
                                    {t('removeImage')}
                                  </Button>
                                </div>
                              )}
                              <p className="text-xs text-gray-500">
                                {t('uploadIconHint')}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* <TabsContent value="behavior" className="space-y-6">
                      <Card>
                        <CardHeader>
                          <CardTitle>Behavior Settings</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          <div className="space-y-4">
                            <div className="flex items-center space-x-2">
                              <Switch
                                id="autoOpen"
                                checked={customFloatingBubbleConfig.autoOpen}
                                onCheckedChange={(checked) =>
                                  updateConfig("autoOpen", checked)
                                }
                              />
                              <Label htmlFor="autoOpen">
                                Auto-open chat after delay
                              </Label>
                            </div>

                            <div className="flex items-center space-x-2">
                              <Switch
                                id="hideOnMobile"
                                checked={
                                  customFloatingBubbleConfig.hideOnMobile
                                }
                                onCheckedChange={(checked) =>
                                  updateConfig("hideOnMobile", checked)
                                }
                              />
                              <Label htmlFor="hideOnMobile">
                                Hide on mobile devices
                              </Label>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="animation">Animation Style</Label>
                            <Select
                              value={customFloatingBubbleConfig.animation}
                              onValueChange={(value: any) =>
                                updateConfig("animation", value)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="bounce">Bounce</SelectItem>
                                <SelectItem value="fade">Fade</SelectItem>
                                <SelectItem value="slide">Slide</SelectItem>
                                <SelectItem value="pulse">Pulse</SelectItem>
                                <SelectItem value="none">None</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="showOnPages">
                              Show on Pages (comma-separated URLs)
                            </Label>
                            <Textarea
                              id="showOnPages"
                              value={customFloatingBubbleConfig.showOnPages.join(
                                ", "
                              )}
                              onChange={(e) =>
                                updateConfig(
                                  "showOnPages",
                                  e.target.value
                                    .split(",")
                                    .map((s) => s.trim())
                                    .filter(Boolean)
                                )
                              }
                              placeholder="/home, /about, /contact"
                              rows={2}
                            />
                            <p className="text-sm text-gray-500">
                              Leave empty to show on all pages
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent> */}
                  </Tabs>

                  {/* Preview Section */}
                  <Card>
                    <CardHeader className="mb-0 pt-4 pb-0">
                      <CardTitle className="text-sm font-medium text-gray-600">
                        {t('livePreview')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <InteractiveBubbleConfigDisplay
                        customFloatingBubbleConfig={customFloatingBubbleConfig}
                        handleFloatingBubbleImageError={
                          handleFloatingBubbleImageError
                        }
                      />
                    </CardContent>
                  </Card>
                </DialogContent>
              </Dialog>
            )}
          </form>
        </div>
        <div className="flex flex-shrink-0 justify-end border-t border-gray-200 bg-white px-3 py-4">
          <Button
            onClick={() => form.handleSubmit()}
            className="bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-sm text-white hover:text-white hover:opacity-90"
            disabled={form.state.isSubmitting}
          >
            {form.state.isSubmitting ? t('generatingEmbed') : t('createEmbed')}
          </Button>
        </div>
      </div>
      {embedCode && (
        <Dialog
          open={!!embedCode}
          onOpenChange={(open) => {
            if (!open) {
              setEmbedCode('');
            }
          }}
        >
          <DialogContent className="max-w-[425px] md:max-w-[85%]">
            <DialogDescription className="sr-only">
              {t('generatedEmbedCodeSrOnly')}
            </DialogDescription>
            <DialogHeader>
              <DialogTitle className="ibl-dialog-title">
                {t('embeddedCodeTitle')}
              </DialogTitle>
            </DialogHeader>
            <CopyCodeBlock code={embedCode} />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

const InteractiveBubbleConfigDisplay = ({
  customFloatingBubbleConfig,
  handleFloatingBubbleImageError,
}: {
  customFloatingBubbleConfig: Record<string, any>;
  handleFloatingBubbleImageError: () => void;
}) => {
  const t = useTranslations('tabsEmbedTab');
  return (
    <div className="relative min-h-[200px] overflow-hidden rounded-lg bg-gray-100 p-8">
      <div
        className={`absolute ${
          customFloatingBubbleConfig.position === 'bottom-right'
            ? 'right-4 bottom-4'
            : customFloatingBubbleConfig.position === 'bottom-left'
              ? 'bottom-4 left-4'
              : customFloatingBubbleConfig.position === 'top-right'
                ? 'top-4 right-4'
                : 'top-4 left-4'
        }`}
        style={{
          [customFloatingBubbleConfig.position.includes('right')
            ? 'right'
            : 'left']: `${customFloatingBubbleConfig.offsetX}px`,
          [customFloatingBubbleConfig.position.includes('bottom')
            ? 'bottom'
            : 'top']: `${customFloatingBubbleConfig.offsetY}px`,
        }}
      >
        <div
          className={`flex w-auto cursor-pointer items-center justify-center gap-2 rounded-full transition-all duration-300 ${customFloatingBubbleConfig.shadow ? 'shadow-lg' : ''} `}
          style={{
            backgroundColor: customFloatingBubbleConfig.backgroundColor,
            borderRadius: `${customFloatingBubbleConfig.borderRadius}px`,
            //height: `${customFloatingBubbleConfig.height}px`,
            padding: `${customFloatingBubbleConfig.padding}px`,
            border: `${customFloatingBubbleConfig.strokeWidth}px solid ${customFloatingBubbleConfig.strokeColor}`,
            //animationDuration: `${customFloatingBubbleConfig.animationDuration}ms`,
          }}
        >
          <Image
            src={customFloatingBubbleConfig.image}
            alt={t('chatIconAlt')}
            //className="w-6 h-6"
            width={customFloatingBubbleConfig.imageSize}
            height={customFloatingBubbleConfig.imageSize}
            onError={handleFloatingBubbleImageError}
          />
          {(customFloatingBubbleConfig.title ||
            customFloatingBubbleConfig.subtitle) && (
            <div className="flex flex-col items-center text-center">
              {customFloatingBubbleConfig.title && (
                <span
                  style={{
                    color: customFloatingBubbleConfig.textColor,
                    fontSize: `${customFloatingBubbleConfig.fontSize}px`,
                    fontWeight: '500',
                  }}
                >
                  {customFloatingBubbleConfig.title}
                </span>
              )}
              {customFloatingBubbleConfig.subtitle && (
                <span
                  style={{
                    color: customFloatingBubbleConfig.subtitleTextColor,
                    fontSize: `${customFloatingBubbleConfig.subtitleFontSize}px`,
                  }}
                >
                  {customFloatingBubbleConfig.subtitle}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="mt-8 text-center text-sm text-gray-500">
        <p>
          {t('iconPositionHint', {
            position: customFloatingBubbleConfig.position.replace('-', ' '),
          })}
        </p>
      </div>
    </div>
  );
};
