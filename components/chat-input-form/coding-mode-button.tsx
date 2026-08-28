'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Code2, Folder, Info, Loader2, X } from 'lucide-react';
import { getAuthItem } from '@iblai/iblai-js/web-utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useMentorSettings } from '@/hooks/use-mentors/use-mentor-settings';
import { isTauriOfflineMode } from '@/hooks/use-tauri-offline';
import { config } from '@/lib/config';
import type { OpencodeSkillSync } from '@/hooks/use-opencode-skill-sync';

const ENABLED_KEY = 'ibl_coding_mode_enabled';
const MODEL_KEY = 'ibl_coding_mode_model';
const FOLDER_CHOSEN_KEY = 'ibl_coding_mode_folder_chosen';
/** The on-device model the user picked in Local Models settings (see ollama-client). */
const LOCAL_LLM_MODEL_KEY = 'ibl_local_llm_model';
/**
 * Set by the Local Models toggle. This — NOT offline mode — is what the chat transport
 * (`use-chat-v2`) uses to route to an on-device model, so Code must read the same flag
 * or it will happily point at a cloud model while the rest of the app is local.
 */
const LOCAL_LLM_ENABLED_KEY = 'ibl_local_llm_enabled';

/** On-device when Local Models is on, or when the app is forced offline. */
function readLocalMode(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    localStorage.getItem(LOCAL_LLM_ENABLED_KEY) === 'true' ||
    isTauriOfflineMode()
  );
}

interface LocalModelCheck {
  runtime: 'ollama' | 'foundry' | 'cloud';
  /** Prefixed spec to persist as the Code model, e.g. "ollama/qwen3:latest". */
  spec: string;
  model: string;
  running: boolean;
  /** null = unknown (Foundry publishes no capability metadata). */
  tools_supported: boolean | null;
  reason: string;
}

// Shared so concurrent callers await ONE dynamic import. Concurrent imports of the
// same module must not race: under vitest's module mocking, the loser can resolve to
// the unmocked alias and reject every call it carries.
let tauriCore: Promise<typeof import('@tauri-apps/api/core')> | undefined;

async function callTauri<T = unknown>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const { invoke } = await (tauriCore ??= import('@tauri-apps/api/core'));
  return invoke<T>(cmd, args);
}

/**
 * Resolve the cloud model Code should use — EXACTLY the top-left mentor LLM
 * (`<provider>/<name>`), with a `matched` flag from validating it against the
 * tenant's compat `/v1/models`. There is NO substitution: an unprovisioned model is
 * returned as-is (Code turns will fail on it), so a broken selection fails loudly
 * rather than silently running a different model.
 */
async function resolveCodingModel(
  provider: string,
  name: string,
): Promise<{ model: string; matched: boolean }> {
  const model = `${provider}/${name}`;
  try {
    const tenant = getAuthItem('tenant') || '';
    const token = getAuthItem('dm_token') || '';
    if (!tenant || !token) return { model, matched: false };
    const res = await fetch(
      `${config.dmUrl()}/api/ai-mentor/orgs/${tenant}/v1/models`,
      { headers: { Authorization: `Token ${token}` } },
    );
    if (!res.ok) return { model, matched: false };
    const json = await res.json();
    const ids: string[] = Array.isArray(json?.data)
      ? json.data.map((m: { id?: string }) => m?.id).filter(Boolean)
      : [];
    return { model, matched: ids.includes(model) };
  } catch {
    return { model, matched: false };
  }
}

/**
 * Code (agentic coding via opencode/ACP) control — a desktop-only popover with the
 * on/off toggle + workspace folder selector. The SDK chat transport reads
 * `ibl_coding_mode_enabled` / `ibl_coding_mode_model` from localStorage.
 *
 * The workspace is **per chat**: `sessionId` keys it, the Rust side generates a folder
 * on first use, and the picker overrides it for this chat only. A chat with no session
 * id yet has no workspace to show, which is why the commands are skipped below.
 */
export function CodingModeButton({
  sessionId,
  skillSync,
}: {
  sessionId?: string;
  /** Skill sync state from useOpencodeSkillSync (mounted by the composer). */
  skillSync?: OpencodeSkillSync;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [enabled, setEnabled] = useState(
    () =>
      typeof window !== 'undefined' &&
      localStorage.getItem(ENABLED_KEY) === 'true',
  );
  const [workspace, setWorkspace] = useState('');
  const [resolvedModel, setResolvedModel] = useState('');
  const [modelMatched, setModelMatched] = useState(false);
  // null = unknown (status not fetched yet); true = Code can't run here at all —
  // the sandboxed MAS build or an unsupported platform (Windows) — so it's hidden.
  const [sandboxed, setSandboxed] = useState<boolean | null>(null);
  // false = this Linux host has no bubblewrap (the child sandbox): Code stays
  // visible but disabled, with a hint, until bwrap is installed.
  const [sandboxReady, setSandboxReady] = useState(true);

  const t = useTranslations('chatInputFormCodingModeButton');

  const { data: mentorSettings } = useMentorSettings();
  const llmProvider = mentorSettings?.llmProvider;
  const llmName = mentorSettings?.llmName;

  // An on-device model is active. Code supports these via Ollama / Foundry Local, but
  // only when the model can actually call tools. Kept in state and re-read on storage
  // changes — the user can flip Local Models while the app is open.
  const [isLocal, setIsLocal] = useState(readLocalMode);
  const [local, setLocal] = useState<LocalModelCheck | null>(null);
  const [localModelId, setLocalModelId] = useState('');

  useEffect(() => {
    const sync = () => {
      setIsLocal(readLocalMode());
      setLocalModelId(localStorage.getItem(LOCAL_LLM_MODEL_KEY) || '');
    };
    sync();
    window.addEventListener('storage', sync);
    // The app's useLocalStorage fans out same-tab writes on this custom event.
    window.addEventListener('local-storage', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('local-storage', sync);
    };
  }, [isOpen]);

  // opencode is agentic: without tool calling it can't edit files or run commands, so
  // it would look broken. Block on a definitive "no" (Ollama reports capabilities);
  // allow-with-warning when unknown (Foundry reports nothing).
  //
  // `unresolved` (the check hasn't answered yet) disables the switch but must NOT be
  // treated as a negative — clearing the persisted flag on a pending check would turn
  // Code off on every load in local mode.
  const localVerdictBad =
    isLocal && !!local && (!local.running || local.tools_supported === false);
  const blocked =
    !sandboxReady || (isLocal ? !local || localVerdictBad : false);

  const refresh = async () => {
    if (!sessionId) return;
    try {
      const ws = await callTauri<string>('get_opencode_workspace', {
        sessionId,
      });
      setWorkspace(ws || '');
    } catch {
      /* best-effort */
    }
  };

  useEffect(() => {
    if (isOpen) void refresh();
  }, [isOpen, sessionId]);

  // Force Code off whenever it can't run (runtime down, an on-device model with no
  // tool calling, or a Linux host missing bubblewrap) — the send path (SDK) reads
  // this flag, so clearing it routes back to normal chat instead of failing every turn.
  useEffect(() => {
    if (
      (localVerdictBad || !sandboxReady) &&
      localStorage.getItem(ENABLED_KEY) === 'true'
    ) {
      localStorage.setItem(ENABLED_KEY, 'false');
      window.dispatchEvent(new Event('local-storage'));
      setEnabled(false);
    }
  }, [localVerdictBad, sandboxReady]);

  // On-device: ask the backend which runtime serves the selected local model and
  // whether it can drive Code. Rust auto-detects Ollama vs Foundry Local.
  useEffect(() => {
    if (!isLocal || sandboxed !== false) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await callTauri<LocalModelCheck>('check_code_local_model', {
          model:
            localModelId || localStorage.getItem(LOCAL_LLM_MODEL_KEY) || '',
        });
        if (cancelled || !res) return;
        setLocal(res);
        // The prefixed spec is what routes the spawn to the local runtime.
        if (res.running && res.tools_supported !== false && res.spec) {
          localStorage.setItem(MODEL_KEY, res.spec);
          setResolvedModel(res.spec);
          setModelMatched(true);
        }
      } catch {
        /* best-effort */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLocal, sandboxed, enabled, isOpen, localModelId]);

  // Cloud: keep Code's model matched to the top-left mentor LLM (validated) whenever
  // it changes, while Code is on or the popover is open.
  useEffect(() => {
    if (isLocal || (!enabled && !isOpen) || !llmProvider || !llmName) return;
    let cancelled = false;
    void (async () => {
      const { model, matched } = await resolveCodingModel(llmProvider, llmName);
      if (cancelled) return;
      localStorage.setItem(MODEL_KEY, model);
      setResolvedModel(model);
      setModelMatched(matched);
    })();
    return () => {
      cancelled = true;
    };
  }, [isLocal, enabled, isOpen, llmProvider, llmName]);

  // Detect environments where Code can't run, once. The sandboxed (Mac App Store)
  // build and unsupported platforms (Windows) hide it entirely; a Linux host
  // missing bubblewrap keeps it visible but disabled until bwrap is installed.
  // Absent fields (an older backend) read as supported/ready.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const st = await callTauri<{
          sandboxed?: boolean;
          supported?: boolean;
          sandbox_ready?: boolean;
        }>('check_opencode_status');
        if (cancelled) return;
        setSandboxed(!!st?.sandboxed || st?.supported === false);
        setSandboxReady(st?.sandbox_ready !== false);
      } catch {
        if (!cancelled) setSandboxed(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Default Code ON for logged-in desktop users (once). Respects an explicit prior
  // choice, skips the sandboxed build + on-device-model (blocked) case, and does NOT
  // prompt for a folder — the default workspace is used until the user changes it.
  useEffect(() => {
    if (sandboxed !== false || blocked) return;
    if (localStorage.getItem(ENABLED_KEY) !== null) return;
    const loggedIn =
      !!localStorage.getItem('tenant') && !!localStorage.getItem('dm_token');
    if (!loggedIn) return;
    localStorage.setItem(ENABLED_KEY, 'true');
    window.dispatchEvent(new Event('local-storage'));
    setEnabled(true);
    if (isLocal && local?.spec) {
      localStorage.setItem(MODEL_KEY, local.spec);
    } else if (!isLocal && llmProvider && llmName) {
      localStorage.setItem(MODEL_KEY, `${llmProvider}/${llmName}`);
    }
    // Prep opencode in the background so the first turn is ready (best-effort).
    callTauri('install_opencode').catch(() => {});
  }, [sandboxed, blocked, isLocal, local?.spec, llmProvider, llmName]);

  // Native folder picker → persist via set_opencode_workspace (which mkdir -p's +
  // git init's the folder).
  const pickFolder = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        directory: true,
        multiple: false,
        defaultPath: workspace || undefined,
        title: t('chooseFolderTitle'),
      });
      const path = typeof selected === 'string' ? selected : null;
      if (path && sessionId) {
        const saved = await callTauri<string>('set_opencode_workspace', {
          sessionId,
          path,
        });
        setWorkspace(saved || path);
        localStorage.setItem(FOLDER_CHOSEN_KEY, 'true');
      }
    } catch (e) {
      console.error('[coding-mode] folder pick failed', e);
    }
  };

  const toggle = async (next: boolean) => {
    if (blocked) return; // can't enable Code while a local model is active
    setEnabled(next);
    localStorage.setItem(ENABLED_KEY, next ? 'true' : 'false');
    // Plain setItem doesn't notify the same tab — fan out on the app's custom
    // event so the skill-sync hook starts (or idles) the moment Code flips.
    window.dispatchEvent(new Event('local-storage'));
    if (!next) return;
    // Seed the model with the EXACT current selection (no default) so the send path
    // never substitutes; the resolve effects then flag whether it's actually usable.
    if (isLocal && local?.spec) {
      localStorage.setItem(MODEL_KEY, local.spec);
    } else if (!isLocal && llmProvider && llmName) {
      localStorage.setItem(MODEL_KEY, `${llmProvider}/${llmName}`);
    }
    // First enable → force a deliberate folder choice immediately.
    if (!localStorage.getItem(FOLDER_CHOSEN_KEY)) {
      await pickFolder();
    }
    // Prep the coding agent (download + config + git-init the workspace), best-effort.
    try {
      await callTauri('install_opencode');
    } catch (e) {
      console.error('[coding-mode] install failed', e);
    }
    void refresh();
  };

  const active = enabled || isOpen;
  // The pill's spinner covers SKILLS loading (mentor sync + vibe fetch), never
  // the opencode binary install — skills are what the next turn would miss.
  const skillsLoading = enabled && skillSync?.state === 'syncing';

  // Hidden where opencode can never be spawned: the sandboxed Mac App Store build
  // and unsupported platforms (Windows). (Desktop-only gating happens in the parent,
  // which won't mount this outside Tauri.)
  if (sandboxed) return null;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              aria-busy={skillsLoading}
              className={`flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm transition-all duration-200 ${
                active
                  ? 'border border-[#D0E0FF] bg-[#F5F8FF] text-[#38A1E5]'
                  : 'text-gray-600 hover:border hover:border-[#D0E0FF] hover:bg-[#F5F8FF]'
              }`}
            >
              <span className={active ? 'text-[#38A1E5]' : 'text-gray-600'}>
                {skillsLoading ? (
                  <Loader2
                    data-testid="code-skills-loading"
                    className="h-4 w-4 animate-spin"
                  />
                ) : (
                  <Code2 className="h-4 w-4" />
                )}
              </span>
              {t('code')}
              {isOpen && (
                <X
                  className="ml-1 h-3 w-3 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                  }}
                />
              )}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        {!isOpen && (
          <TooltipContent className="ibl-tooltip-content">
            {t('tooltip')}
          </TooltipContent>
        )}
      </Tooltip>
      <PopoverContent
        align="start"
        className="w-96 rounded-lg border border-gray-200 bg-white p-4 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-[#38A1E5]" />
            <span className="text-sm font-medium text-gray-900">
              {t('code')}
            </span>
          </div>
          <Switch
            checked={enabled && !blocked}
            disabled={blocked}
            onCheckedChange={toggle}
          />
        </div>
        <p className="mt-1 text-xs text-gray-500">{t('description')}</p>

        {/* Only the states that need acting on. Which model Code uses is already the
            mentor LLM shown in the top-left, so repeating it here was noise — but a
            model that will FAIL every turn still has to say so. A missing bwrap
            outranks the model states: nothing can spawn until it's installed. */}
        {!sandboxReady ? (
          <div
            data-testid="code-sandbox-missing"
            className="mt-2 flex items-start gap-1.5 text-[11px] text-gray-400"
          >
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{t('sandboxMissing')}</span>
          </div>
        ) : isLocal && blocked ? (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-700">
            {local?.reason || t('checkingLocalModel')}
            {local?.tools_supported === false && (
              <>{t('tryToolCapableModel')}</>
            )}
          </div>
        ) : isLocal ? (
          <div className="mt-2 text-[11px] text-gray-400">
            <div>{t('firstRunSlow')}</div>
            {local?.tools_supported === null && local?.reason && (
              <div className="mt-1 text-amber-600">{local.reason}</div>
            )}
          </div>
        ) : resolvedModel && !modelMatched ? (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-700">
            <span className="font-mono">{resolvedModel}</span>{' '}
            {t('modelUnavailable')}
          </div>
        ) : null}

        <div className="mt-3 rounded-md border border-gray-200 p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
            <Folder className="h-3.5 w-3.5" />
            {t('workspace')}
          </div>
          <div className="mt-2 font-mono text-xs break-all text-gray-800">
            {workspace || '—'}
          </div>
          <Button
            variant="outline"
            size="sm"
            type="button"
            className="mt-3 h-7 text-xs"
            onClick={pickFolder}
          >
            {t('changeFolder')}
          </Button>
        </div>

        {/* Error-only surface: the happy path adds no UI, but a failed skill
            sync (skills catalog 403s for some users, network, vibe missing
            with no cache) must not leave the agent silently skill-less. */}
        {enabled && skillSync?.state === 'error' && (
          <div
            data-testid="code-skills-sync"
            className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-700"
          >
            {t('skillsSyncFailed')}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
