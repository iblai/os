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
  getProviderName,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
 * Whether two Ollama model refs name the same model, comparing by base name and
 * ignoring a trailing `:tag` (so "llama3.2" ≡ "llama3.2:latest", and
 * "granite4.1:8b" ≡ "granite4.1"). The download state and Ollama's /api/tags may
 * carry a tag suffix the catalog id doesn't (or vice-versa); an exact `===` then
 * fails to recognize a row's own in-flight download — the row shows "Download"
 * with no progress while the pull runs. Base-name matching is safe here because
 * every catalog model has a unique base (llama3.2, qwen3, mistral, granite4.1,
 * gpt-oss, gemma4), so it can never light up the wrong row.
 */
function sameModel(a?: string | null, b?: string | null): boolean {
  const base = (ref?: string | null) => (ref ?? '').toLowerCase().split(':')[0];
  const ba = base(a);
  return ba.length > 0 && ba === base(b);
}

/**
 * Whether a catalog model id (e.g. "llama3.2") is among the installed Ollama
 * tags (e.g. "llama3.2:latest"). Inlined from web-containers' `isModelInstalled`
 * (not re-exported from the package entry). Matches by base name.
 */
function isModelInstalled(modelId: string, tags?: string[]): boolean {
  return !!tags?.some((t) => sameModel(t, modelId));
}

const SIZE_UNIT_BYTES: Record<string, number> = {
  B: 1,
  KB: 1024,
  MB: 1024 ** 2,
  GB: 1024 ** 3,
  TB: 1024 ** 4,
};

/** Parse a catalog size like "2.5 GB" to bytes, or null if unrecognized. */
function parseModelSizeBytes(size: string): number | null {
  const match = /([\d.]+)\s*(TB|GB|MB|KB|B)/i.exec(size);
  if (!match) return null;
  const value = parseFloat(match[1]);
  if (Number.isNaN(value)) return null;
  return value * (SIZE_UNIT_BYTES[match[2].toUpperCase()] ?? 1);
}

// TESTING VALUE (mirrors web-containers): warn when a model exceeds 1% of usable
// memory so the "too large" prompt is easy to trigger. Raise toward real
// capacity (e.g. 0.8) once tuned.
const MODEL_SIZE_WARN_FRACTION = 0.01;

/**
 * Whether `model` is large enough relative to this machine's memory to warrant a
 * "might not run" confirmation. Inlined from web-containers' `modelExceedsCapacity`
 * (not re-exported from the package entry). False when memory or the size is
 * unknown, so the download simply proceeds rather than blocking on missing data.
 */
function modelExceedsCapacity(
  model: LocalModel,
  memory: { ram_total: number; vram_total: number } | null | undefined,
): boolean {
  const capacity = memory ? Math.max(memory.ram_total, memory.vram_total) : 0;
  const modelBytes = parseModelSizeBytes(model.size);
  if (modelBytes == null || capacity <= 0) return false;
  return modelBytes > capacity * MODEL_SIZE_WARN_FRACTION;
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
    systemMemory,
    startDownload,
    cancelDownload,
  } = useModelDownload();

  // Mirror the device-global local selection so picks re-render immediately.
  const [localSel, setLocalSel] = React.useState(() => ({
    enabled: isLocalLLMEnabled(),
    model: getLocalLLMModel(),
  }));

  // Model awaiting the "may be too large" confirmation before its download
  // starts; null when no confirmation is pending.
  const [pendingModel, setPendingModel] = React.useState<LocalModel | null>(
    null,
  );

  // Name of the model currently downloading, shown in an info dialog when the
  // user clicks a DIFFERENT model (one on-device download at a time). Null when
  // no such notice is showing.
  const [busyDownloadName, setBusyDownloadName] = React.useState<string | null>(
    null,
  );

  // The last on-device model whose download reported `completed`. Held sticky so
  // its row shows "installed" straight through the gap between the terminal
  // `completed` event and the /api/tags refresh landing — otherwise the completed
  // handler's checkStatus churns downloadState.status (completed → checking →
  // idle) first and the row flickers back to a "Download" button ("flashes
  // complete"). Only the latest completion needs bridging; earlier ones are
  // covered by `ollamaStatus.installed_models` once their refresh has landed.
  // The model THIS picker asked to download. Modal-local (not the shared, churny
  // download state) so it survives the hook's once-per-load reset / remounts /
  // reloads that wipe `downloadState.activeModel` — the pull's progress events
  // carry no model id, so once `activeModel` is lost nothing restores it and the
  // row can't recognize its own in-flight download (bar advances, row still says
  // "Download"). Cleared only on a terminal status, so the reset's transient
  // `idle` doesn't drop it mid-pull.
  const [requestedModel, setRequestedModel] = React.useState<string | null>(
    null,
  );
  React.useEffect(() => {
    if (
      downloadState.status === 'completed' ||
      downloadState.status === 'cancelled' ||
      downloadState.status === 'error'
    ) {
      setRequestedModel(null);
    }
  }, [downloadState.status]);

  // Which on-device model is downloading right now: prefer this picker's own
  // request, fall back to the shared state's id when present.
  const downloadingModel = requestedModel ?? downloadState.activeModel;

  const [lastCompleted, setLastCompleted] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (downloadState.status === 'completed' && downloadingModel) {
      setLastCompleted(downloadingModel);
    }
  }, [downloadState.status, downloadingModel]);

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
    const key = getProviderName(llmProvider.name);
    return LOCAL_MODELS.filter(
      (m) =>
        getProviderName(m.provider) === key &&
        m.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [isAvailable, llmProvider.name, searchQuery]);

  const switchLLMAllowed = canSwitchLLm(llmProvider);
  const switchProviderAllowed = canSwitchProvider(llms, llmProvider.name);

  // Only an actual pull counts as "busy". A status refresh ('checking') must NOT
  // — otherwise a stale `activeModel` makes a row flash a progress bar (and, with
  // the old graying, greyed the others) every time status is re-checked.
  const busyDownloading = downloadState.status === 'downloading';

  const statusFor = (m: LocalModel): LocalRowStatus => {
    if (localSel.enabled && localSel.model === m.id) return 'selected';
    const active = sameModel(downloadingModel, m.id);
    if (active && downloadState.status === 'error') return 'error';
    if (active && busyDownloading)
      return downloadState.progress > 0 ? 'downloading' : 'starting';
    // `lastCompleted` bridges the just-finished → tags-refreshed gap so the row
    // stays "installed" instead of flickering back to "Download".
    if (
      sameModel(lastCompleted, m.id) ||
      isModelInstalled(m.id, ollamaStatus?.installed_models)
    )
      return 'installed';
    return 'not-installed';
  };

  // A cloud model is "in use" when it's the mentor's selected LLM and local mode
  // is off.
  const isCloudActive = (llm: LLM): boolean =>
    mentorSettings?.llm_name === llm.llm_name &&
    mentorSettings?.llm_provider === llmProvider.name &&
    !localSel.enabled;

  // Order the WHOLE list — cloud + local — available (usable now) first,
  // unavailable last, with the in-use model leading. "Available" for a cloud
  // model means the provider is switchable (has credentials + models); for a
  // local model it's the install state. So an installed on-device model outranks
  // cloud models whose provider has no credentials. Ranked by state, not the
  // transient download status, so rows don't jump mid-pull; a stable sort keeps
  // the original (catalog) order within each rank.
  const cloudRank = (llm: LLM): number =>
    isCloudActive(llm) ? 0 : switchLLMAllowed && switchProviderAllowed ? 1 : 2;
  const localRank = (m: LocalModel): number => {
    const s = statusFor(m);
    return s === 'selected' ? 0 : s === 'installed' ? 1 : 2;
  };
  const sortedModels = [
    ...filteredLLMs.map((llm) => ({
      kind: 'cloud' as const,
      llm,
      rank: cloudRank(llm),
    })),
    ...localModels.map((model) => ({
      kind: 'local' as const,
      model,
      rank: localRank(model),
    })),
  ].sort((a, b) => a.rank - b.rank);

  // Preserve the "model may be too large" prompt before a download starts. Opens
  // the confirmation AlertDialog below (layered on top of the picker), rather
  // than a toast. `modelExceedsCapacity` compares the model's size to this
  // machine's RAM/VRAM; when memory is unknown it returns false, so the download
  // simply proceeds rather than blocking on incomplete data.
  const startLocalDownload = (m: LocalModel) => {
    if (modelExceedsCapacity(m, systemMemory)) {
      setPendingModel(m);
      return;
    }
    setRequestedModel(m.id);
    startDownload(m.id);
  };

  const activateLocal = (m: LocalModel, status: LocalRowStatus) => {
    switch (status) {
      case 'not-installed':
      case 'error':
        // Only one on-device model downloads at a time. If ANY pull is already
        // running, don't start another — starting concurrent pulls floods every
        // useModelDownload instance with progress events and can hang the app.
        // Block even when the running model is unknown (activeModel wiped); the
        // user cancels by clicking the downloading row itself. Selecting an
        // already-installed model is unaffected (it starts no pull).
        if (busyDownloading && !sameModel(downloadingModel, m.id)) {
          const dl = LOCAL_MODELS.find((x) => sameModel(x.id, downloadingModel));
          setBusyDownloadName(dl?.name ?? t('unnamedModel'));
          return;
        }
        startLocalDownload(m);
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
  const activeLocal = LOCAL_MODELS.find((m) => sameModel(m.id, downloadingModel));
  const liveMessage = !activeLocal
    ? ''
    : downloadState.status === 'completed'
      ? t('announceDownloaded', { modelName: activeLocal.name })
      : downloadState.status === 'cancelled'
        ? t('announceCancelled')
        : downloadState.status === 'error'
          ? t('announceFailed')
          : downloadState.status === 'checking' ||
              (downloadState.status === 'downloading' && downloadState.progress === 0)
            ? t('announceStarted', { modelName: activeLocal.name })
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
            {/* Cloud + on-device models in one availability-ranked list:
                available (usable now) first, unavailable (no credentials / needs
                download) last. */}
            {sortedModels.map((item) => {
            if (item.kind === 'cloud') {
              const llm = item.llm;
              const isActive = isCloudActive(llm);

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
                  key={`cloud-${llm.llm_name}`}
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
            }

            const m = item.model;
            const status = statusFor(m);
            return (
              <LocalModelRow
                key={`local-${m.id}`}
                name={m.name}
                size={m.size}
                logo={getLLMProviderDetails(llmProvider.name, m.name).logo}
                status={status}
                progress={
                  sameModel(downloadingModel, m.id) ? downloadState.progress : 0
                }
                onActivate={() => activateLocal(m, status)}
              />
            );
          })}
        </div>

        {/* "Model too large" confirmation — a dialog layered on top of the
            models page (not a toast), so it doesn't dismiss the picker and the
            confirm actually starts the download. */}
        <AlertDialog
          open={!!pendingModel}
          onOpenChange={(open) => {
            if (!open) setPendingModel(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('tooLargeTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('tooLargeDescription', {
                  modelName: pendingModel?.name ?? '',
                  modelSize: pendingModel?.size ?? '',
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPendingModel(null)}>
                {t('cancel')}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (pendingModel) {
                    setRequestedModel(pendingModel.id);
                    startDownload(pendingModel.id);
                  }
                  setPendingModel(null);
                }}
              >
                {t('downloadAnyway')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* "Another model is downloading" notice — shown when the user clicks a
            different model while one is pulling (one download at a time). The
            download is cancelled by clicking the downloading model itself. */}
        <AlertDialog
          open={!!busyDownloadName}
          onOpenChange={(open) => {
            if (!open) setBusyDownloadName(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('alreadyDownloadingTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('alreadyDownloadingDescription', {
                  modelName: busyDownloadName ?? '',
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setBusyDownloadName(null)}>
                {t('gotIt')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
