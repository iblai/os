'use client';

import { useEffect, useState } from 'react';
import { Code2, Folder, X } from 'lucide-react';
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
    localStorage.getItem(LOCAL_LLM_ENABLED_KEY) === 'true' || isTauriOfflineMode()
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

async function callTauri<T = unknown>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
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
    const tenant = localStorage.getItem('tenant') || '';
    const token = localStorage.getItem('dm_token') || '';
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
 * `ibl_coding_mode_enabled` / `ibl_coding_mode_model` from localStorage; the
 * workspace is persisted by the Rust `set_opencode_workspace` command.
 */
export function CodingModeButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [enabled, setEnabled] = useState(
    () =>
      typeof window !== 'undefined' &&
      localStorage.getItem(ENABLED_KEY) === 'true',
  );
  const [workspace, setWorkspace] = useState('');
  const [resolvedModel, setResolvedModel] = useState('');
  const [modelMatched, setModelMatched] = useState(false);
  // null = unknown (status not fetched yet); true = sandboxed MAS build (Code hidden).
  const [sandboxed, setSandboxed] = useState<boolean | null>(null);

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
  const blocked = isLocal ? !local || localVerdictBad : false;

  const refresh = async () => {
    try {
      const ws = await callTauri<string>('get_opencode_workspace');
      setWorkspace(ws || '');
    } catch {
      /* best-effort */
    }
  };

  useEffect(() => {
    if (isOpen) void refresh();
  }, [isOpen]);

  // Force Code off whenever it can't run (runtime down, or an on-device model with no
  // tool calling) — the send path (SDK) reads this flag, so clearing it routes back to
  // normal chat instead of failing every turn.
  useEffect(() => {
    if (localVerdictBad && localStorage.getItem(ENABLED_KEY) === 'true') {
      localStorage.setItem(ENABLED_KEY, 'false');
      setEnabled(false);
    }
  }, [localVerdictBad]);

  // On-device: ask the backend which runtime serves the selected local model and
  // whether it can drive Code. Rust auto-detects Ollama vs Foundry Local.
  useEffect(() => {
    if (!isLocal || sandboxed !== false) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await callTauri<LocalModelCheck>('check_code_local_model', {
          model: localModelId || localStorage.getItem(LOCAL_LLM_MODEL_KEY) || '',
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

  // Detect the sandboxed (Mac App Store) build once — Code can't spawn the opencode
  // binary there, so it's hidden entirely.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const st = await callTauri<{ sandboxed?: boolean }>(
          'check_opencode_status',
        );
        if (!cancelled) setSandboxed(!!st?.sandboxed);
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
        title: 'Choose your workspace folder',
      });
      const path = typeof selected === 'string' ? selected : null;
      if (path) {
        const saved = await callTauri<string>('set_opencode_workspace', {
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

  // Hidden in the sandboxed Mac App Store build, where opencode can't be spawned at
  // all. (Desktop-only gating happens in the parent, which won't mount this outside
  // Tauri.)
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
              className={`flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm transition-all duration-200 ${
                active
                  ? 'border border-[#D0E0FF] bg-[#F5F8FF] text-[#38A1E5]'
                  : 'text-gray-600 hover:border hover:border-[#D0E0FF] hover:bg-[#F5F8FF]'
              }`}
            >
              <span className={active ? 'text-[#38A1E5]' : 'text-gray-600'}>
                <Code2 className="h-4 w-4" />
              </span>
              Code
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
            An agentic coding tool for your project folder
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
            <span className="text-sm font-medium text-gray-900">Code</span>
          </div>
          <Switch
            checked={enabled && !blocked}
            disabled={blocked}
            onCheckedChange={toggle}
          />
        </div>
        <p className="mt-1 text-xs text-gray-500">
          An agentic coding tool that edits files, runs commands, and commits
          changes in the folder you choose.
        </p>

        {isLocal && blocked ? (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-700">
            {local?.reason ||
              'Checking whether your on-device model can run Code…'}
            {local?.tools_supported === false && (
              <> Try a tool-capable model such as qwen3, llama3.2 or phi4-mini.</>
            )}
          </div>
        ) : isLocal ? (
          <div className="mt-2 text-[11px] text-gray-400">
            Model:{' '}
            <span className="font-mono text-gray-500">{local?.model}</span>{' '}
            (on-device)
            <div className="mt-1">
              First run can take a few minutes while the model loads.
            </div>
            {local?.tools_supported === null && local?.reason && (
              <div className="mt-1 text-amber-600">{local.reason}</div>
            )}
          </div>
        ) : resolvedModel && !modelMatched ? (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-700">
            <span className="font-mono">{resolvedModel}</span> isn’t available
            for Code — turns will fail. Pick a different model in the top-left.
          </div>
        ) : (
          <div className="mt-2 text-[11px] text-gray-400">
            Model:{' '}
            <span className="font-mono text-gray-500">
              {resolvedModel || 'matching your selected LLM…'}
            </span>
          </div>
        )}

        <div className="mt-3 rounded-md border border-gray-200 p-2.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
            <Folder className="h-3.5 w-3.5" />
            Workspace
          </div>
          <div className="mt-1 font-mono text-xs break-all text-gray-800">
            {workspace || '—'}
          </div>
          <Button
            variant="outline"
            size="sm"
            type="button"
            className="mt-2 h-7 text-xs"
            onClick={pickFolder}
          >
            Change folder…
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
