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

const { invoke, toastError, dialog } = vi.hoisted(() => ({
  invoke: vi.fn(),
  toastError: vi.fn(),
  /** The props the picker last handed the SDK dialog. */
  dialog: { props: null as any },
}));
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invoke(...args),
}));
vi.mock('sonner', () => ({
  toast: { error: (...args: unknown[]) => toastError(...args) },
  Toaster: () => null,
}));
// next/image is not renderable under vitest; the trigger's logo is a plain <img>.
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string }) => (
    <img src={src} alt={alt} {...props} />
  ),
}));
vi.mock('next/navigation', () => ({
  useParams: () => ({ tenantKey: 'acme', mentorId: 'mentor-1' }),
}));
vi.mock('@/hooks/use-user', () => ({ useUsername: () => 'jane' }));
// The LLM catalogue names each provider's logo; Anthropic ships none here.
vi.mock('@iblai/iblai-js/web-containers', () => ({
  useLlmProviderCatalogue: () => (key: string) => ({
    logo: key === 'openai' ? '/logos/openai.svg' : null,
  }),
}));
// The SDK's LLM Selection dialog is the picker's whole surface. This stub
// records the props it is handed and exposes its callbacks — the precedent is
// llm-provider-selection-modal.test.tsx, which mocks the SDK tab and asserts
// the wiring; the dialog's own rendering is the SDK's suite's business.
vi.mock('@iblai/iblai-js/web-containers/next', () => ({
  LLMProviderModal: (props: any) => {
    dialog.props = props;
    if (!props.isOpen) return null;
    return (
      <div
        data-testid="llm-provider-modal"
        data-active={props.mentorSettings.llm_name}
      >
        <span>{props.labels.title}</span>
        {props.llmProvider.chat_models.map((m: any) => (
          <button
            key={m.llm_name}
            type="button"
            disabled={props.isSelecting}
            onClick={() =>
              void props.onSelect(props.llmProvider.name, m.llm_name)
            }
          >
            {m.display_name}
          </button>
        ))}
        <button type="button" onClick={props.onClose}>
          close
        </button>
      </div>
    );
  },
}));

/**
 * `list_code_agent_models` shapes. CODEX carries a concrete default — the
 * shape of a Claude settings model; Codex's own catalog (`codex debug models`,
 * CODEX_CATALOG) names none — and CLAUDE its "default" entry.
 */
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
const CODEX_CATALOG = {
  models: [
    { id: 'gpt-6-sol', name: 'GPT-6-Sol', description: 'Frontier' },
    { id: 'gpt-5.5', name: 'GPT-5.5', description: null },
  ],
  default: null,
  selected: null,
};

function renderSelector(backend: 'codex' | 'claude' = 'codex') {
  return render(
    <TooltipProvider>
      <AgentModelSelector backend={backend} />
    </TooltipProvider>,
  );
}
const trigger = () => screen.getByTestId('code-agent-model-selector');
const modal = () => screen.queryByTestId('llm-provider-modal');

describe('AgentModelSelector', () => {
  beforeEach(() => {
    invoke.mockReset();
    toastError.mockReset();
    dialog.props = null;
  });

  it('opens the SDK LLM Selection dialog on the agent as one cloud-only provider, Default first, the saved pick active', async () => {
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
    expect(modal()).not.toBeInTheDocument();
    await userEvent.click(trigger());
    expect(modal()).toBeInTheDocument();
    expect(screen.getByText('LLM Selection')).toBeInTheDocument();
    const props = dialog.props;
    expect(props.cloudOnly).toBe(true);
    expect(props.isSelecting).toBe(false);
    expect(props.llmProvider).toMatchObject({
      name: 'Claude Code',
      logo: null,
      has_credentials: true,
    });
    expect(props.llms).toEqual([props.llmProvider]);
    expect(props.mentorSettings).toEqual({
      llm_name: 'claude-sonnet-4-6',
      llm_provider: 'Claude Code',
    });
    // Claude's own "default" entry is the Default row, not a second one.
    expect(
      props.llmProvider.chat_models.map((m: any) => [
        m.llm_name,
        m.display_name,
      ]),
    ).toEqual([
      ['__default__', 'Default (Opus 4.6)'],
      ['claude-opus-4-6', 'Opus 4.6'],
      ['claude-sonnet-4-6', 'Sonnet 4.6'],
    ]);
  });

  it('marks Default active while nothing is saved, names a concrete default, and wears the provider logo', async () => {
    invoke.mockResolvedValue(CODEX);
    renderSelector();
    expect(await screen.findByText('Codex · Default')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Codex model logo' }),
    ).toHaveAttribute('src', expect.stringContaining('openai'));
    await userEvent.click(trigger());
    expect(modal()).toHaveAttribute('data-active', '__default__');
    expect(dialog.props.llmProvider.logo).toBe('/logos/openai.svg');
    expect(
      dialog.props.llmProvider.chat_models.map((m: any) => m.display_name),
    ).toEqual(['Default (5.2)', '5.2', '5.3 Codex']);
  });

  it('a pick saves it, moves the active row and relabels; Default saves null', async () => {
    invoke.mockImplementation(async (cmd: string) =>
      cmd === 'list_code_agent_models' ? CODEX : undefined,
    );
    renderSelector();
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole('button', { name: '5.3 Codex' }));
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('set_code_agent_model', {
        backend: 'codex',
        model: 'gpt-5.3-codex',
      }),
    );
    expect(await screen.findByText('Codex · 5.3 Codex')).toBeInTheDocument();
    // The dialog stays open, as the SDK's does, with the pick now active.
    expect(modal()).toHaveAttribute('data-active', 'gpt-5.3-codex');
    await userEvent.click(
      screen.getByRole('button', { name: 'Default (5.2)' }),
    );
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('set_code_agent_model', {
        backend: 'codex',
        model: null,
      }),
    );
    expect(await screen.findByText('Codex · Default')).toBeInTheDocument();
    expect(modal()).toHaveAttribute('data-active', '__default__');
  });

  it('a refused pick toasts and reverts the label and the active row', async () => {
    invoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'list_code_agent_models') return CODEX;
      throw new Error('Codex refused model = gpt-5.3-codex: Invalid params');
    });
    renderSelector();
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole('button', { name: '5.3 Codex' }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        expect.stringContaining('refused'),
      ),
    );
    expect(screen.getByText('Codex · Default')).toBeInTheDocument();
    expect(modal()).toHaveAttribute('data-active', '__default__');
    expect(dialog.props.isSelecting).toBe(false);
  });

  it('a failed list shows on the button, and the click retries instead of opening', async () => {
    invoke.mockRejectedValueOnce(
      new Error(
        "agent sign-in required: Codex isn't signed in — sign in to Codex in the ChatGPT app, then send again.",
      ),
    );
    renderSelector();
    expect(
      await screen.findByText('Codex · Couldn’t load models'),
    ).toBeInTheDocument();
    invoke.mockResolvedValue(CODEX);
    await userEvent.click(trigger());
    expect(modal()).not.toBeInTheDocument();
    await waitFor(() =>
      expect(invoke).toHaveBeenLastCalledWith('list_code_agent_models', {
        backend: 'codex',
        refresh: true,
      }),
    );
    expect(await screen.findByText('Codex · Default')).toBeInTheDocument();
  });

  it('waits for the list before it opens', async () => {
    let resolve: (v: unknown) => void = () => {};
    invoke.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    renderSelector();
    expect(screen.getByText('Codex · Loading models…')).toBeInTheDocument();
    expect(trigger()).toBeDisabled();
    await act(async () => {
      resolve(CODEX);
    });
    expect(await screen.findByText('Codex · Default')).toBeInTheDocument();
    expect(trigger()).toBeEnabled();
  });

  it('closes on the dialog’s own close', async () => {
    invoke.mockResolvedValue(CODEX);
    renderSelector();
    await screen.findByText('Codex · Default');
    await userEvent.click(trigger());
    expect(modal()).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'close' }));
    expect(modal()).not.toBeInTheDocument();
  });

  it('a plain-string failure shows the desktop’s sentence in the tooltip, and a retry that fails again stays retryable', async () => {
    // Tauri rejects with the Rust `Err` string itself, not an Error.
    invoke.mockRejectedValueOnce(
      "Codex isn't installed — install it from the Code menu.",
    );
    renderSelector();
    expect(
      await screen.findByText('Codex · Couldn’t load models'),
    ).toBeInTheDocument();
    await userEvent.hover(trigger());
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      "Codex isn't installed — install it from the Code menu.",
    );
    invoke.mockRejectedValueOnce('Codex could not list its models: boom');
    await userEvent.click(trigger());
    await waitFor(() =>
      expect(invoke).toHaveBeenLastCalledWith('list_code_agent_models', {
        backend: 'codex',
        refresh: true,
      }),
    );
    expect(
      await screen.findByText('Codex · Couldn’t load models'),
    ).toBeInTheDocument();
    expect(trigger()).toBeEnabled();
    expect(modal()).not.toBeInTheDocument();
    invoke.mockResolvedValue(CODEX_CATALOG);
    await userEvent.click(trigger());
    expect(await screen.findByText('Codex · Default')).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledTimes(3);
  });

  it('Codex names no default: the Default row is bare, and an empty list is only that row', async () => {
    invoke.mockResolvedValue(CODEX_CATALOG);
    const first = renderSelector();
    expect(await screen.findByText('Codex · Default')).toBeInTheDocument();
    await userEvent.click(trigger());
    expect(
      dialog.props.llmProvider.chat_models.map((m: any) => m.display_name),
    ).toEqual(['Default', 'GPT-6-Sol', 'GPT-5.5']);
    first.unmount();
    invoke.mockResolvedValue({ models: [], default: null, selected: null });
    renderSelector();
    expect(await screen.findByText('Codex · Default')).toBeInTheDocument();
    await userEvent.click(trigger());
    expect(
      dialog.props.llmProvider.chat_models.map((m: any) => m.display_name),
    ).toEqual(['Default']);
  });

  it('keeps a saved pick the agent no longer offers visible by its id', async () => {
    invoke.mockResolvedValue({ ...CODEX_CATALOG, selected: 'gpt-retired' });
    renderSelector();
    expect(await screen.findByText('Codex · gpt-retired')).toBeInTheDocument();
    await userEvent.click(trigger());
    expect(modal()).toHaveAttribute('data-active', 'gpt-retired');
  });

  it('a Claude default entry without a description reads as plain Default', async () => {
    invoke.mockResolvedValue({
      ...CLAUDE,
      models: [
        { id: 'default', name: 'Default', description: null },
        ...CLAUDE.models.slice(1),
      ],
      selected: null,
    });
    renderSelector('claude');
    expect(
      await screen.findByText('Claude Code · Default'),
    ).toBeInTheDocument();
    await userEvent.click(trigger());
    expect(dialog.props.llmProvider.chat_models[0].display_name).toBe(
      'Default',
    );
  });

  it('a refused pick rejected as a plain string still toasts and reverts', async () => {
    invoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'list_code_agent_models') return CODEX_CATALOG;
      throw "Codex doesn't offer gpt-6-sol.";
    });
    renderSelector();
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole('button', { name: 'GPT-6-Sol' }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Codex doesn't offer gpt-6-sol."),
    );
    expect(screen.getByText('Codex · Default')).toBeInTheDocument();
    expect(modal()).toHaveAttribute('data-active', '__default__');
  });

  it('ignores the list of an agent it no longer shows', async () => {
    let answerCodex: (models: unknown) => void = () => {};
    invoke.mockImplementation((_cmd: string, args: { backend: string }) =>
      args.backend === 'codex'
        ? new Promise((resolve) => {
            answerCodex = resolve;
          })
        : Promise.resolve(CLAUDE),
    );
    const { rerender } = render(
      <TooltipProvider>
        <AgentModelSelector backend="codex" />
      </TooltipProvider>,
    );
    expect(screen.getByText('Codex · Loading models…')).toBeInTheDocument();
    // Switch once Codex's request is in flight — not before: two concurrent
    // dynamic imports of the Tauri module race under vitest's mocking (see
    // `callTauri` in coding-mode-button.tsx), which is not what this tests.
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('list_code_agent_models', {
        backend: 'codex',
        refresh: false,
      }),
    );
    rerender(
      <TooltipProvider>
        <AgentModelSelector backend="claude" />
      </TooltipProvider>,
    );
    expect(
      await screen.findByText('Claude Code · Sonnet 4.6'),
    ).toBeInTheDocument();
    // Codex's slow answer lands after the switch: it is not Claude's list.
    await act(async () => {
      answerCodex(CODEX_CATALOG);
    });
    expect(screen.getByText('Claude Code · Sonnet 4.6')).toBeInTheDocument();
    expect(trigger()).toBeEnabled();
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
