'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Code2, Folder, Info, Loader2, X } from 'lucide-react';
import {
  useGetUserPlatformMetadataQuery,
  useUpdateUserPlatformMetadataMutation,
} from '@iblai/iblai-js/data-layer';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useMentorSettings } from '@/hooks/use-mentors/use-mentor-settings';
import { isTauriOfflineMode } from '@/hooks/use-tauri-offline';
import { config } from '@/lib/config';
import { getUserOS } from '@/lib/utils';
import type { OpencodeSkillSync } from '@/hooks/use-opencode-skill-sync';

const ENABLED_KEY = 'ibl_coding_mode_enabled';
const MODEL_KEY = 'ibl_coding_mode_model';
const FOLDER_CHOSEN_KEY = 'ibl_coding_mode_folder_chosen';
/** Mentor the composer is bound to — written by useOpencodeSkillSync. */
const MENTOR_KEY = 'ibl_coding_mode_mentor';
/** The one top-level user-metadata key code mode owns. */
const METADATA_KEY = 'code_mode';
/** The on-device model the user picked in Local Models settings (see ollama-client). */
const LOCAL_LLM_MODEL_KEY = 'ibl_local_llm_model';
/**
 * Set by the Local Models toggle. This — NOT offline mode — is what the chat transport
 * (`use-chat-v2`) uses to route to an on-device model, so Code must read the same flag
 * or it will happily point at a cloud model while the rest of the app is local.
 */
const LOCAL_LLM_ENABLED_KEY = 'ibl_local_llm_enabled';

/**
 * Whether Code asks before each operation (`manual`) or approves them all
 * (`auto`). Absent = the user has never chosen, which is what raises the
 * first-run dialog: there is deliberately no default, because either answer
 * picks a security posture on their behalf.
 */
type PermissionMode = 'manual' | 'auto';

function isMode(v: unknown): v is PermissionMode {
  return v === 'manual' || v === 'auto';
}

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
 * True on Tauri mobile (iOS/Android). Mobile Code runs against a PAIRED
 * desktop's opencode server (the phone's Rust side proxies the `opencode_*`
 * commands over HTTP+SSE), so mobile skips `check_opencode_status` — that
 * probe is desktop-only — and gates on the pairing state instead.
 */
async function isTauriMobile(): Promise<boolean> {
  try {
    const { platform } = await import('@tauri-apps/plugin-os');
    const os = platform();
    return os === 'ios' || os === 'android';
  } catch {
    return false;
  }
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
 * Code (agentic coding via opencode) control — the on/off toggle plus, on
 * desktop, the workspace folder selector and the phone-access host, and, on
 * Tauri mobile, the pairing form for connecting to that host. The SDK chat
 * transport reads `ibl_coding_mode_enabled` / `ibl_coding_mode_model` (and, on
 * mobile, `ibl_remote_code_ready`) from localStorage.
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
  // Linux: name of the app that actually opens folders (the inode/directory
  // default, probed by the backend); null → generic "Open Folder" label.
  const [fileManager, setFileManager] = useState<string | null>(null);
  // undefined = not read yet, null = never chosen (→ first-run dialog).
  const [permissionMode, setPermissionMode] = useState<
    PermissionMode | null | undefined
  >(undefined);
  // Tauri mobile: Code runs against a paired desktop's opencode server. The
  // pairing state gates everything; the SDK reads the mirrored localStorage
  // flag (ibl_remote_code_ready) at send time.
  const [mobile, setMobile] = useState(false);
  const [remoteHost, setRemoteHost] = useState<{
    configured: boolean;
    connected: boolean;
    url?: string;
    directory?: string;
  } | null>(null);
  const [hostUrl, setHostUrl] = useState('');
  const [hostPassword, setHostPassword] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');
  // Desktop: the phone-access server (opencode serve) pairing info.
  const [phoneAccess, setPhoneAccess] = useState<{
    running: boolean;
    urls: string[];
    password?: string | null;
  } | null>(null);
  const [phoneAccessBusy, setPhoneAccessBusy] = useState(false);
  const [pairingQr, setPairingQr] = useState('');
  // null = picker closed; [] = open but empty/loading.
  const [folderList, setFolderList] = useState<
    { name: string; path: string }[] | null
  >(null);
  const [folderBusy, setFolderBusy] = useState(false);

  const t = useTranslations('chatInputFormCodingModeButton');

  const tenantKey =
    typeof window === 'undefined' ? '' : localStorage.getItem('tenant') || '';
  const mentorUniqueId =
    typeof window === 'undefined' ? '' : localStorage.getItem(MENTOR_KEY) || '';

  // The mode is a per-user preference, so it lives in DM and follows the user
  // to their other machines; the Rust side keeps a local copy that survives a
  // cold start and an offline launch.
  const { data: platformMetadata } = useGetUserPlatformMetadataQuery(
    { tenantKey },
    { skip: !tenantKey },
  );
  const [saveMetadata] = useUpdateUserPlatformMetadataMutation();
  const savedCodeMode = (platformMetadata?.metadata?.[METADATA_KEY] ?? {}) as
    | Record<string, unknown>
    | undefined;

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
    !sandboxReady ||
    (isLocal ? !local || localVerdictBad : false) ||
    (mobile && !remoteHost?.connected);

  /** Refresh the phone↔desktop pairing state and mirror it for the SDK. */
  const refreshRemoteHost = async () => {
    try {
      const h = await callTauri<{
        configured: boolean;
        connected: boolean;
        url?: string;
        directory?: string;
      }>('remote_code_get_host');
      setRemoteHost(h);
      const ready = !!h?.configured && !!h?.connected;
      localStorage.setItem('ibl_remote_code_ready', ready ? 'true' : 'false');
      window.dispatchEvent(new Event('local-storage'));
      // NOTE: deliberately no setWorkspace(h.directory) here — that's the
      // SERVER default (the shared phone project) and this probe resolves
      // late, clobbering the per-chat folder that refresh() just displayed.
    } catch {
      /* best-effort */
    }
  };

  useEffect(() => {
    if (!mobile) return;
    void refreshRemoteHost();
  }, [mobile, isOpen]);

  /** Try candidate addresses in order until one answers with this password. */
  const pairWith = async (
    urls: string[],
    password: string,
    mgmt?: string[],
  ) => {
    setConnecting(true);
    setConnectError('');
    try {
      let lastError = '';
      for (const url of urls) {
        try {
          // `urls` rides along so the phone remembers EVERY address this
          // desktop advertises and can fail over when one stops answering.
          await callTauri('remote_code_set_host', {
            url,
            password,
            mgmt,
            urls,
          });
          setHostPassword('');
          await refreshRemoteHost();
          return;
        } catch (e) {
          lastError = e instanceof Error ? e.message : String(e);
        }
      }
      setConnectError(lastError || 'no address answered');
    } finally {
      setConnecting(false);
    }
  };

  const connectToDesktop = () =>
    pairWith([hostUrl.trim()], hostPassword.trim());

  /** Scan the desktop's pairing QR (payload: `iblcode1:{"urls":[…],"password":…}`). */
  const scanPairingQr = async () => {
    setConnectError('');
    try {
      const scanner = await import('@tauri-apps/plugin-barcode-scanner');
      const perm = await scanner.checkPermissions();
      if (perm !== 'granted') {
        const asked = await scanner.requestPermissions();
        if (asked !== 'granted') {
          setConnectError(t('cameraDenied'));
          return;
        }
      }
      const result = await scanner.scan({
        windowed: false,
        formats: [scanner.Format.QRCode],
      });
      const content = result?.content ?? '';
      if (!content.startsWith('iblcode1:')) {
        setConnectError(t('notAPairingCode'));
        return;
      }
      const payload = JSON.parse(content.slice('iblcode1:'.length)) as {
        urls?: string[];
        password?: string;
        mgmt?: string[];
      };
      const urls = (payload.urls ?? []).filter(Boolean);
      if (!urls.length || !payload.password) {
        setConnectError(t('notAPairingCode'));
        return;
      }
      await pairWith(urls, payload.password, payload.mgmt);
    } catch (e) {
      // A dismissed scanner rejects too — show it small, not as a failure toast.
      setConnectError(e instanceof Error ? e.message : String(e));
    }
  };

  const openFolderPicker = async () => {
    setFolderBusy(true);
    try {
      const res = await callTauri<{
        workspaces?: { name: string; path: string }[];
      }>('remote_code_list_workspaces');
      setFolderList(res?.workspaces ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setFolderBusy(false);
    }
  };

  const chooseRemoteFolder = async (path: string) => {
    if (!sessionId) return;
    setFolderBusy(true);
    try {
      await callTauri('set_opencode_workspace', {
        sessionId,
        path,
        tenant: tenantKey || undefined,
        mentor: mentorUniqueId || undefined,
      });
      setWorkspace(path);
      setFolderList(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setFolderBusy(false);
    }
  };

  const newRemoteFolder = async () => {
    if (!sessionId) return;
    setFolderBusy(true);
    try {
      const dir = await callTauri<string>('new_opencode_workspace', {
        sessionId,
        tenant: tenantKey || undefined,
        mentor: mentorUniqueId || undefined,
      });
      if (dir) setWorkspace(dir);
      setFolderList(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setFolderBusy(false);
    }
  };

  const disconnectFromDesktop = async () => {
    try {
      await callTauri('remote_code_clear_host');
    } catch {
      /* best-effort */
    }
    await refreshRemoteHost();
  };

  // Desktop: phone access that was ON before the app restarted comes back up
  // by itself — otherwise every desktop restart silently bricks the paired
  // phones (their stored password stops matching a server that isn't there).
  useEffect(() => {
    if (mobile || sandboxed !== false) return;
    let cancelled = false;
    void (async () => {
      try {
        const st = await callTauri<{ running: boolean; auto_enable?: boolean }>(
          'remote_code_status',
        );
        if (cancelled || !st?.auto_enable) return;
        await callTauri('remote_code_enable', {
          tenant: localStorage.getItem('tenant') || '',
          token: localStorage.getItem('dm_token') || '',
        });
      } catch {
        /* best-effort; the popover's Enable button remains */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mobile, sandboxed]);

  // Desktop: load the phone-access server state whenever the popover opens.
  useEffect(() => {
    if (!isOpen || mobile || sandboxed !== false) return;
    let cancelled = false;
    void (async () => {
      try {
        const st = await callTauri<{
          running: boolean;
          urls: string[];
          password?: string | null;
        }>('remote_code_status');
        // Guard against a backend without the command (returns nothing).
        if (!cancelled && st && typeof st.running === 'boolean') {
          setPhoneAccess(st);
          if (st.running) {
            // Idempotent re-enable = refresh the held sign-in token. It
            // expires, and a stale one leaves phone turns silently retrying.
            void callTauri('remote_code_enable', {
              tenant: localStorage.getItem('tenant') || '',
              token: localStorage.getItem('dm_token') || '',
            }).catch(() => {});
          }
        }
      } catch {
        /* older backend: leave the section hidden */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, mobile, sandboxed]);

  // The pairing QR follows the server state: fetch when running, drop when not.
  useEffect(() => {
    if (mobile || !phoneAccess?.running) {
      setPairingQr('');
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const svg = await callTauri<string>('remote_code_pairing_qr');
        if (!cancelled && svg) setPairingQr(svg);
      } catch {
        /* QR is sugar; the address+password stay visible */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mobile, phoneAccess?.running]);

  const togglePhoneAccess = async () => {
    setPhoneAccessBusy(true);
    try {
      if (phoneAccess?.running) {
        await callTauri('remote_code_disable');
        setPhoneAccess({ running: false, urls: [] });
      } else {
        const st = await callTauri<{
          running: boolean;
          urls: string[];
          password?: string | null;
        }>('remote_code_enable', {
          tenant: localStorage.getItem('tenant') || '',
          token: localStorage.getItem('dm_token') || '',
        });
        setPhoneAccess(st);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setPhoneAccessBusy(false);
    }
  };

  const refresh = async () => {
    // Mobile mints/records folders keyed by mentor, so even an unsaved chat
    // (no session id yet) can show its real folder; desktop still needs the
    // id (its workspace map is chat-keyed).
    if (!sessionId && !mobile) return;
    try {
      const ws = await callTauri<string>('get_opencode_workspace', {
        sessionId: sessionId ?? '',
        tenant: tenantKey || undefined,
        mentor: mentorUniqueId || undefined,
      });
      setWorkspace(ws || '');
    } catch {
      /* best-effort */
    }
  };

  useEffect(() => {
    if (isOpen) void refresh();
  }, [isOpen, sessionId, tenantKey, mentorUniqueId]);

  // Read the locally cached mode first so the popover renders the real value
  // immediately; DM reconciles below. Only ever `null` once — that's the signal
  // to ask.
  useEffect(() => {
    if (permissionMode !== undefined) return;
    void (async () => {
      try {
        const saved = await callTauri<string | null>(
          'get_opencode_permission_mode',
        );
        // Only fill a still-empty value: this read is async, and DM (below) is
        // the source of truth — landing late must not undo it.
        setPermissionMode((prev) =>
          prev === undefined ? (isMode(saved) ? saved : null) : prev,
        );
      } catch {
        setPermissionMode((prev) => (prev === undefined ? null : prev));
      }
    })();
  }, [permissionMode]);

  // DM is the source of truth, so a value from another machine wins over the
  // local cache. Once only: the PATCH below invalidates this query, and without
  // the guard that refetch would fight a user who just changed their mind.
  const reconciled = useRef(false);
  useEffect(() => {
    if (reconciled.current || !platformMetadata) return;
    reconciled.current = true;
    const remote = savedCodeMode?.permission_mode;
    if (!isMode(remote) || remote === permissionMode) return;
    setPermissionMode(remote);
    callTauri('set_opencode_permission_mode', { mode: remote }).catch(() => {});
  }, [platformMetadata, savedCodeMode, permissionMode]);

  /** Record the choice locally (Rust enforces it) and in DM (it follows the user). */
  const chooseMode = async (mode: PermissionMode) => {
    setPermissionMode(mode);
    try {
      await callTauri('set_opencode_permission_mode', { mode });
    } catch (e) {
      console.error('[coding-mode] could not apply permission mode', e);
    }
    if (!tenantKey) return;
    try {
      // Send only our own top-level key: the endpoint shallow-merges, so
      // siblings (language, …) survive, and spreading the stored object keeps
      // any future code_mode sub-key of ours.
      await saveMetadata({
        tenantKey,
        metadata: {
          [METADATA_KEY]: { ...savedCodeMode, permission_mode: mode },
        },
      }).unwrap();
    } catch (e) {
      // Keep the local choice rather than reverting under the user; the next
      // change re-sends it.
      console.error('[coding-mode] could not save permission mode', e);
    }
  };

  // Force Code off whenever it can't run (runtime down, an on-device model with no
  // tool calling, or a Linux host missing bubblewrap) — the send path (SDK) reads
  // this flag, so clearing it routes back to normal chat instead of failing every turn.
  useEffect(() => {
    // On mobile, an un-paired (or unreachable) desktop also forces Code off:
    // sends would fail every turn otherwise.
    const mobileDisconnected =
      mobile && remoteHost !== null && !remoteHost.connected;
    if (
      (localVerdictBad || !sandboxReady || mobileDisconnected) &&
      localStorage.getItem(ENABLED_KEY) === 'true'
    ) {
      localStorage.setItem(ENABLED_KEY, 'false');
      window.dispatchEvent(new Event('local-storage'));
      setEnabled(false);
    }
  }, [localVerdictBad, sandboxReady, mobile, remoteHost]);

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
      if (await isTauriMobile()) {
        // Mobile Code is real now — it runs on a paired desktop. Show the
        // control; the pairing state (below) gates whether it can turn on.
        if (!cancelled) {
          setMobile(true);
          setSandboxed(false);
        }
        return;
      }
      try {
        const st = await callTauri<{
          sandboxed?: boolean;
          supported?: boolean;
          sandbox_ready?: boolean;
          file_manager?: string | null;
        }>('check_opencode_status');
        if (cancelled) return;
        setSandboxed(!!st?.sandboxed || st?.supported === false);
        setSandboxReady(st?.sandbox_ready !== false);
        setFileManager(st?.file_manager ?? null);
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
    // Mobile is opt-in: Code turns on only after the user pairs and flips it.
    if (sandboxed !== false || blocked || mobile) return;
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
    // Prep opencode in the background so the first turn is ready (best-effort),
    // and mint the platform key now rather than at first spawn.
    callTauri('install_opencode').catch(() => {});
    prewarmPlatformKey();
  }, [sandboxed, blocked, mobile, isLocal, local?.spec, llmProvider, llmName]);

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
          tenant: tenantKey || undefined,
          mentor: mentorUniqueId || undefined,
        });
        setWorkspace(saved || path);
        localStorage.setItem(FOLDER_CHOSEN_KEY, 'true');
      }
    } catch (e) {
      console.error('[coding-mode] folder pick failed', e);
      toast.error(t('pickFolderFailed'));
    }
  };

  /**
   * Start this mentor over in an empty folder. The previous one stays on disk,
   * so this is undoable by pointing the picker back at it — no confirmation.
   */
  const startNewWorkspace = async () => {
    if (!sessionId) return;
    try {
      const created = await callTauri<string>('new_opencode_workspace', {
        sessionId,
        tenant: tenantKey || undefined,
        mentor: mentorUniqueId || undefined,
      });
      if (created) {
        setWorkspace(created);
        // A deliberate choice, so first-enable must not re-prompt for a folder.
        localStorage.setItem(FOLDER_CHOSEN_KEY, 'true');
      }
    } catch (e) {
      console.error('[coding-mode] new workspace failed', e);
      toast.error(t('newWorkspaceFailed'));
    }
  };

  /** Open the workspace itself in the system file manager. */
  const openWorkspace = async () => {
    if (!workspace) return;
    try {
      const { openPath } = await import('@tauri-apps/plugin-opener');
      await openPath(workspace);
    } catch (e) {
      // A denial here is a capability-scope problem (see the pinned entry in
      // src-tauri/capabilities/default.json) — surface it, don't shrug.
      console.error('[coding-mode] could not open workspace', e);
      toast.error(t('openFolderFailed'));
    }
  };

  // Mint (or reuse from settings.json) the platform API key the moment Code is
  // on — a child's env is fixed at spawn, so a key minted only at first-turn
  // time was routinely missing from the very session that needed it.
  // Best-effort: a learner who can't mint simply proceeds without it.
  const prewarmPlatformKey = () => {
    const tenant = localStorage.getItem('tenant');
    const token = localStorage.getItem('dm_token');
    if (!tenant || !token) return;
    callTauri('ensure_opencode_platform_key', { tenant, token }).catch((e) =>
      console.error('[coding-mode] platform key prewarm failed', e),
    );
  };

  const openFolderLabel = () => {
    switch (typeof navigator === 'undefined' ? '' : getUserOS()) {
      case 'macOS':
        return t('openInFinder');
      case 'Windows':
        return t('openInExplorer');
      default:
        // Linux: name the probed inode/directory handler — that's what will
        // actually open. No default handler known → the generic label.
        return fileManager
          ? t('openInApp', { app: fileManager })
          : t('openFolder');
    }
  };

  const toggle = async (next: boolean) => {
    if (blocked) return; // can't enable Code while a local model is active
    if (next) setEngaged(true);
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
    // Mobile: the workspace, the opencode install, and the platform key all
    // live on the paired desktop — none of the desktop prep below applies
    // (the folder picker in particular would just fail on a phone).
    if (mobile) {
      void refresh();
      return;
    }
    // First enable → force a deliberate folder choice immediately.
    if (!localStorage.getItem(FOLDER_CHOSEN_KEY)) {
      await pickFolder();
    }
    // Prep the coding agent (download + config + git-init the workspace), best-effort,
    // and mint the platform key now rather than at first spawn.
    prewarmPlatformKey();
    try {
      await callTauri('install_opencode');
    } catch (e) {
      console.error('[coding-mode] install failed', e);
    }
    void refresh();
  };

  // Engagement, not mere enablement: Code defaults ON for logged-in desktop
  // users, and raising a modal at app launch for a feature nobody asked for
  // would be an ambush. Opening the popover or flipping the switch is a
  // deliberate act, and that is when the mode question is fair to ask.
  const [engaged, setEngaged] = useState(false);
  useEffect(() => {
    if (isOpen) setEngaged(true);
  }, [isOpen]);
  const needsModeChoice = engaged && permissionMode === null;

  const active = enabled || isOpen;
  // The pill's spinner covers SKILLS loading (mentor sync + vibe fetch), never
  // the opencode binary install — skills are what the next turn would miss.
  const skillsLoading = enabled && skillSync?.state === 'syncing';

  // Hidden where opencode can never be spawned: the sandboxed Mac App Store build
  // and unsupported platforms (Windows). (Desktop-only gating happens in the parent,
  // which won't mount this outside Tauri.)
  if (sandboxed) return null;

  return (
    <>
      {/* No `onOpenChange`, so there is no way past this but to answer it.
          Deliberate: both answers set a security posture, so neither can be
          the silent default. */}
      <AlertDialog open={needsModeChoice}>
        <AlertDialogContent data-testid="code-permission-mode-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('permissionDialogTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('permissionDialogDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              className="ibl-btn-secondary"
              onClick={() => void chooseMode('manual')}
            >
              {t('permissionDialogManualAction')}
            </AlertDialogAction>
            <AlertDialogAction onClick={() => void chooseMode('auto')}>
              {t('permissionDialogAutoAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
                {/* On phone widths an INACTIVE pill is icon-only so the
                    composer row never pushes the send button off-screen;
                    once Code is on (or its popover is open) the label
                    always shows, so the user can see it is selected. */}
                <span className={active ? undefined : 'max-[520px]:hidden'}>
                  {t('code')}
                </span>
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
          className="w-96 max-w-[calc(100vw-1rem)] rounded-lg border border-gray-200 bg-white p-4 shadow-xl"
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

          {/* Approvals. A quiet segmented pair rather than a second Switch: the
            two modes have names worth showing, and this row must not compete
            with the on/off control above it. */}
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-gray-600">
              {t('permissionModeLabel')}
            </span>
            <div
              role="radiogroup"
              aria-label={t('permissionModeLabel')}
              className="flex items-center gap-0.5 rounded-md border border-gray-200 p-0.5"
            >
              {(['manual', 'auto'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={permissionMode === mode}
                  onClick={() => void chooseMode(mode)}
                  className={`h-6 rounded px-2 text-[11px] transition-colors ${
                    permissionMode === mode
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {mode === 'manual'
                    ? t('permissionModeManual')
                    : t('permissionModeAuto')}
                </button>
              ))}
            </div>
          </div>
          {permissionMode === 'auto' && (
            <p
              data-testid="code-auto-mode-hint"
              className="mt-1 text-[11px] text-gray-400"
            >
              {t('permissionModeAutoHint')}
            </p>
          )}

          {mobile ? (
            /* Phone: Code runs on a paired desktop. This section IS the
              workspace story here — connect, see the folder, disconnect. */
            <div
              data-testid="code-remote-host"
              className="mt-3 rounded-md border border-gray-200 p-3"
            >
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                <Folder className="h-3.5 w-3.5" />
                {t('connectTitle')}
              </div>
              {remoteHost?.configured && remoteHost.connected ? (
                <>
                  <div className="mt-2 text-xs text-gray-600">
                    {t('connectedTo')}
                  </div>
                  <div className="mt-1 font-mono text-xs break-all text-gray-800">
                    {remoteHost.url}
                  </div>
                  <div className="mt-2 text-xs text-gray-600">
                    {t('workspace')}
                  </div>
                  <div
                    data-testid="code-remote-workspace"
                    className="mt-1 font-mono text-[11px] break-all text-gray-800"
                  >
                    {workspace || '—'}
                  </div>
                  {folderList !== null && (
                    <div
                      data-testid="code-remote-folder-list"
                      className="mt-2 max-h-40 overflow-y-auto rounded-md border border-gray-200"
                    >
                      {folderList.length === 0 ? (
                        <div className="p-2 text-[11px] text-gray-400">—</div>
                      ) : (
                        folderList.map((f) => (
                          <button
                            key={f.path}
                            type="button"
                            className="block w-full truncate px-2 py-1.5 text-left font-mono text-[11px] text-gray-700 hover:bg-gray-50"
                            disabled={folderBusy}
                            onClick={() => void chooseRemoteFolder(f.path)}
                          >
                            {f.name}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                  <div className="mt-3 flex flex-col gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      data-testid="code-remote-select-folder"
                      className="h-7 w-full text-xs"
                      disabled={folderBusy || !sessionId}
                      onClick={() =>
                        folderList === null
                          ? void openFolderPicker()
                          : setFolderList(null)
                      }
                    >
                      {t('selectWorkspace')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      data-testid="code-remote-new-folder"
                      className="h-7 w-full text-xs"
                      disabled={folderBusy || !sessionId}
                      onClick={() => void newRemoteFolder()}
                    >
                      {t('newWorkspace')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      className="h-7 w-full text-xs"
                      onClick={() => void disconnectFromDesktop()}
                    >
                      {t('disconnect')}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-2 text-[11px] text-gray-500">
                    {t('connectHint')}
                  </p>
                  {remoteHost?.configured && !remoteHost.connected && (
                    <p
                      data-testid="code-remote-unreachable"
                      className="mt-1 text-[11px] text-amber-600"
                    >
                      {t('desktopUnreachable')}
                    </p>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    data-testid="code-remote-scan"
                    className="mt-2 h-8 w-full text-xs"
                    disabled={connecting}
                    onClick={() => void scanPairingQr()}
                  >
                    {t('scanQr')}
                  </Button>
                  <p className="mt-2 text-center text-[10px] text-gray-400">
                    {t('orTypeManually')}
                  </p>
                  <input
                    data-testid="code-remote-url"
                    className="mt-2 h-8 w-full rounded-md border border-gray-200 px-2 font-mono text-xs"
                    placeholder="http://192.168.0.10:4096"
                    value={hostUrl}
                    onChange={(e) => setHostUrl(e.target.value)}
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                  <input
                    data-testid="code-remote-password"
                    className="mt-2 h-8 w-full rounded-md border border-gray-200 px-2 font-mono text-xs"
                    placeholder={t('hostPasswordLabel')}
                    type="password"
                    value={hostPassword}
                    onChange={(e) => setHostPassword(e.target.value)}
                  />
                  {connectError && (
                    <p className="mt-1 text-[11px] break-all text-red-600">
                      {connectError}
                    </p>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    className="mt-2 h-7 w-full text-xs"
                    disabled={connecting || !hostUrl.trim() || !hostPassword}
                    onClick={() => void connectToDesktop()}
                  >
                    {connecting ? t('connecting') : t('connect')}
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="mt-3 rounded-md border border-gray-200 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                <Folder className="h-3.5 w-3.5" />
                {t('workspace')}
              </div>
              <div className="mt-2 font-mono text-xs break-all text-gray-800">
                {workspace || '—'}
              </div>
              {/* Stacked full-width so all three stay the same size in every
              locale — the es/fr labels don't fit equal columns in one row. */}
              <div className="mt-3 flex flex-col gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  className="h-7 w-full text-xs"
                  disabled={!workspace}
                  onClick={openWorkspace}
                >
                  {openFolderLabel()}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  className="h-7 w-full text-xs"
                  onClick={pickFolder}
                >
                  {t('selectWorkspace')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  className="h-7 w-full text-xs"
                  disabled={!sessionId}
                  onClick={startNewWorkspace}
                >
                  {t('newWorkspace')}
                </Button>
              </div>
            </div>
          )}

          {/* Desktop: let a phone pair with this machine. Hidden until the
            backend answers (older backends don't have the commands). */}
          {!mobile && phoneAccess !== null && (
            <div
              data-testid="code-phone-access"
              className="mt-3 rounded-md border border-gray-200 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-gray-600">
                  {t('phoneAccess')}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  className="h-6 px-2 text-[11px]"
                  disabled={phoneAccessBusy}
                  onClick={() => void togglePhoneAccess()}
                >
                  {phoneAccess.running
                    ? t('phoneAccessDisable')
                    : t('phoneAccessEnable')}
                </Button>
              </div>
              {phoneAccess.running ? (
                <div className="mt-2 space-y-1">
                  {pairingQr && (
                    <div className="flex justify-center py-1">
                      <img
                        data-testid="code-pairing-qr"
                        alt={t('phoneAccess')}
                        className="h-40 w-40 rounded bg-white"
                        src={`data:image/svg+xml;utf8,${encodeURIComponent(pairingQr)}`}
                      />
                    </div>
                  )}
                  <div className="text-[11px] text-gray-500">
                    {t('phoneAccessAddress')}
                  </div>
                  <div className="font-mono text-xs break-all text-gray-800">
                    {phoneAccess.urls[0] || '—'}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {t('hostPasswordLabel')}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs break-all text-gray-800">
                      {phoneAccess.password || '—'}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    {t('phoneAccessHint')}
                  </p>
                </div>
              ) : (
                <p className="mt-1 text-[11px] text-gray-400">
                  {t('phoneAccessOffHint')}
                </p>
              )}
            </div>
          )}

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
    </>
  );
}
