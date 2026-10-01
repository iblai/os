'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Bot, ChevronDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLlmProviderCatalogue } from '@iblai/iblai-js/web-containers';
import {
  LLMProviderModal,
  type LLMProvider,
} from '@iblai/iblai-js/web-containers/next';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AGENT_LABELS } from '@/components/chat-input-form/code-agents';
import { useLlmProviderModalLabels } from '@/components/modals/edit-mentor-modal/llm-provider-modal-labels';
import { useUsername } from '@/hooks/use-user';
import { TenantKeyMentorIdParams } from '@/lib/types';

/** `list_code_agent_models`: what the agent offers, its own default, the saved pick. */
interface AgentModels {
  models: { id: string; name: string; description?: string | null }[];
  default: string | null;
  selected: string | null;
}

/** The Default row's wire key — saved as no pick at all. */
const DEFAULT = '__default__';

/** The catalogue provider whose logo stands for each agent. */
const PROVIDER_OF = { codex: 'openai', claude: 'anthropic' } as const;

/**
 * The top-left model control while Code runs on Codex or Claude Code: the
 * agent's own model list (from its ACP session, cached per agent) in the SDK's
 * LLM Selection dialog — the one the cloud picker opens behind a provider card
 * — in its `cloudOnly` mode, since these models are not the mentor's LLM and
 * must leave the device's Local Models setting alone. A pick is saved per
 * machine and applied to live sessions without a respawn. A list that fails to
 * load (older binary, not installed, signed out, probe timeout) shows on the
 * button with its reason in the tooltip, and the click retries — never a
 * silent fall-back to the cloud picker.
 */
export function AgentModelSelector({
  backend,
}: {
  backend: 'codex' | 'claude';
}) {
  const t = useTranslations('navBarIndex');
  const labels = useLlmProviderModalLabels();
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const username = useUsername();
  const resolveProvider = useLlmProviderCatalogue({
    org: tenantKey,
    userId: username,
    mentorId,
  });
  const logo = resolveProvider(PROVIDER_OF[backend]).logo;
  const [data, setData] = useState<AgentModels | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  // The latest request owns the state: a slow answer for the agent shown
  // before a switch must not land as the current agent's list.
  const seq = useRef(0);

  const load = useCallback(
    async (refresh = false) => {
      const mine = ++seq.current;
      setLoading(true);
      setError(null);
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const models = await invoke<AgentModels>('list_code_agent_models', {
          backend,
          refresh,
        });
        if (mine === seq.current) setData(models);
      } catch (e) {
        if (mine !== seq.current) return;
        setData(null);
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    },
    [backend],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const choose = async (id: string) => {
    const model = id === DEFAULT ? null : id;
    const previous = data;
    setData((d) => (d ? { ...d, selected: model } : d));
    setSaving(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('set_code_agent_model', { backend, model });
    } catch (e) {
      setData(previous);
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const name = AGENT_LABELS[backend];
  const current = data?.models.find((m) => m.id === data.selected);
  const defaultEntry = data?.models.find((m) => m.id === data.default);
  // What "Default" resolves to: Claude's own "default" entry describes the
  // model it stands for (nothing to add when it doesn't); a concrete default
  // (a Claude settings model) is named by its entry; Codex's catalog names
  // none.
  const defaultName = defaultEntry
    ? defaultEntry.id === 'default'
      ? defaultEntry.description || null
      : defaultEntry.name
    : null;
  const label =
    loading && !data
      ? t('agentModelLoading')
      : error
        ? t('agentModelError')
        : data?.selected
          ? (current?.name ?? data.selected)
          : t('agentModelDefault');
  const tooltip =
    error ??
    (data?.selected ? current?.description || label : defaultName || label);

  // The agent as the dialog's one provider: the Default row first (Claude's
  // own "default" entry is that row, not a second one), then the agent's list
  // as it names it.
  const provider: LLMProvider | null = data && {
    id: 0,
    name,
    logo,
    has_credentials: true,
    chat_models: [
      {
        llm_name: DEFAULT,
        display_name: defaultName
          ? `${t('agentModelDefault')} (${defaultName})`
          : t('agentModelDefault'),
        description: '',
        is_multimodal: false,
        training_data: '',
        context_window: '',
      },
      ...data.models
        .filter((m) => m.id !== 'default')
        .map((m) => ({
          llm_name: m.id,
          display_name: m.name,
          description: m.description ?? '',
          is_multimodal: false,
          training_data: '',
          context_window: '',
        })),
    ],
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            className="flex cursor-pointer items-center gap-1 text-sm font-medium text-[#646464] transition-colors hover:text-[#484848]"
            aria-label={t('agentModelSelector')}
            data-testid="code-agent-model-selector"
            disabled={loading && !data}
            onClick={() => (error ? void load(true) : setOpen(true))}
          >
            <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
              ) : logo ? (
                <Image
                  src={logo}
                  alt={`${name} model logo`}
                  className="h-5 w-5 object-contain"
                  height={32}
                  width={32}
                  loading="lazy"
                />
              ) : (
                <Bot />
              )}
            </div>
            <span className="hidden max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap sm:block">
              {name} · {label}
            </span>
            <ChevronDown className="h-4 w-4 text-gray-500" />
          </Button>
        </TooltipTrigger>
        <TooltipContent className="ibl-tooltip-content" side="bottom">
          {tooltip}
        </TooltipContent>
      </Tooltip>
      {data && provider && (
        <LLMProviderModal
          cloudOnly
          isOpen={open}
          onClose={() => setOpen(false)}
          onSelect={(_, id) => choose(id)}
          llmProvider={provider}
          isSelecting={saving}
          mentorSettings={{
            llm_name: data.selected ?? DEFAULT,
            llm_provider: name,
          }}
          llms={[provider]}
          labels={labels}
        />
      )}
    </>
  );
}
