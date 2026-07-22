'use client';

import React from 'react';
import Image from 'next/image';

import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';

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
import { useModelDownload } from '@/hooks/use-model-download';
import {
  LOCAL_MODELS,
  type LocalModel,
  isLocalLLMEnabled,
  setLocalLLMEnabled,
  getLocalLLMModel,
  setLocalLLMModel,
  setLocalLLMToolSupport,
} from '@iblai/iblai-js/web-containers';
import {
  LocalModelRow,
  type LocalRowStatus,
} from './llm-provider-modal/local-model-row';
import { LOCAL_LLM_CHANGED_EVENT } from '@/hooks/use-selected-local-model';

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

/**
 * Whether a catalog model id (e.g. "llama3.2") is among the installed Ollama
 * tags (e.g. "llama3.2:latest"). Inlined from web-containers' `isModelInstalled`
 * (not re-exported from the package entry). Matches an exact tag or same base.
 */
function isModelInstalled(modelId: string, tags?: string[]): boolean {
  return !!tags?.some((t) => t === modelId || t.startsWith(`${modelId}:`));
}

// Match a local model's `provider` (e.g. "Mistral AI") to a cloud provider name
// (e.g. "mistral") tolerantly: strip non-alphanumerics + a couple of aliases.
const PROVIDER_ALIASES: Record<string, string> = {
  mistralai: 'mistral',
  metallama: 'meta',
};
export function providerKey(name: string): string {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return PROVIDER_ALIASES[normalized] ?? normalized;
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
  const t = useTranslations('modalsLlmProviderModal');
  const [searchQuery, setSearchQuery] = React.useState('');

  // On-device model download state (Tauri desktop only; hidden on web).
  const {
    isAvailable,
    state: downloadState,
    ollamaStatus,
    startDownload,
    cancelDownload,
  } = useModelDownload();

  // Mirror the device-global local selection so picks re-render immediately.
  const [localSel, setLocalSel] = React.useState(() => ({
    enabled: isLocalLLMEnabled(),
    model: getLocalLLMModel(),
  }));

  const filteredLLMs = React.useMemo(() => {
    // Guard `chat_models` (not just `llmProvider`): a provider can come back from
    // the API without a models array, and an undefined `.filter` here throws in
    // render and unmounts the whole dialog. Coalesce so the `.map` consumer below
    // always gets an array. (Mirrors the `canSwitchProvider` hardening in utils.)
    return (
      llmProvider?.chat_models?.filter((llm) =>
        llm.llm_name.toLowerCase().includes(searchQuery.toLowerCase()),
      ) ?? []
    );
  }, [searchQuery, llmProvider]);

  // Local models belonging to THIS provider (merged into the same list).
  const localModels = React.useMemo(() => {
    if (!isAvailable) return [] as LocalModel[];
    const key = providerKey(llmProvider.name);
    return LOCAL_MODELS.filter(
      (m) =>
        providerKey(m.provider) === key &&
        m.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [isAvailable, llmProvider.name, searchQuery]);

  const switchLLMAllowed = canSwitchLLm(llmProvider);
  const switchProviderAllowed = canSwitchProvider(llms, llmProvider.name);

  const busyDownloading =
    downloadState.status === 'downloading' || downloadState.status === 'checking';

  const statusFor = (m: LocalModel): LocalRowStatus => {
    if (localSel.enabled && localSel.model === m.id) return 'selected';
    const active = downloadState.activeModel === m.id;
    if (active && downloadState.status === 'error') return 'error';
    if (active && busyDownloading)
      return downloadState.progress > 0 ? 'downloading' : 'starting';
    if (isModelInstalled(m.id, ollamaStatus?.installed_models)) return 'installed';
    return 'not-installed';
  };

  const activateLocal = (m: LocalModel, status: LocalRowStatus) => {
    switch (status) {
      case 'not-installed':
      case 'error':
        startDownload(m.id);
        break;
      case 'starting':
      case 'downloading':
        cancelDownload();
        break;
      case 'installed':
        // Use this on-device model — device-global, mutually exclusive with cloud.
        setLocalLLMModel(m.id);
        setLocalLLMEnabled(true);
        // Persist tool-calling support so local chat routes to the MCP/tool
        // bridge (:8000). Without this the flag stays at its default (false) and
        // streaming chat rejects the model with "tool_support=false" even though
        // the catalog marks it tool-capable.
        setLocalLLMToolSupport(m.tool_support);
        setLocalSel({ enabled: true, model: m.id });
        // Notify same-tab listeners (e.g. the nav-bar on-device badge).
        window.dispatchEvent(new Event(LOCAL_LLM_CHANGED_EVENT));
        break;
      case 'selected':
        break;
    }
  };

  const selectCloud = (llmName: string) => {
    // Picking a cloud model turns local mode off so routing uses the cloud LLM.
    if (localSel.enabled) {
      setLocalLLMEnabled(false);
      setLocalSel((prev) => ({ ...prev, enabled: false }));
      // Notify same-tab listeners (e.g. the nav-bar on-device badge).
      window.dispatchEvent(new Event(LOCAL_LLM_CHANGED_EVENT));
    }
    onSelect(llmProvider.name, llmName);
  };

  // Announce download lifecycle changes once (not every %) for screen readers.
  const activeLocal = LOCAL_MODELS.find((m) => m.id === downloadState.activeModel);
  const liveMessage = !activeLocal
    ? ''
    : downloadState.status === 'completed'
      ? `${activeLocal.name} downloaded`
      : downloadState.status === 'cancelled'
        ? 'Download cancelled'
        : downloadState.status === 'error'
          ? 'Download failed'
          : downloadState.status === 'checking' ||
              (downloadState.status === 'downloading' && downloadState.progress === 0)
            ? `Started downloading ${activeLocal.name}`
            : '';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl space-y-6 p-4">
        <DialogDescription className="sr-only">
          {t('dialogDescription', { providerName: llmProvider.name })}
        </DialogDescription>
        <DialogHeader>
          <DialogTitle className="ibl-dialog-title">{t('title')}</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-gray-600">{t('subtitle')}</p>

        <div className="relative">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder={t('searchPlaceholder')}
            className="py-6 pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoComplete="off"
            disabled={isSelecting}
          />
        </div>

        <div className="sr-only" aria-live="polite" role="status">
          {liveMessage}
        </div>

        <div className="grid max-h-[60vh] grid-cols-1 gap-4 overflow-y-auto pr-2 sm:grid-cols-2 lg:grid-cols-3">
          {filteredLLMs.map((llm) => {
            const isActive =
              mentorSettings?.llm_name === llm.llm_name &&
              mentorSettings?.llm_provider === llmProvider.name &&
              !localSel.enabled;

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
                  selectCloud(llm.llm_name);
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
                    alt={t('providerIconAlt', {
                      providerName: providerDetails.name,
                    })}
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

          {/* On-device models for this provider, merged into the same list. */}
          {localModels.map((m) => {
            const status = statusFor(m);
            return (
              <LocalModelRow
                key={m.id}
                name={m.name}
                size={m.size}
                logo={getLLMProviderDetails(llmProvider.name, m.name).logo}
                status={status}
                progress={
                  downloadState.activeModel === m.id ? downloadState.progress : 0
                }
                disabled={busyDownloading && downloadState.activeModel !== m.id}
                disabledReason="Another model is downloading"
                onActivate={() => activateLocal(m, status)}
              />
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
