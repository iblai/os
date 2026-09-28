'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, Code2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AGENT_LABELS } from '@/components/chat-input-form/code-agents';

/** `list_code_agent_models`: what the agent offers, its own default, the saved pick. */
interface AgentModels {
  models: { id: string; name: string; description?: string | null }[];
  default: string | null;
  selected: string | null;
}

/** Radio value for "the agent's own default" — saved as no pick at all. */
const DEFAULT = '__default__';

/**
 * The top-left model control while Code runs on Codex or Claude Code: the
 * agent's own model list (from its ACP session, cached per agent), a pick
 * saved per machine and applied to live sessions without a respawn. Takes the
 * place of the mentor's LLM selector, which neither agent uses. Every failure
 * (older binary, not installed, signed out, probe timeout) shows inline with
 * Retry — never a silent fall-back to the cloud picker.
 */
export function AgentModelSelector({
  backend,
}: {
  backend: 'codex' | 'claude';
}) {
  const t = useTranslations('navBarIndex');
  const [data, setData] = useState<AgentModels | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh = false) => {
      setLoading(true);
      setError(null);
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        setData(
          await invoke<AgentModels>('list_code_agent_models', {
            backend,
            refresh,
          }),
        );
      } catch (e) {
        setData(null);
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [backend],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const choose = async (value: string) => {
    const model = value === DEFAULT ? null : value;
    const previous = data;
    setData((d) => (d ? { ...d, selected: model } : d));
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('set_code_agent_model', { backend, model });
    } catch (e) {
      setData(previous);
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const current = data?.models.find((m) => m.id === data.selected);
  const defaultEntry = data?.models.find((m) => m.id === data.default);
  // What "Default" resolves to: Claude's own "default" entry describes the
  // model it stands for; a concrete default (Codex, or a Claude settings
  // model) is named by its entry.
  const defaultName = defaultEntry
    ? defaultEntry.id === 'default'
      ? defaultEntry.description || defaultEntry.name
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

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex cursor-pointer items-center gap-1 text-sm font-medium text-[#646464] transition-colors hover:text-[#484848]"
              aria-label={t('agentModelSelector')}
              data-testid="code-agent-model-selector"
            >
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                ) : (
                  <Code2 className="h-4 w-4 text-gray-500" />
                )}
              </div>
              <span className="hidden max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap sm:block">
                {AGENT_LABELS[backend]} · {label}
              </span>
              <ChevronDown className="h-4 w-4 text-gray-500" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent className="ibl-tooltip-content" side="bottom">
          {tooltip}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        align="start"
        className="max-h-80 w-72 overflow-y-auto"
      >
        {error ? (
          <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs text-gray-500">
            <span className="min-w-0 break-words">{error}</span>
            <Button
              variant="outline"
              size="sm"
              type="button"
              className="h-6 shrink-0 px-2 text-[11px]"
              onClick={() => void load(true)}
            >
              {t('agentModelRetry')}
            </Button>
          </div>
        ) : data ? (
          <DropdownMenuRadioGroup
            value={data.selected ?? DEFAULT}
            onValueChange={(v) => void choose(v)}
          >
            <DropdownMenuRadioItem value={DEFAULT}>
              <span className="flex min-w-0 flex-col">
                <span>{t('agentModelDefault')}</span>
                {defaultName && (
                  <span className="truncate text-[11px] text-gray-400">
                    {defaultName}
                  </span>
                )}
              </span>
            </DropdownMenuRadioItem>
            {/* Claude lists its own "default" entry; the radio above is it. */}
            {data.models
              .filter((m) => m.id !== 'default')
              .map((m) => (
                <DropdownMenuRadioItem key={m.id} value={m.id}>
                  <span className="flex min-w-0 flex-col">
                    <span>{m.name}</span>
                    {m.description && (
                      <span className="truncate text-[11px] text-gray-400">
                        {m.description}
                      </span>
                    )}
                  </span>
                </DropdownMenuRadioItem>
              ))}
          </DropdownMenuRadioGroup>
        ) : (
          <div className="px-2 py-1.5 text-xs text-gray-500">
            {t('agentModelLoading')}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
