import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  render,
  renderHook,
  screen,
  waitFor,
  act,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AgentModelSelector } from '../agent-model-selector';
import { useCodeAgent } from '@/components/chat-input-form/code-agents';

const { invoke, toastError } = vi.hoisted(() => ({
  invoke: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invoke(...args),
}));
vi.mock('sonner', () => ({
  toast: { error: (...args: unknown[]) => toastError(...args) },
  Toaster: () => null,
}));

/** `list_code_agent_models` shapes: Codex names a concrete default, Claude a "default" entry. */
const CODEX = {
  models: [
    { id: 'gpt-5.2', name: '5.2', description: 'Default model' },
    { id: 'gpt-5.3-codex', name: '5.3 Codex', description: 'Coding' },
  ],
  default: 'gpt-5.2',
  selected: null,
};
const CLAUDE = {
  models: [
    { id: 'default', name: 'Default', description: 'Opus 4.6' },
    { id: 'claude-opus-4-6', name: 'Opus 4.6', description: null },
    { id: 'claude-sonnet-4-6', name: 'Sonnet 4.6', description: null },
  ],
  default: 'default',
  selected: 'claude-sonnet-4-6',
};

function renderSelector(backend: 'codex' | 'claude' = 'codex') {
  return render(
    <TooltipProvider>
      <AgentModelSelector backend={backend} />
    </TooltipProvider>,
  );
}
const trigger = () => screen.getByTestId('code-agent-model-selector');

describe('AgentModelSelector', () => {
  beforeEach(() => {
    invoke.mockReset();
    toastError.mockReset();
  });

  it('lists the agent’s models with Default first and the saved pick checked', async () => {
    invoke.mockResolvedValue(CLAUDE);
    renderSelector('claude');
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('list_code_agent_models', {
        backend: 'claude',
        refresh: false,
      }),
    );
    expect(
      await screen.findByText('Claude Code · Sonnet 4.6'),
    ).toBeInTheDocument();
    await userEvent.click(trigger());
    const items = await screen.findAllByRole('menuitemradio');
    // Claude's own "default" entry is the Default radio, not a second row.
    expect(items.map((i) => i.textContent)).toEqual([
      'DefaultOpus 4.6',
      'Opus 4.6',
      'Sonnet 4.6',
    ]);
    expect(items[2]).toHaveAttribute('aria-checked', 'true');
  });

  it('shows the agent’s own default while nothing is saved', async () => {
    invoke.mockResolvedValue(CODEX);
    renderSelector();
    expect(await screen.findByText('Codex · Default')).toBeInTheDocument();
    await userEvent.click(trigger());
    const items = await screen.findAllByRole('menuitemradio');
    expect(items[0]).toHaveAttribute('aria-checked', 'true');
    // A concrete default is named, not described.
    expect(items[0].textContent).toBe('Default5.2');
    expect(items).toHaveLength(3);
  });

  it('choosing a model saves it and relabels; choosing Default saves null', async () => {
    invoke.mockImplementation(async (cmd: string) =>
      cmd === 'list_code_agent_models' ? CODEX : undefined,
    );
    renderSelector();
    await userEvent.click(trigger());
    await userEvent.click(
      await screen.findByRole('menuitemradio', { name: /5\.3 Codex/ }),
    );
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('set_code_agent_model', {
        backend: 'codex',
        model: 'gpt-5.3-codex',
      }),
    );
    expect(await screen.findByText('Codex · 5.3 Codex')).toBeInTheDocument();
    await userEvent.click(trigger());
    await userEvent.click(
      await screen.findByRole('menuitemradio', { name: /^Default/ }),
    );
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('set_code_agent_model', {
        backend: 'codex',
        model: null,
      }),
    );
    expect(await screen.findByText('Codex · Default')).toBeInTheDocument();
  });

  it('a refused pick toasts and reverts the label', async () => {
    invoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'list_code_agent_models') return CODEX;
      throw new Error('Codex refused model = gpt-5.3-codex: Invalid params');
    });
    renderSelector();
    await userEvent.click(trigger());
    await userEvent.click(
      await screen.findByRole('menuitemradio', { name: /5\.3 Codex/ }),
    );
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        expect.stringContaining('refused'),
      ),
    );
    expect(screen.getByText('Codex · Default')).toBeInTheDocument();
  });

  it('shows a failure inline with Retry, which asks the desktop to probe again', async () => {
    invoke.mockRejectedValueOnce(
      new Error('agent sign-in required: Sign in with ChatGPT.'),
    );
    renderSelector();
    expect(
      await screen.findByText('Codex · Couldn’t load models'),
    ).toBeInTheDocument();
    await userEvent.click(trigger());
    expect(
      await screen.findByText('agent sign-in required: Sign in with ChatGPT.'),
    ).toBeInTheDocument();
    invoke.mockResolvedValue(CODEX);
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() =>
      expect(invoke).toHaveBeenLastCalledWith('list_code_agent_models', {
        backend: 'codex',
        refresh: true,
      }),
    );
    expect(await screen.findByText('Codex · Default')).toBeInTheDocument();
  });

  it('shows the loading state until the desktop answers', async () => {
    let resolve: (v: unknown) => void = () => {};
    invoke.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    renderSelector();
    expect(screen.getByText('Codex · Loading models…')).toBeInTheDocument();
    await act(async () => {
      resolve(CODEX);
    });
    expect(await screen.findByText('Codex · Default')).toBeInTheDocument();
  });
});

describe('useCodeAgent', () => {
  beforeEach(() => localStorage.clear());

  it('is null with Code off or on ibl.ai, the agent otherwise, and follows the popover’s writes', () => {
    const { result } = renderHook(() => useCodeAgent());
    expect(result.current).toBeNull();
    act(() => {
      localStorage.setItem('ibl_coding_mode_enabled', 'true');
      localStorage.setItem('ibl_coding_mode_agent', 'opencode');
      window.dispatchEvent(new Event('local-storage'));
    });
    expect(result.current).toBeNull();
    act(() => {
      localStorage.setItem('ibl_coding_mode_agent', 'codex');
      window.dispatchEvent(new Event('local-storage'));
    });
    expect(result.current).toBe('codex');
    act(() => {
      localStorage.setItem('ibl_coding_mode_enabled', 'false');
      window.dispatchEvent(new Event('storage'));
    });
    expect(result.current).toBeNull();
  });
});
