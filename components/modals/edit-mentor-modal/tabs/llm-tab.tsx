'use client';

import React from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Search } from 'lucide-react';
import {
  useGetLlmsQuery,
  useEditMentorMutation,
  useGetMentorSettingsQuery,
} from '@iblai/iblai-js/data-layer';
import { LOCAL_MODELS, isTauriApp } from '@iblai/iblai-js/web-containers';

import { Input } from '@/components/ui/input';
import { useUsername } from '@/hooks/use-user';
import {
  LLMProvider,
  LLMProviderModal,
  providerKey,
} from '@/components/modals/llm-provider-modal';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { toast } from 'sonner';
import { cn, getLLMProviderDetails, Provider } from '@/lib/utils';
import { useNavigate } from '@/hooks/user-navigate';
import { Spinner } from '@/components/spinner';
import WithFormPermissions from '@/hoc/withPermissions';
import { extractErrorMessage } from '@/lib/error';
import { useSelectedLocalModel } from '@/hooks/use-selected-local-model';

type LLMTabProps = {
  showConfigurationHeader?: boolean;
};

export function LLMTab({ showConfigurationHeader = true }: LLMTabProps) {
  const t = useTranslations('tabsLlmTab');
  const username = useUsername();
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const { getMentorId } = useNavigate();
  const activeMentorId = getMentorId() || mentorId;

  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedLLMProvider, setSelectedLLMProvider] =
    React.useState<LLMProvider | null>(null);

  const { data: mentorSettings, isLoading: isMentorSettingsLoading } =
    useGetMentorSettingsQuery(
      {
        mentor: activeMentorId,
        org: tenantKey,
        // @ts-ignore
        userId: username ?? '',
      },
      { skip: !username || !activeMentorId || !tenantKey },
    );

  const { data: llmProviders, isLoading: isLoadingLLMProviders } =
    useGetLlmsQuery(
      {
        org: tenantKey,
        // @ts-ignore
        userId: username ?? '',
        mentorId: activeMentorId,
      },
      {
        skip: !tenantKey || !username,
      },
    );

  const [editMentor, { isLoading: isEditingMentor }] = useEditMentorMutation();

  const isDisabled =
    isMentorSettingsLoading || isLoadingLLMProviders || isEditingMentor;

  const isLoading = isMentorSettingsLoading || isLoadingLLMProviders;

  // Providers that only offer on-device (local) models — surfaced as grid cards
  // (Tauri desktop only) so their downloadable models are reachable even when the
  // backend LLM list has no matching cloud provider.
  const localOnlyProviders = React.useMemo(() => {
    if (!isTauriApp()) return [] as { key: string; provider: string }[];
    const cloudKeys = new Set(
      (llmProviders ?? []).map((p) => providerKey(p.name)),
    );
    const seen = new Set<string>();
    const result: { key: string; provider: string }[] = [];
    for (const model of LOCAL_MODELS) {
      const key = providerKey(model.provider);
      if (cloudKeys.has(key) || seen.has(key)) continue;
      seen.add(key);
      result.push({ key, provider: model.provider });
    }
    return result;
  }, [llmProviders]);

  // The highlighted (selected) provider card must reflect the model chat
  // actually uses. When on-device mode is on, that's the selected local model's
  // provider (e.g. Llama 3.2 → Meta) — NOT the mentor's stale cloud
  // `llm_provider` (which stays e.g. OpenAI). Falls back to the cloud provider
  // when local mode is off. Reactive so it updates the instant a model is picked.
  const selectedLocal = useSelectedLocalModel();
  const activeProviderKey =
    selectedLocal.isLocal && selectedLocal.model
      ? providerKey(selectedLocal.model.provider)
      : mentorSettings?.llm_provider
        ? providerKey(mentorSettings.llm_provider)
        : '';

  async function updateMentorLLM(llmProvider: string, llmName: string) {
    try {
      await editMentor({
        mentor: activeMentorId,
        org: tenantKey,
        // @ts-ignore
        userId: username ?? '',
        formData: {
          llm_provider: llmProvider,
          llm_name: llmName,
        },
      }).unwrap();
      toast.success(t('llmUpdatedSuccessfully'));
    } catch (error) {
      console.error(JSON.stringify(error));
      const errorMessage = extractErrorMessage(error, t('failedToUpdateLlm'));
      toast.error(errorMessage);
      console.error(JSON.stringify({ tenant: tenantKey, error }));
    }
  }

  return (
    <>
      {showConfigurationHeader && (
        <div className="flex hidden h-[73px] flex-shrink-0 items-center border-b border-gray-200 bg-white p-4 lg:block">
          <div>
            <h3 className="mb-1 text-base font-medium text-gray-900">
              {t('llmConfiguration')}
            </h3>
            <p className="text-xs text-gray-700">
              {t('configureLanguageModelSettings')}
            </p>
          </div>
        </div>
      )}
      <div
        className={cn(
          'flex-1 space-y-4 pt-3 pb-3 lg:pt-4 lg:pb-4',
          showConfigurationHeader ? 'px-3 lg:px-4' : 'px-0 lg:px-0',
        )}
        style={{
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        <div
          className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600"
          data-testid="llm-info-box"
        >
          {t('infoBox')}
        </div>
        <div className="space-y-6">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <Input
              type="search"
              placeholder={t('searchProviders')}
              className="w-full py-6 pl-9 md:w-1/2"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={isDisabled}
            />
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Spinner />
            </div>
          ) : (
            <WithFormPermissions
              name="llm_provider"
              // @ts-ignore
              permissions={mentorSettings?.permissions?.field}
            >
              {({ disabled }) => (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {llmProviders
                    ?.filter((model) =>
                      model.name
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase()),
                    )
                    .map((model) => {
                      const providerDetails = getLLMProviderDetails(model.name);

                      return (
                        <div
                          key={model.id}
                          className={cn(
                            'flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md',
                            {
                              'border-blue-500':
                                !!activeProviderKey &&
                                providerKey(model.name) === activeProviderKey,
                            },
                          )}
                          onClick={() => {
                            if (isDisabled || disabled) return;
                            setSelectedLLMProvider({
                              id: model.id,
                              name: model.name,
                              logo: model.logo,
                              description: model.description,
                              chat_models: model.chat_models,
                              // @ts-expect-error - has_credentials property does not exist on LLMResponse type
                              has_credentials: model?.has_credentials,
                              // @ts-expect-error - main_has_credentials property does not exist on LLMResponse type
                              main_has_credentials: model?.main_has_credentials,
                              // @ts-expect-error - can_use_main_keys property does not exist on LLMResponse type
                              can_use_main_keys: model?.can_use_main_keys,
                            });
                          }}
                        >
                          <div className="h-8 w-8 flex-shrink-0">
                            <Image
                              src={providerDetails.logo}
                              alt={t('providerLogoAlt', {
                                providerName: providerDetails.name,
                              })}
                              className="h-full w-full object-contain"
                              width={32}
                              height={32}
                              loading="lazy"
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-900">
                            {providerDetails.name}
                          </span>
                        </div>
                      );
                    })}
                  {localOnlyProviders.map((lp) => {
                    const details = getLLMProviderDetails(lp.provider);
                    return (
                      <div
                        key={`local-${lp.key}`}
                        className={cn(
                          'flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md',
                          { 'border-blue-500': lp.key === activeProviderKey },
                        )}
                        onClick={() => {
                          if (isDisabled || disabled) return;
                          setSelectedLLMProvider({
                            id: -1,
                            name: lp.provider,
                            logo: details.logo,
                            description: null,
                            chat_models: [],
                          });
                        }}
                      >
                        <div className="h-8 w-8 flex-shrink-0">
                          <Image
                            src={details.logo}
                            alt={t('providerLogoAlt', {
                              providerName: details.name,
                            })}
                            className="h-full w-full object-contain"
                            width={32}
                            height={32}
                            loading="lazy"
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {details.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </WithFormPermissions>
          )}

          {selectedLLMProvider && mentorSettings && (
            <LLMProviderModal
              isOpen={selectedLLMProvider ? true : false}
              onClose={() => setSelectedLLMProvider(null)}
              onSelect={updateMentorLLM}
              llmProvider={selectedLLMProvider}
              isSelecting={isEditingMentor}
              mentorSettings={{
                llm_name: mentorSettings?.llm_name,
                llm_provider: mentorSettings?.llm_provider,
              }}
              llms={(llmProviders ?? []) as Provider[]}
            />
          )}
        </div>
      </div>
    </>
  );
}
