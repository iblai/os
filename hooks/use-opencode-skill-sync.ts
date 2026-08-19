'use client';

import { useEffect, useRef, useState } from 'react';
import { isTauriApp } from '@/types/tauri';
import {
  useLazyGetAgentSkillResourcesQuery,
  useLazyGetAgentSkillsQuery,
  useLazyGetMentorSkillAssignmentsQuery,
  type AgentSkill,
  type AgentSkillResource,
  type MentorSkillAssignment,
} from '@iblai/iblai-js/data-layer';

/** Mirrors the Code toggle's key (coding-mode-button.tsx / SDK opencode-client). */
const ENABLED_KEY = 'ibl_coding_mode_enabled';
/**
 * The SDK bridge: `streamOpencodeChat` reads this and passes it to
 * `opencode_chat_stream`, which keys the synced skills dir by it — the same
 * localStorage channel the Code model/enabled flags already use.
 */
const MENTOR_KEY = 'ibl_coding_mode_mentor';

/** Server pages during a sync (not the picker's lazy 20 — the sync needs ALL). */
const SYNC_PAGE_SIZE = 100;
/** Backstop for a server that ignores `limit`: never loop forever. */
const MAX_PAGES = 50;

export interface OpencodeSkillSync {
  state: 'idle' | 'syncing' | 'synced' | 'error';
  /** Skills written on the last successful sync. */
  count?: number;
}

interface SkillResourcePayload {
  filename: string;
  content: string;
}

interface SkillPayload {
  slug: string;
  description: string;
  instruction: string;
  resources: SkillResourcePayload[];
}

async function callTauri<T = unknown>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
}

// The SDK types query data as `list | paginated envelope`; runtime is
// normalized to a list for assignments/catalog, envelope for resources —
// unwrap defensively either way (same helper shape as chat-input-form).
const asList = <T>(data: T[] | { results?: T[] } | undefined): T[] =>
  Array.isArray(data) ? data : (data?.results ?? []);

/**
 * Materialise the mentor's Agent Skills (plus the shared iblai/vibe skills) on
 * disk for Code mode, via the `set_opencode_skills` / `ensure_vibe_skills`
 * Tauri commands. opencode discovers skills ONCE per spawned process, so a sync
 * applies to the *next* spawn (model switch, 15-min idle reap, app restart, new
 * chat); the begin/set handshake makes an in-flight sync hold new spawns
 * instead of letting them snapshot a half-written dir.
 *
 * `state: 'syncing'` spans the mentor fetch AND the vibe download — it drives
 * the Code pill's spinner. `state: 'error'` (catalog 403, network, vibe absent
 * with no cache) surfaces as the popover's amber note; on error the staging
 * tree is left untouched — a stale skill set beats a wrongly-emptied one.
 */
export function useOpencodeSkillSync({
  org,
  mentorUniqueId,
}: {
  org?: string;
  mentorUniqueId?: string;
}): OpencodeSkillSync {
  const [sync, setSync] = useState<OpencodeSkillSync>({ state: 'idle' });

  // Tauri injects its globals after load — poll briefly instead of latching a
  // render-time false (same pattern as inside-buttons).
  const [inTauri, setInTauri] = useState(false);
  useEffect(() => {
    if (isTauriApp()) return setInTauri(true);
    let tries = 0;
    const t = setInterval(() => {
      if (isTauriApp()) {
        setInTauri(true);
        clearInterval(t);
      } else if (++tries > 10) {
        clearInterval(t);
      }
    }, 500);
    return () => clearInterval(t);
  }, []);

  const [codeEnabled, setCodeEnabled] = useState(false);
  useEffect(() => {
    const read = () =>
      setCodeEnabled(localStorage.getItem(ENABLED_KEY) === 'true');
    read();
    window.addEventListener('storage', read);
    // Same-tab writes fan out on this custom event (see coding-mode-button).
    window.addEventListener('local-storage', read);
    return () => {
      window.removeEventListener('storage', read);
      window.removeEventListener('local-storage', read);
    };
  }, []);

  // The SDK bridge: keep the active mentor readable by the send path. Written
  // whenever known (not only while Code is on) so the very first enable
  // already has it; never cleared on unmount — another composer may live.
  useEffect(() => {
    if (inTauri && mentorUniqueId) {
      localStorage.setItem(MENTOR_KEY, mentorUniqueId);
    }
  }, [inTauri, mentorUniqueId]);

  const [fetchAssignments] = useLazyGetMentorSkillAssignmentsQuery();
  const [fetchCatalog] = useLazyGetAgentSkillsQuery();
  const [fetchResources] = useLazyGetAgentSkillResourcesQuery();

  // Stable refs so the sync effect doesn't re-run when RTK recreates triggers.
  const triggers = useRef({ fetchAssignments, fetchCatalog, fetchResources });
  triggers.current = { fetchAssignments, fetchCatalog, fetchResources };

  useEffect(() => {
    if (!inTauri || !codeEnabled || !org || !mentorUniqueId) {
      setSync({ state: 'idle' });
      return;
    }

    let cancelled = false;
    const safeSet = (next: OpencodeSkillSync) => {
      if (!cancelled) setSync(next);
    };

    void (async () => {
      safeSet({ state: 'syncing' });
      try {
        // Handshake first: from here until set_opencode_skills lands, a Code
        // send for this mentor waits instead of spawning skill-less.
        await callTauri('begin_opencode_skills_sync', { mentorUniqueId });
      } catch {
        safeSet({ state: 'error' });
        return;
      }

      // Shared vibe skills, in parallel with the mentor fetch below. Its own
      // download registers its own in-flight entry Rust-side.
      const vibePromise = callTauri<{ present?: boolean }>(
        'ensure_vibe_skills',
      ).catch(() => ({ present: false }));

      // Any fetch failure ends the handshake WITHOUT writing (`skills: null`):
      // the previous staging tree survives.
      const bail = async () => {
        await callTauri('set_opencode_skills', {
          mentorUniqueId,
          skills: null,
        }).catch(() => {});
        safeSet({ state: 'error' });
      };

      const { fetchAssignments, fetchCatalog, fetchResources } =
        triggers.current;
      try {
        // 1. ALL assignment pages — the picker's scroll-accumulated state
        //    would silently sync a subset.
        const assignments: MentorSkillAssignment[] = [];
        for (let page = 0; page < MAX_PAGES; page++) {
          const rows = asList(
            await fetchAssignments(
              {
                org,
                mentorUniqueId,
                limit: SYNC_PAGE_SIZE,
                offset: page * SYNC_PAGE_SIZE,
              },
              true,
            ).unwrap(),
          );
          assignments.push(...rows);
          if (rows.length < SYNC_PAGE_SIZE) break;
        }
        const enabled = assignments.filter((row) => row.enabled !== false);

        if (enabled.length === 0) {
          await callTauri('set_opencode_skills', {
            mentorUniqueId,
            skills: [],
          });
          const vibe = await vibePromise;
          safeSet(
            vibe?.present === false
              ? { state: 'error' }
              : { state: 'synced', count: 0 },
          );
          return;
        }

        // 2. The catalog carries the bodies (instruction) the assignment rows
        //    lack. This is the call that 403s for some users — see the
        //    assignments-only note in chat-input-form.
        const catalog: AgentSkill[] = [];
        for (let page = 0; page < MAX_PAGES; page++) {
          const rows = asList(
            await fetchCatalog(
              {
                org,
                enabled: true,
                limit: SYNC_PAGE_SIZE,
                offset: page * SYNC_PAGE_SIZE,
              },
              true,
            ).unwrap(),
          );
          catalog.push(...rows);
          if (rows.length < SYNC_PAGE_SIZE) break;
        }

        // 3. Assignments → full records. Unmatched rows (mentor-private
        //    skills, invisible to the catalog) are skipped — the same
        //    trade-off the picker documents.
        const matched = enabled
          .map((row) => catalog.find((s) => s.unique_id === row.skill))
          .filter((s): s is AgentSkill => !!s);

        // 4. Text resources per skill (script/reference; binary assets are
        //    not synced).
        const payload: SkillPayload[] = [];
        for (const skill of matched) {
          const resources: AgentSkillResource[] = [];
          for (let page = 0; page < MAX_PAGES; page++) {
            const data = await fetchResources(
              {
                org,
                skill: skill.id,
                limit: SYNC_PAGE_SIZE,
                offset: page * SYNC_PAGE_SIZE,
              },
              true,
            ).unwrap();
            const rows = asList(data);
            resources.push(...rows);
            const total = Array.isArray(data) ? undefined : data?.count;
            const done =
              total !== undefined
                ? resources.length >= total
                : rows.length < SYNC_PAGE_SIZE;
            if (done) break;
          }
          payload.push({
            slug: skill.slug,
            // opencode hides description-less skills from the model entirely.
            description: skill.description?.trim() || skill.name,
            instruction: skill.instruction ?? '',
            resources: resources
              .filter(
                (res) =>
                  (res.file_type === 'script' ||
                    res.file_type === 'reference') &&
                  typeof res.content === 'string',
              )
              .map((res) => ({
                filename: res.filename,
                content: res.content as string,
              })),
          });
        }

        await callTauri('set_opencode_skills', {
          mentorUniqueId,
          skills: payload,
        });
        const vibe = await vibePromise;
        safeSet(
          vibe?.present === false
            ? { state: 'error' }
            : { state: 'synced', count: payload.length },
        );
      } catch {
        await bail();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [inTauri, codeEnabled, org, mentorUniqueId]);

  return sync;
}
