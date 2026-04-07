'use client';

import React from 'react';
import Image from 'next/image';

import { Search } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  canSwitchLLm,
  canSwitchProvider,
  cn,
  getLLMProviderDetails,
  Provider,
} from '@/lib/utils';

interface LLM {
  llm_name: string;
  description: string;
  display_name: string;
  is_multimodal: boolean;
  training_data: string;
  context_window: string;
}

export type LLMProvider = {
  id: number;
  name: string;
  logo?: string | null;
  description?: string | null;
  chat_models: LLM[];
  has_credentials?: boolean;
  main_has_credentials?: boolean;
  can_use_main_keys?: boolean;
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (llmProvider: string, llmName: string) => Promise<void>;
  llmProvider: LLMProvider;
  isSelecting: boolean;
  mentorSettings: {
    llm_name: string;
    llm_provider: string;
  };
  llms: Provider[];
}

export function LLMProviderModal({
  isOpen,
  onClose,
  onSelect,
  llmProvider,
  isSelecting,
  mentorSettings,
  llms,
}: Props) {
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredLLMs = React.useMemo(() => {
    return llmProvider?.chat_models.filter((llm) =>
      llm.llm_name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [searchQuery, llmProvider]);

  const switchLLMAllowed = canSwitchLLm(llmProvider);
  const switchProviderAllowed = canSwitchProvider(llms, llmProvider.name);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl space-y-6 p-4">
        <DialogDescription className="sr-only">
          Select select on of the mentors provided by {llmProvider.name}
        </DialogDescription>
        <DialogHeader>
          <DialogTitle className="ibl-dialog-title">LLM Selection</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-gray-600">
          Choose your preferred LLM from the available provider to tailor your
          experience.
        </p>

        <div className="relative">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search"
            className="py-6 pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoComplete="off"
            disabled={isSelecting}
          />
        </div>

        <div className="grid max-h-[60vh] grid-cols-1 gap-4 overflow-y-auto pr-2 sm:grid-cols-2 lg:grid-cols-3">
          {filteredLLMs.map((llm) => {
            const isActive =
              mentorSettings?.llm_name === llm.llm_name &&
              mentorSettings?.llm_provider === llmProvider.name;

            const providerDetails = getLLMProviderDetails(
              llmProvider.name,
              llm.llm_name,
            );

            const isDisabled =
              !switchLLMAllowed ||
              isSelecting ||
              isActive ||
              !switchProviderAllowed;

            return (
              <button
                key={llm.llm_name}
                disabled={isDisabled}
                onClick={() => {
                  onSelect(llmProvider.name, llm.llm_name);
                }}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 p-4 transition-colors',
                  {
                    'cursor-not-allowed border-gray-200 bg-white': isDisabled,
                    'hover:border-blue-500 hover:bg-blue-50': !isDisabled,
                    'cursor-not-allowed border-blue-500 bg-blue-50': isActive,
                  },
                )}
              >
                <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg">
                  <Image
                    src={providerDetails.logo}
                    alt={`${providerDetails.name} icon`}
                    className={cn('h-full w-full object-contain', {
                      grayscale: isDisabled && !isActive,
                    })}
                    width={32}
                    height={32}
                    loading="lazy"
                  />
                </span>
                <span className="text-left text-sm font-medium text-[#646464]">
                  {llm.llm_name}
                </span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
