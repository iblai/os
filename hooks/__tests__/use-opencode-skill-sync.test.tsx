import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useOpencodeSkillSync } from '../use-opencode-skill-sync';

/**
 * The Code-mode skill sync: what lands in `set_opencode_skills` (and when it
 * must NOT land) is the whole feature. The Rust side trusts this payload, the
 * spawn handshake trusts that every begin is closed, and the pill spinner and
 * amber note trust the state transitions.
 */

const { invoke, tauriFlag, api } = vi.hoisted(() => ({
  invoke: vi.fn(),
  tauriFlag: { current: true },
  api: {
    assignments: vi.fn<(arg: unknown) => Promise<unknown>>(),
    catalog: vi.fn<(arg: unknown) => Promise<unknown>>(),
    resources: vi.fn<(arg: unknown) => Promise<unknown>>(),
  },
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invoke(...args),
}));
vi.mock('@/types/tauri', () => ({
  isTauriApp: () => tauriFlag.current,
}));
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useLazyGetMentorSkillAssignmentsQuery: () => [
    (arg: unknown) => ({ unwrap: () => api.assignments(arg) }),
  ],
  useLazyGetAgentSkillsQuery: () => [
    (arg: unknown) => ({ unwrap: () => api.catalog(arg) }),
  ],
  useLazyGetAgentSkillResourcesQuery: () => [
    (arg: unknown) => ({ unwrap: () => api.resources(arg) }),
  ],
}));

const ORG = 'acme';
const MENTOR = 'mentor-uuid-1';

const assignment = (skill: string, enabled = true, id = 1) => ({
  id,
  mentor: MENTOR,
  skill,
  skill_name: `name of ${skill}`,
  enabled,
  created_at: '',
  updated_at: '',
});

const catalogSkill = (
  unique_id: string,
  overrides: Record<string, unknown> = {},
) => ({
  id: 7,
  unique_id,
  name: 'Web Research',
  slug: 'web-research',
  description: 'Find things on the web',
  version: '1',
  instruction: 'Do research.',
  metadata: {},
  enabled: true,
  platform_key: 'main',
  created_at: '',
  updated_at: '',
  ...overrides,
});

const renderSync = (args: { org?: string; mentorUniqueId?: string } = {}) =>
  renderHook(() =>
    useOpencodeSkillSync({ org: ORG, mentorUniqueId: MENTOR, ...args }),
  );

const setCalls = () =>
  invoke.mock.calls.filter(([cmd]) => cmd === 'set_opencode_skills');

describe('useOpencodeSkillSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    tauriFlag.current = true;
    localStorage.setItem('ibl_coding_mode_enabled', 'true');
    api.assignments.mockResolvedValue([assignment('skill-uuid-1')]);
    api.catalog.mockResolvedValue([catalogSkill('skill-uuid-1')]);
    api.resources.mockResolvedValue({ count: 0, results: [] });
    invoke.mockImplementation(async (cmd: unknown) => {
      if (cmd === 'ensure_vibe_skills') return { present: true };
      if (cmd === 'set_opencode_skills') return '/staging/dir';
      return undefined;
    });
  });

  it('stays idle (and silent) while Code is off', async () => {
    localStorage.setItem('ibl_coding_mode_enabled', 'false');
    const { result } = renderSync();
    await waitFor(() => expect(result.current.state).toBe('idle'));
    expect(invoke).not.toHaveBeenCalled();
  });

  it('stays idle without a mentor', async () => {
    const { result } = renderSync({ mentorUniqueId: undefined });
    await waitFor(() => expect(result.current.state).toBe('idle'));
    expect(invoke).not.toHaveBeenCalled();
  });

  it('syncs assigned skills: handshake, vibe, payload, mentor bridge', async () => {
    api.assignments.mockResolvedValue([
      assignment('skill-uuid-1', true, 1),
      assignment('skill-uuid-off', false, 2), // assignment disabled → skipped
      assignment('skill-uuid-private', true, 3), // not in catalog → skipped
    ]);
    api.resources.mockResolvedValue({
      count: 3,
      results: [
        {
          id: 1,
          skill: 7,
          file_type: 'script',
          filename: 'run.py',
          content: 'print(1)',
        },
        {
          id: 2,
          skill: 7,
          file_type: 'asset',
          filename: 'pic.png',
          file: 'https://x/pic.png',
        },
        {
          id: 3,
          skill: 7,
          file_type: 'reference',
          filename: 'ref.md',
          content: '# ref',
        },
      ],
    });

    const { result } = renderSync();
    await waitFor(() => expect(result.current.state).toBe('synced'));

    expect(result.current.count).toBe(1);
    expect(invoke).toHaveBeenCalledWith('begin_opencode_skills_sync', {
      mentorUniqueId: MENTOR,
    });
    expect(invoke).toHaveBeenCalledWith('ensure_vibe_skills', undefined);
    expect(invoke).toHaveBeenCalledWith('set_opencode_skills', {
      mentorUniqueId: MENTOR,
      skills: [
        {
          slug: 'web-research',
          description: 'Find things on the web',
          instruction: 'Do research.',
          resources: [
            { filename: 'run.py', content: 'print(1)' },
            { filename: 'ref.md', content: '# ref' },
          ],
        },
      ],
    });
    // The SDK bridge: the send path reads this to key the skills dir.
    expect(localStorage.getItem('ibl_coding_mode_mentor')).toBe(MENTOR);
  });

  it('falls back to the skill name when the description is blank (opencode hides description-less skills)', async () => {
    api.catalog.mockResolvedValue([
      catalogSkill('skill-uuid-1', { description: '   ' }),
    ]);
    const { result } = renderSync();
    await waitFor(() => expect(result.current.state).toBe('synced'));
    expect(setCalls()[0][1]).toMatchObject({
      skills: [expect.objectContaining({ description: 'Web Research' })],
    });
  });

  it('fetches ALL assignment pages, not the picker’s first one', async () => {
    const fullPage = Array.from({ length: 100 }, (_, i) =>
      assignment('skill-uuid-off', false, i),
    );
    api.assignments.mockImplementation(async (arg) =>
      (arg as { offset: number }).offset === 0
        ? fullPage
        : [assignment('skill-uuid-1', true, 900)],
    );

    const { result } = renderSync();
    await waitFor(() => expect(result.current.state).toBe('synced'));

    expect(api.assignments).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 0, limit: 100 }),
    );
    expect(api.assignments).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 100, limit: 100 }),
    );
    expect(result.current.count).toBe(1);
  });

  it('follows the resources envelope count across pages', async () => {
    const row = (i: number) => ({
      id: i,
      skill: 7,
      file_type: 'script',
      filename: `f${i}.py`,
      content: 'x',
    });
    api.resources.mockImplementation(async (arg) => {
      const offset = (arg as { offset: number }).offset;
      return offset === 0
        ? { count: 150, results: Array.from({ length: 100 }, (_, i) => row(i)) }
        : {
            count: 150,
            results: Array.from({ length: 50 }, (_, i) => row(100 + i)),
          };
    });

    const { result } = renderSync();
    await waitFor(() => expect(result.current.state).toBe('synced'));

    const payload = setCalls()[0][1] as {
      skills: { resources: unknown[] }[];
    };
    expect(payload.skills[0].resources).toHaveLength(150);
  });

  it('on a catalog failure it ends the handshake WITHOUT writing', async () => {
    api.catalog.mockRejectedValue({ status: 403 });

    const { result } = renderSync();
    await waitFor(() => expect(result.current.state).toBe('error'));

    // `skills: null` = end the in-flight sync, leave the staging tree alone —
    // a stale skill set beats a wrongly-emptied one.
    expect(setCalls()).toEqual([
      ['set_opencode_skills', { mentorUniqueId: MENTOR, skills: null }],
    ]);
  });

  it('clears the staging tree when the mentor has no enabled skills', async () => {
    api.assignments.mockResolvedValue([assignment('skill-uuid-1', false)]);

    const { result } = renderSync();
    await waitFor(() => expect(result.current.state).toBe('synced'));

    expect(result.current.count).toBe(0);
    expect(setCalls()).toEqual([
      ['set_opencode_skills', { mentorUniqueId: MENTOR, skills: [] }],
    ]);
    expect(api.catalog).not.toHaveBeenCalled();
  });

  it('errors when vibe skills are absent with no cache', async () => {
    invoke.mockImplementation(async (cmd: unknown) => {
      if (cmd === 'ensure_vibe_skills') return { present: false };
      if (cmd === 'set_opencode_skills') return '/staging/dir';
      return undefined;
    });

    const { result } = renderSync();
    await waitFor(() => expect(result.current.state).toBe('error'));
    // The mentor skills still synced — only the vibe half is missing.
    expect(setCalls()[0][1]).toMatchObject({ skills: expect.any(Array) });
  });

  it('waits for Tauri to inject its globals, then syncs', async () => {
    tauriFlag.current = false;
    vi.useFakeTimers();
    let result: { current: { state: string } };
    try {
      ({ result } = renderSync());
      // Tauri shows up before the poll gives up.
      tauriFlag.current = true;
      act(() => {
        vi.advanceTimersByTime(500);
      });
    } finally {
      vi.useRealTimers();
    }
    await waitFor(() => expect(result.current.state).toBe('synced'));
  });

  it('gives up politely when Tauri never appears (plain browser)', async () => {
    tauriFlag.current = false;
    vi.useFakeTimers();
    try {
      const { result } = renderSync();
      act(() => {
        vi.advanceTimersByTime(6500); // > 10 tries × 500ms
      });
      expect(result.current.state).toBe('idle');
    } finally {
      vi.useRealTimers();
    }
    expect(invoke).not.toHaveBeenCalled();
  });

  it('errors when the handshake itself cannot be established', async () => {
    invoke.mockImplementation(async (cmd: unknown) => {
      if (cmd === 'begin_opencode_skills_sync') throw new Error('ipc down');
      return undefined;
    });

    const { result } = renderSync();
    await waitFor(() => expect(result.current.state).toBe('error'));

    expect(api.assignments).not.toHaveBeenCalled();
    expect(setCalls()).toHaveLength(0);
  });

  it('treats a rejected vibe command as “no vibe skills” (still syncs the mentor)', async () => {
    invoke.mockImplementation(async (cmd: unknown) => {
      if (cmd === 'ensure_vibe_skills') throw new Error('ipc down');
      if (cmd === 'set_opencode_skills') return '/staging/dir';
      return undefined;
    });

    const { result } = renderSync();
    await waitFor(() => expect(result.current.state).toBe('error'));
    expect(setCalls()[0][1]).toMatchObject({ skills: expect.any(Array) });
  });

  it('starts syncing the moment Code flips on (local-storage fan-out)', async () => {
    localStorage.setItem('ibl_coding_mode_enabled', 'false');
    const { result } = renderSync();
    await waitFor(() => expect(result.current.state).toBe('idle'));
    expect(invoke).not.toHaveBeenCalled();

    act(() => {
      localStorage.setItem('ibl_coding_mode_enabled', 'true');
      window.dispatchEvent(new Event('local-storage'));
    });

    await waitFor(() => expect(result.current.state).toBe('synced'));
    expect(invoke).toHaveBeenCalledWith('begin_opencode_skills_sync', {
      mentorUniqueId: MENTOR,
    });
  });

  it('a failed vibe install retries by itself and recovers', async () => {
    vi.useFakeTimers();
    try {
      // First attempt: absent. Second (the 30s retry): installed.
      let vibeCalls = 0;
      invoke.mockImplementation(async (cmd: unknown) => {
        if (cmd === 'ensure_vibe_skills') {
          vibeCalls += 1;
          return { present: vibeCalls >= 2 };
        }
        if (cmd === 'set_opencode_skills') return '/staging/dir';
        return undefined;
      });

      const { result } = renderSync();
      await vi.waitFor(() => expect(result.current.state).toBe('error'));
      expect(vibeCalls).toBe(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });
      expect(vibeCalls).toBe(2);
      expect(result.current).toEqual({ state: 'synced', count: 1 });
    } finally {
      vi.useRealTimers();
    }
  });

  it('vibe retries stop after the cap — the amber note is the end state', async () => {
    vi.useFakeTimers();
    try {
      let vibeCalls = 0;
      invoke.mockImplementation(async (cmd: unknown) => {
        if (cmd === 'ensure_vibe_skills') {
          vibeCalls += 1;
          return { present: false };
        }
        if (cmd === 'set_opencode_skills') return '/staging/dir';
        return undefined;
      });

      const { result } = renderSync();
      await vi.waitFor(() => expect(result.current.state).toBe('error'));

      // All three backoff steps fire, then nothing more — ever.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000 + 120_000 + 600_000);
      });
      expect(vibeCalls).toBe(1 + 3);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3_600_000);
      });
      expect(vibeCalls).toBe(1 + 3);
      expect(result.current.state).toBe('error');
    } finally {
      vi.useRealTimers();
    }
  });
});
