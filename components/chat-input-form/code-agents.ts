'use client';

import { useEffect, useState } from 'react';

/**
 * The Code agents the desktop can run and the localStorage keys the Code
 * popover writes for them. Shared with the nav bar's model picker, which
 * follows the same keys. Rust routes on the model key the popover writes
 * (`codex/default` / `claude/default`, or the platform model).
 */
export const ENABLED_KEY = 'ibl_coding_mode_enabled';
/**
 * Which agent runs Code turns. Per machine on purpose (installs and CLI logins
 * are local), so it is never synced to DM.
 */
export const AGENT_KEY = 'ibl_coding_mode_agent';

export type CodeAgent = 'opencode' | 'codex' | 'claude';
export const AGENTS: CodeAgent[] = ['opencode', 'codex', 'claude'];
/** Brand names, not translated — and never "opencode" in the UI. */
export const AGENT_LABELS: Record<CodeAgent, string> = {
  opencode: 'ibl.ai',
  codex: 'Codex',
  claude: 'Claude Code',
};

/** The two agents the desktop installs (never `opencode`, which is built in). */
export const isAgent = (v: unknown): v is 'codex' | 'claude' =>
  v === 'codex' || v === 'claude';

export function readAgent(): CodeAgent {
  const v =
    typeof window === 'undefined' ? null : localStorage.getItem(AGENT_KEY);
  return isAgent(v) ? v : 'opencode';
}

/** The subscription agent Code runs on right now, or null (Code off, or ibl.ai). */
function readCodeAgent(): 'codex' | 'claude' | null {
  if (typeof window === 'undefined') return null;
  if (localStorage.getItem(ENABLED_KEY) !== 'true') return null;
  const agent = readAgent();
  return isAgent(agent) ? agent : null;
}

/**
 * Follows the Code popover's writes: it fans same-tab writes out on the app's
 * `local-storage` event, other tabs arrive on `storage`.
 */
export function useCodeAgent(): 'codex' | 'claude' | null {
  const [agent, setAgent] = useState(readCodeAgent);
  useEffect(() => {
    const sync = () => setAgent(readCodeAgent());
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener('local-storage', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('local-storage', sync);
    };
  }, []);
  return agent;
}
