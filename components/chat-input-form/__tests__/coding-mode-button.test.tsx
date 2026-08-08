import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CodingModeButton } from '../coding-mode-button';

/**
 * Code's on/off control.
 *
 * What matters here is what the toggle refuses to do: it must not enable Code with an
 * on-device model that can't call tools (opencode would look broken), it must clear a
 * stale enabled flag when that happens, and it must stay hidden in the Mac App Store
 * build, where the app can't spawn a child process at all.
 */

const { invoke, openDialog, mentorSettings, offlineMode } = vi.hoisted(() => ({
  invoke: vi.fn(),
  openDialog: vi.fn(),
  mentorSettings: { current: { llmProvider: 'openai', llmName: 'gpt-4o' } },
  offlineMode: { current: false },
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invoke(...args),
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: (...args: unknown[]) => openDialog(...args),
}));
vi.mock('@/hooks/use-mentors/use-mentor-settings', () => ({
  useMentorSettings: () => ({ data: mentorSettings.current }),
}));
vi.mock('@/hooks/use-tauri-offline', () => ({
  isTauriOfflineMode: () => offlineMode.current,
}));
// Partial mock: `config` is a big object other modules pull from at import time,
// so replacing the whole module breaks unrelated top-level initialisers.
vi.mock('@/lib/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/config')>();
  return {
    ...actual,
    config: { ...actual.config, dmUrl: () => 'https://dm.test' },
  };
});

function backend(overrides: { sandboxed?: boolean; local?: unknown } = {}) {
  invoke.mockImplementation(async (cmd: string) => {
    switch (cmd) {
      case 'check_opencode_status':
        return { sandboxed: overrides.sandboxed ?? false };
      case 'get_opencode_workspace':
        return '/home/tester/code/demo';
      case 'set_opencode_workspace':
        return '/home/tester/other';
      case 'check_code_local_model':
        return overrides.local;
      default:
        return undefined;
    }
  });
}

const SESSION_ID = 'chat-abc123';

const renderButton = (sessionId: string | undefined = SESSION_ID) =>
  render(
    <TooltipProvider>
      <CodingModeButton sessionId={sessionId} />
    </TooltipProvider>,
  );

/** Open the popover so its contents are in the DOM. */
async function openPopover() {
  await userEvent.click(await screen.findByRole('button', { name: /Code/i }));
}

describe('CodingModeButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mentorSettings.current = { llmProvider: 'openai', llmName: 'gpt-4o' };
    offlineMode.current = false;
    backend();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ data: [{ id: 'openai/gpt-4o' }] }),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('hides itself in the sandboxed Mac App Store build', async () => {
    backend({ sandboxed: true });
    const { container } = renderButton();
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  describe('default on', () => {
    it('turns Code on once for a signed-in desktop user', async () => {
      localStorage.setItem('tenant', 'acme');
      localStorage.setItem('dm_token', 'jwt-test-token');
      renderButton();

      await waitFor(() =>
        expect(localStorage.getItem('ibl_coding_mode_enabled')).toBe('true'),
      );
      expect(localStorage.getItem('ibl_coding_mode_model')).toBe(
        'openai/gpt-4o',
      );
      await waitFor(() =>
        expect(invoke).toHaveBeenCalledWith('install_opencode', undefined),
      );
    });

    it('respects an explicit previous choice of off', async () => {
      localStorage.setItem('tenant', 'acme');
      localStorage.setItem('dm_token', 'jwt-test-token');
      localStorage.setItem('ibl_coding_mode_enabled', 'false');
      renderButton();

      await waitFor(() => expect(invoke).toHaveBeenCalled());
      expect(localStorage.getItem('ibl_coding_mode_enabled')).toBe('false');
    });

    it('leaves Code off for a signed-out user', async () => {
      renderButton();
      await waitFor(() => expect(invoke).toHaveBeenCalled());
      expect(localStorage.getItem('ibl_coding_mode_enabled')).toBeNull();
    });
  });

  describe('model', () => {
    it('persists the mentor LLM as the Code model without advertising it', async () => {
      // Signed in, so the model validates against the tenant's /v1/models and the
      // "will fail" warning (which DOES name it) stays away.
      localStorage.setItem('tenant', 'acme');
      localStorage.setItem('dm_token', 'jwt-test-token');
      renderButton();
      await openPopover();

      await waitFor(() =>
        expect(localStorage.getItem('ibl_coding_mode_model')).toBe(
          'openai/gpt-4o',
        ),
      );
      // A healthy model is the top-left LLM picker's business, not this popover's.
      expect(screen.queryByText('openai/gpt-4o')).not.toBeInTheDocument();
    });

    it('warns loudly when that model is not provisioned for Code', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({ ok: true, json: async () => ({ data: [] }) })),
      );
      renderButton();
      await openPopover();

      expect(
        await screen.findByText(/isn’t available for Code/),
      ).toBeInTheDocument();
    });

    it('blocks an on-device model that cannot call tools', async () => {
      localStorage.setItem('ibl_local_llm_enabled', 'true');
      localStorage.setItem('ibl_local_llm_model', 'gemma3');
      backend({
        local: {
          runtime: 'ollama',
          spec: 'ollama/gemma3',
          model: 'gemma3',
          running: true,
          tools_supported: false,
          reason: "gemma3 doesn't support tool calling.",
        },
      });
      renderButton();
      await openPopover();

      expect(
        await screen.findByText(/doesn't support tool calling/),
      ).toBeInTheDocument();
      expect(screen.getByRole('switch')).toBeDisabled();
    });

    it('accepts a tool-capable on-device model and persists its prefixed spec', async () => {
      localStorage.setItem('ibl_local_llm_enabled', 'true');
      localStorage.setItem('ibl_local_llm_model', 'qwen3');
      backend({
        local: {
          runtime: 'ollama',
          spec: 'ollama/qwen3',
          model: 'qwen3',
          running: true,
          tools_supported: true,
          reason: '',
        },
      });
      renderButton();
      await openPopover();

      await waitFor(() =>
        expect(localStorage.getItem('ibl_coding_mode_model')).toBe(
          'ollama/qwen3',
        ),
      );
      // The warm-up hint stands in for the model line that used to be here.
      expect(await screen.findByText(/First run can take/)).toBeInTheDocument();
    });

    it('warns without blocking when tool support is unknown (Foundry)', async () => {
      offlineMode.current = true;
      backend({
        local: {
          runtime: 'foundry',
          spec: 'foundry/phi-4',
          model: 'phi-4',
          running: true,
          tools_supported: null,
          reason: "Foundry Local doesn't report tool-calling support.",
        },
      });
      renderButton();
      await openPopover();

      expect(
        await screen.findByText(/doesn't report tool-calling support/),
      ).toBeInTheDocument();
      expect(screen.getByRole('switch')).toBeEnabled();
    });
  });

  describe('workspace', () => {
    it('shows the folder the agent is confined to', async () => {
      renderButton();
      await openPopover();
      expect(
        await screen.findByText('/home/tester/code/demo'),
      ).toBeInTheDocument();
    });

    it('reads the workspace for THIS chat', async () => {
      renderButton();
      await openPopover();

      await waitFor(() =>
        expect(invoke).toHaveBeenCalledWith('get_opencode_workspace', {
          sessionId: SESSION_ID,
        }),
      );
    });

    it('asks for nothing until the chat has a session id', async () => {
      // A brand-new chat has no session yet, so there is no per-chat workspace to read.
      // Rendered directly: passing `undefined` through renderButton would hit its
      // default parameter and silently supply a session id.
      render(
        <TooltipProvider>
          <CodingModeButton />
        </TooltipProvider>,
      );
      await openPopover();

      await waitFor(() => expect(invoke).toHaveBeenCalled());
      expect(invoke).not.toHaveBeenCalledWith(
        'get_opencode_workspace',
        expect.anything(),
      );
    });

    it('persists a newly picked folder against this chat only', async () => {
      openDialog.mockResolvedValue('/home/tester/other');
      renderButton();
      await openPopover();

      await userEvent.click(
        await screen.findByRole('button', { name: /Change folder/ }),
      );

      await waitFor(() =>
        expect(invoke).toHaveBeenCalledWith('set_opencode_workspace', {
          sessionId: SESSION_ID,
          path: '/home/tester/other',
        }),
      );
      expect(localStorage.getItem('ibl_coding_mode_folder_chosen')).toBe(
        'true',
      );
    });

    it('ignores a cancelled folder picker', async () => {
      openDialog.mockResolvedValue(null);
      renderButton();
      await openPopover();

      await userEvent.click(
        await screen.findByRole('button', { name: /Change folder/ }),
      );

      expect(invoke).not.toHaveBeenCalledWith(
        'set_opencode_workspace',
        expect.anything(),
      );
    });
  });

  describe('toggling', () => {
    it('forces a deliberate folder choice the first time Code is switched on', async () => {
      localStorage.setItem('ibl_coding_mode_enabled', 'false');
      openDialog.mockResolvedValue('/home/tester/other');
      renderButton();
      await openPopover();

      await userEvent.click(await screen.findByRole('switch'));

      await waitFor(() => expect(openDialog).toHaveBeenCalled());
      expect(localStorage.getItem('ibl_coding_mode_enabled')).toBe('true');
      await waitFor(() =>
        expect(invoke).toHaveBeenCalledWith('install_opencode', undefined),
      );
    });

    it('does not re-prompt for a folder once one is chosen', async () => {
      localStorage.setItem('ibl_coding_mode_enabled', 'false');
      localStorage.setItem('ibl_coding_mode_folder_chosen', 'true');
      renderButton();
      await openPopover();

      await userEvent.click(await screen.findByRole('switch'));

      await waitFor(() =>
        expect(localStorage.getItem('ibl_coding_mode_enabled')).toBe('true'),
      );
      expect(openDialog).not.toHaveBeenCalled();
    });

    it('stays interactive while opencode is still installing', async () => {
      // Regression for the setup freeze: `install_opencode` used to wedge the
      // app (extraction deadlocked on undrained stdio, and ran pinned to the
      // IPC thread). The UI must never gate on the install promise — here it
      // never settles at all, and the popover has to keep working anyway.
      localStorage.setItem('ibl_coding_mode_enabled', 'false');
      localStorage.setItem('ibl_coding_mode_folder_chosen', 'true');
      openDialog.mockResolvedValue('/home/tester/other');
      invoke.mockImplementation(async (cmd: string) => {
        if (cmd === 'install_opencode') return new Promise(() => {});
        if (cmd === 'check_opencode_status') return { sandboxed: false };
        if (cmd === 'get_opencode_workspace') return '/home/tester/code/demo';
        return undefined;
      });
      renderButton();
      await openPopover();

      await userEvent.click(await screen.findByRole('switch'));

      await waitFor(() =>
        expect(localStorage.getItem('ibl_coding_mode_enabled')).toBe('true'),
      );
      expect(invoke).toHaveBeenCalledWith('install_opencode', undefined);

      // The install is still pending; the folder picker must still respond.
      await userEvent.click(
        await screen.findByRole('button', { name: /Change folder/ }),
      );
      await waitFor(() => expect(openDialog).toHaveBeenCalled());
    });

    it('switching off skips the install and folder work entirely', async () => {
      localStorage.setItem('ibl_coding_mode_enabled', 'true');
      localStorage.setItem('ibl_coding_mode_folder_chosen', 'true');
      renderButton();
      await openPopover();

      await userEvent.click(await screen.findByRole('switch'));

      await waitFor(() =>
        expect(localStorage.getItem('ibl_coding_mode_enabled')).toBe('false'),
      );
      expect(openDialog).not.toHaveBeenCalled();
    });
  });

  describe('when things go wrong', () => {
    it('treats an unreachable model list as "not matched" rather than crashing', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({ ok: false, json: async () => ({}) })),
      );
      renderButton();
      await openPopover();
      expect(
        await screen.findByText(/isn’t available for Code/),
      ).toBeInTheDocument();
    });

    it('survives a rejected model list request', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
      renderButton();
      await openPopover();
      expect(
        await screen.findByText(/isn’t available for Code/),
      ).toBeInTheDocument();
    });

    it('logs and moves on when the folder picker throws', async () => {
      const err = vi.spyOn(console, 'error').mockImplementation(() => {});
      openDialog.mockRejectedValue(new Error('no dialog'));
      renderButton();
      await openPopover();

      await userEvent.click(
        await screen.findByRole('button', { name: /Change folder/ }),
      );

      await waitFor(() => expect(err).toHaveBeenCalled());
      err.mockRestore();
    });

    it('logs and moves on when preparing the coding agent fails', async () => {
      const err = vi.spyOn(console, 'error').mockImplementation(() => {});
      localStorage.setItem('ibl_coding_mode_enabled', 'false');
      localStorage.setItem('ibl_coding_mode_folder_chosen', 'true');
      invoke.mockImplementation(async (cmd: string) => {
        if (cmd === 'check_opencode_status') return { sandboxed: false };
        if (cmd === 'install_opencode') throw new Error('download failed');
        return '/home/tester/code/demo';
      });
      renderButton();
      await openPopover();

      await userEvent.click(await screen.findByRole('switch'));

      await waitFor(() => expect(err).toHaveBeenCalled());
      // Code is still ON — the flag is the user's choice, not the install's verdict.
      expect(localStorage.getItem('ibl_coding_mode_enabled')).toBe('true');
      err.mockRestore();
    });
  });

  it('closes the popover from the inline X without re-triggering it', async () => {
    const { container } = renderButton();
    await openPopover();
    await screen.findByRole('switch');

    const close = container.querySelector('svg.lucide-x');
    await userEvent.click(close!);

    await waitFor(() =>
      expect(screen.queryByRole('switch')).not.toBeInTheDocument(),
    );
  });

  it('survives a backend that cannot answer at all', async () => {
    invoke.mockRejectedValue(new Error('ipc down'));
    renderButton();
    // Status stays unknown, so Code neither hides nor enables itself.
    expect(
      await screen.findByRole('button', { name: /Code/i }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(localStorage.getItem('ibl_coding_mode_enabled')).toBeNull(),
    );
  });
});
