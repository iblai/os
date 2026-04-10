'use client';

import React from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';

import { Search } from 'lucide-react';
import {
  useGetLlmsQuery,
  useEditMentorMutation,
  useGetMentorSettingsQuery,
} from '@iblai/iblai-js/data-layer';

import { Input } from '@/components/ui/input';
import { useUsername } from '@/hooks/use-user';
import {
  LLMProvider,
  LLMProviderModal,
} from '@/components/modals/llm-provider-modal';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { toast } from 'sonner';
import { cn, getLLMProviderDetails, Provider } from '@/lib/utils';
import { useNavigate } from '@/hooks/user-navigate';
import { Spinner } from '@/components/spinner';
import WithFormPermissions from '@/hoc/withPermissions';
import { extractErrorMessage } from '@/lib/error';

type LLMTabProps = {
  showConfigurationHeader?: boolean;
};

export function LLMTab({ showConfigurationHeader = true }: LLMTabProps) {
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
      toast.success('LLM updated successfully');
    } catch (error) {
      console.error(JSON.stringify(error));
      const errorMessage = extractErrorMessage(error, 'Failed to update LLM');
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
              LLM Configuration
            </h3>
            <p className="text-xs text-gray-700">
              Configure the language model settings for your mentor.
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
        <div className="space-y-6">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <Input
              type="search"
              placeholder="Search Providers"
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
                                mentorSettings?.llm_provider === model.name,
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
                              alt={`${providerDetails.name} logo`}
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
