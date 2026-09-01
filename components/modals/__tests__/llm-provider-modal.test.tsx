import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import {
  setLocalLLMEnabled,
  setLocalLLMModel,
  setLocalLLMToolSupport,
} from '@iblai/iblai-js/web-containers';
import { LOCAL_LLM_CHANGED_EVENT } from '@/hooks/use-selected-local-model';

import { LLMProviderModal, type LLMProvider } from '../llm-provider-modal';

// next/image -> plain img so we can read src/alt/className directly.
vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    className,
  }: {
    src: string;
    alt: string;
    className?: string;
  }) => <img src={src} alt={alt} className={className} />,
}));

// Control the switch-permission + provider-detail helpers so every branch of
// `isDisabled` / grayscale can be exercised deterministically. `cn` is the real
// classname joiner (cheap, no side effects) so emitted classes are meaningful.
let mockSwitchLLm = true;
let mockSwitchProvider = true;
// On-device model state — OFF by default so the cloud-only tests are unaffected
// (localModels is gated on `isAvailable`); one test flips these on to exercise
// the available-first ordering.
let mockLocalAvailable = false;
let mockInstalledModels: string[] = [];
// Download state + stable action spies, so a test can put a model "downloading"
// and assert the cancel / "already downloading" notice behavior.
let mockDownloadState: {
  status: string;
  progress: number;
  activeModel?: string;
  message: string;
  logs: unknown[];
  lastUpdated: string;
} = {
  status: 'idle',
  progress: 0,
  activeModel: undefined,
  message: '',
  logs: [],
  lastUpdated: '',
};
const mockStartDownload = vi.fn();
const mockCancelDownload = vi.fn();
// Machine capacity behind the "may be too large" confirmation. null = unknown,
// which must let the download proceed rather than block on missing data.
let mockSystemMemory: { ram_total: number; vram_total: number } | null = null;
vi.mock('@/hooks/use-model-download', () => ({
  useModelDownload: () => ({
    isAvailable: mockLocalAvailable,
    state: mockDownloadState,
    ollamaStatus: { installed_models: mockInstalledModels },
    systemMemory: mockSystemMemory,
    startDownload: mockStartDownload,
    cancelDownload: mockCancelDownload,
  }),
}));
vi.mock('@iblai/iblai-js/web-containers', () => ({
  LOCAL_MODELS: [
    {
      name: 'Zeta Download',
      provider: 'OpenAI',
      id: 'dl-model',
      size: '3 GB',
      tool_support: true,
    },
    {
      name: 'Alpha Ready',
      provider: 'OpenAI',
      id: 'ready-model',
      size: '2 GB',
      tool_support: true,
    },
  ],
  isLocalLLMEnabled: () => mockLocalEnabled,
  getLocalLLMModel: () => mockLocalModelId,
  getLocalLLMToolSupport: () => true,
  setLocalLLMModel: vi.fn(),
  setLocalLLMEnabled: vi.fn(),
  setLocalLLMToolSupport: vi.fn(),
}));
// The device-global on-device selection the modal mirrors into local state.
let mockLocalEnabled = false;
let mockLocalModelId: string | null = null;
vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => {
    const out: string[] = [];
    for (const a of args) {
      if (typeof a === 'string') out.push(a);
      else if (a && typeof a === 'object') {
        for (const [k, v] of Object.entries(a as Record<string, unknown>)) {
          if (v) out.push(k);
        }
      }
    }
    return out.join(' ');
  },
  canSwitchLLm: () => mockSwitchLLm,
  canSwitchProvider: () => mockSwitchProvider,
  getLLMProviderDetails: (provider: string, name: string) => ({
    logo: `/logo-${provider}-${name}.png`,
    name: provider,
  }),
  getProviderName: (name: string) =>
    (name ?? '').toLowerCase().replace(/[^a-z0-9]/g, ''),
}));

const buildProvider = (): LLMProvider => ({
  id: 1,
  name: 'openai',
  chat_models: [
    {
      llm_name: 'gpt-4',
      description: 'GPT 4',
      display_name: 'GPT-4',
      is_multimodal: true,
      training_data: '2023',
      context_window: '128k',
    },
    {
      llm_name: 'gpt-3.5',
      description: 'GPT 3.5',
      display_name: 'GPT-3.5',
      is_multimodal: false,
      training_data: '2022',
      context_window: '16k',
    },
  ],
  has_credentials: true,
});

const baseProps = () => ({
  isOpen: true,
  onClose: vi.fn(),
  onSelect: vi.fn().mockResolvedValue(undefined),
  llmProvider: buildProvider(),
  isSelecting: false,
  mentorSettings: { llm_name: 'gpt-4', llm_provider: 'openai' },
  llms: [{ name: 'openai', chat_models: [{}] }],
});

describe('LLMProviderModal', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockSwitchLLm = true;
    mockSwitchProvider = true;
    mockLocalAvailable = false;
    mockInstalledModels = [];
    mockDownloadState = {
      status: 'idle',
      progress: 0,
      activeModel: undefined,
      message: '',
      logs: [],
      lastUpdated: '',
    };
    mockStartDownload.mockClear();
    mockCancelDownload.mockClear();
    mockSystemMemory = null;
    mockLocalEnabled = false;
    mockLocalModelId = null;
  });

  it('does not render content when closed', () => {
    render(<LLMProviderModal {...baseProps()} isOpen={false} />);
    expect(screen.queryByText('LLM Selection')).not.toBeInTheDocument();
  });

  it('renders title, subtitle, sr-only description, search and all models', () => {
    render(<LLMProviderModal {...baseProps()} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('LLM Selection')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Choose your preferred LLM from the available provider to tailor your experience.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Select one of the agents provided by openai'),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search')).toBeInTheDocument();

    expect(screen.getByText('GPT-4')).toBeInTheDocument();
    expect(screen.getByText('GPT-3.5')).toBeInTheDocument();
  });

  it('labels rows with the API display name, not the wire key', () => {
    // Regression: rows rendered `llm_name`, so ibl.ai's model showed as
    // "iblai" and Bedrock's as "amazon.nova-2-lite-v1:0". The API ships a
    // human label per model; the raw key is the identifier, not the label.
    render(<LLMProviderModal {...baseProps()} />);

    expect(screen.getByText('GPT-4')).toBeInTheDocument();
    expect(screen.queryByText('gpt-4')).not.toBeInTheDocument();
  });

  it('falls back to the wire key when the API omits a display name', () => {
    const provider = buildProvider();
    // @ts-expect-error - exercising a payload where the label is absent
    delete provider.chat_models[0].display_name;

    render(<LLMProviderModal {...baseProps()} llmProvider={provider} />);

    expect(screen.getByText('gpt-4')).toBeInTheDocument();
  });

  it('searches on the visible label as well as the wire key', () => {
    render(<LLMProviderModal {...baseProps()} />);

    // Typing what is on screen has to work...
    fireEvent.change(screen.getByPlaceholderText('Search'), {
      target: { value: 'GPT-3.5' },
    });
    expect(screen.getByText('GPT-3.5')).toBeInTheDocument();
    expect(screen.queryByText('GPT-4')).not.toBeInTheDocument();

    // ...and so does the raw key, for anyone who knows it.
    fireEvent.change(screen.getByPlaceholderText('Search'), {
      target: { value: 'gpt-4' },
    });
    expect(screen.getByText('GPT-4')).toBeInTheDocument();
    expect(screen.queryByText('GPT-3.5')).not.toBeInTheDocument();
  });

  it('does not crash when the provider has no chat_models array', () => {
    // Regression: a provider can come back from the API without `chat_models`.
    // The unguarded `.filter` used to throw in render and unmount the dialog
    // (seen when opening Agent settings while a local model was active).
    const props = {
      ...baseProps(),
      llmProvider: {
        ...buildProvider(),
        chat_models: undefined,
      } as unknown as LLMProvider,
    };
    expect(() => render(<LLMProviderModal {...props} />)).not.toThrow();
    // The dialog shell still renders; there are just no cloud model rows.
    expect(screen.getByText('LLM Selection')).toBeInTheDocument();
    expect(screen.queryByText('GPT-4')).not.toBeInTheDocument();
  });

  it('lists available (installed) local models before unavailable (downloadable) ones', () => {
    // Catalog order is [Zeta Download (not installed), Alpha Ready (installed)];
    // the merged list must reorder so the ready one comes first.
    mockLocalAvailable = true;
    mockInstalledModels = ['ready-model'];
    render(<LLMProviderModal {...baseProps()} />);

    const ready = screen.getByText('Alpha Ready');
    const download = screen.getByText('Zeta Download');
    // "Zeta Download" must FOLLOW "Alpha Ready" in the DOM (installed sorts
    // first), even though it comes first in the catalog.
    expect(
      ready.compareDocumentPosition(download) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('lists an available local model before unavailable cloud models', () => {
    // The reported case: the provider has no credentials, so its cloud models
    // are unavailable — an installed on-device model must lead the whole list,
    // not sit behind the cloud models.
    mockSwitchLLm = false; // provider not switchable → cloud models unavailable
    mockLocalAvailable = true;
    mockInstalledModels = ['ready-model'];
    render(
      <LLMProviderModal
        {...baseProps()}
        // No cloud model matches the mentor's current one, so none is "in use".
        mentorSettings={{ llm_name: 'none', llm_provider: 'none' }}
      />,
    );

    const ready = screen.getByText('Alpha Ready');
    const cloud = screen.getByText('GPT-4');
    // The installed local model precedes the unavailable cloud model.
    expect(
      ready.compareDocumentPosition(cloud) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('cancels the download when the downloading model itself is clicked', () => {
    mockLocalAvailable = true;
    mockDownloadState = {
      status: 'downloading',
      progress: 40,
      activeModel: 'dl-model', // "Zeta Download" is the one pulling
      message: '',
      logs: [],
      lastUpdated: '',
    };
    render(<LLMProviderModal {...baseProps()} />);

    fireEvent.click(screen.getByText('Zeta Download'));

    expect(mockCancelDownload).toHaveBeenCalled();
    // Clicking the active model cancels it — no "already downloading" notice.
    expect(
      screen.queryByText('A model is already downloading'),
    ).not.toBeInTheDocument();
  });

  it('shows an "already downloading" notice when a different model is clicked', () => {
    mockLocalAvailable = true;
    mockDownloadState = {
      status: 'downloading',
      progress: 40,
      activeModel: 'dl-model', // "Zeta Download" is pulling
      message: '',
      logs: [],
      lastUpdated: '',
    };
    render(<LLMProviderModal {...baseProps()} />);

    // Click a DIFFERENT model ("Alpha Ready") → info dialog, no download action.
    fireEvent.click(screen.getByText('Alpha Ready'));

    expect(
      screen.getByText('A model is already downloading'),
    ).toBeInTheDocument();
    expect(screen.getByText(/is being downloaded/)).toBeInTheDocument();
    expect(mockStartDownload).not.toHaveBeenCalled();
    expect(mockCancelDownload).not.toHaveBeenCalled();
  });

  it('disables the active model and enables the non-active one (no grayscale on active)', () => {
    render(<LLMProviderModal {...baseProps()} />);

    // gpt-4 is the active model (matches mentorSettings) -> disabled + active styling.
    const activeBtn = screen.getByText('GPT-4').closest('button')!;
    expect(activeBtn).toBeDisabled();
    expect(activeBtn.className).toContain('border-blue-500');
    const activeImg = activeBtn.querySelector('img')!;
    expect(activeImg.className).not.toContain('grayscale');

    // gpt-3.5 is selectable.
    const otherBtn = screen.getByText('GPT-3.5').closest('button')!;
    expect(otherBtn).not.toBeDisabled();
  });

  it('invokes onSelect with provider + model when an enabled model is clicked', () => {
    const props = baseProps();
    render(<LLMProviderModal {...props} />);

    fireEvent.click(screen.getByText('GPT-3.5').closest('button')!);

    expect(props.onSelect).toHaveBeenCalledWith('openai', 'gpt-3.5');
  });

  it('disables every model and greys out non-active logos when switching LLMs is not allowed', () => {
    mockSwitchLLm = false;
    render(<LLMProviderModal {...baseProps()} />);

    const otherBtn = screen.getByText('GPT-3.5').closest('button')!;
    expect(otherBtn).toBeDisabled();
    // Non-active + disabled -> grayscale logo branch.
    expect(otherBtn.querySelector('img')!.className).toContain('grayscale');
  });

  it('disables models when the provider cannot be switched', () => {
    mockSwitchProvider = false;
    render(<LLMProviderModal {...baseProps()} />);

    expect(screen.getByText('GPT-3.5').closest('button')!).toBeDisabled();
  });

  it('disables the search input and all models while a selection is in flight', () => {
    render(<LLMProviderModal {...baseProps()} isSelecting />);

    expect(screen.getByPlaceholderText('Search')).toBeDisabled();
    expect(screen.getByText('GPT-3.5').closest('button')!).toBeDisabled();
  });

  it('filters the model grid by the search query (case-insensitive)', () => {
    render(<LLMProviderModal {...baseProps()} />);

    fireEvent.change(screen.getByPlaceholderText('Search'), {
      target: { value: 'GPT-3' },
    });

    expect(screen.getByText('GPT-3.5')).toBeInTheDocument();
    expect(screen.queryByText('GPT-4')).not.toBeInTheDocument();
  });

  it('renders no model buttons when the query matches nothing', () => {
    render(<LLMProviderModal {...baseProps()} />);

    fireEvent.change(screen.getByPlaceholderText('Search'), {
      target: { value: 'no-such-model' },
    });

    expect(screen.queryByText('GPT-4')).not.toBeInTheDocument();
    expect(screen.queryByText('GPT-3.5')).not.toBeInTheDocument();
  });

  it('keeps a just-completed download "installed" before the tags refresh lands', () => {
    // Regression ("downloading a model flashes complete"): the terminal
    // `completed` event fires checkStatus, which churns downloadState.status
    // (completed → checking → idle) before /api/tags refreshes, so the row used
    // to flicker back to a Download button. With installed_models still empty,
    // the completed model must already read as installed.
    mockLocalAvailable = true;
    mockInstalledModels = [];
    mockDownloadState = {
      status: 'completed',
      progress: 100,
      activeModel: 'dl-model',
      message: '',
      logs: [],
      lastUpdated: '',
    };
    render(<LLMProviderModal {...baseProps()} />);

    expect(
      screen.getByLabelText('Use Zeta Download, on-device model'),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/^Download Zeta Download/),
    ).not.toBeInTheDocument();
  });

  it('shows progress on the row even when activeModel carries a :tag suffix', () => {
    // Regression ("download started in Ollama but the row stays 'downloadable'
    // with no progress"): download state / Ollama tags can carry a tag suffix the
    // catalog id lacks, so an exact `===` failed to match the row to its own pull.
    // Base-name matching must still recognize it.
    mockLocalAvailable = true;
    mockInstalledModels = [];
    mockDownloadState = {
      status: 'downloading',
      progress: 42,
      activeModel: 'dl-model:latest',
      message: '',
      logs: [],
      lastUpdated: '',
    };
    render(<LLMProviderModal {...baseProps()} />);

    expect(
      screen.getByLabelText('Cancel download of Zeta Download, 42 percent'),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/^Download Zeta Download/),
    ).not.toBeInTheDocument();
  });

  it('calls onClose when the dialog requests to close (Escape)', () => {
    const props = baseProps();
    render(<LLMProviderModal {...props} />);

    fireEvent.keyDown(screen.getByRole('dialog'), {
      key: 'Escape',
      code: 'Escape',
    });

    expect(props.onClose).toHaveBeenCalled();
  });

  // ==========================================================================
  // Starting an on-device download
  // ==========================================================================

  describe('starting a download', () => {
    beforeEach(() => {
      mockLocalAvailable = true;
    });

    it('starts immediately when the machine has room', () => {
      // The warn fraction is a deliberately low testing value (1% of capacity),
      // so "room" for a 3GB model means a very large reported total.
      mockSystemMemory = {
        ram_total: 512 * 1024 ** 3,
        vram_total: 64 * 1024 ** 3,
      };
      render(<LLMProviderModal {...baseProps()} />);

      fireEvent.click(screen.getByText('Zeta Download'));

      expect(mockStartDownload).toHaveBeenCalledWith('dl-model');
      expect(
        screen.queryByText('This model may be too large for your system'),
      ).not.toBeInTheDocument();
    });

    it('starts without confirmation when the machine capacity is unknown', () => {
      // Missing memory data must not block the download.
      mockSystemMemory = null;
      render(<LLMProviderModal {...baseProps()} />);

      fireEvent.click(screen.getByText('Zeta Download'));

      expect(mockStartDownload).toHaveBeenCalledWith('dl-model');
    });

    it('asks first when the model may be too large for this machine', () => {
      // Tiny reported capacity, so the 3GB model trips the warn fraction.
      mockSystemMemory = { ram_total: 1024, vram_total: 512 };
      render(<LLMProviderModal {...baseProps()} />);

      fireEvent.click(screen.getByText('Zeta Download'));

      expect(
        screen.getByText('This model may be too large for your system'),
      ).toBeInTheDocument();
      expect(screen.getByText(/needs about 3 GB/)).toBeInTheDocument();
      // Nothing is pulled until the user answers.
      expect(mockStartDownload).not.toHaveBeenCalled();
    });

    it('downloads anyway when the warning is confirmed', () => {
      mockSystemMemory = { ram_total: 1024, vram_total: 512 };
      render(<LLMProviderModal {...baseProps()} />);
      fireEvent.click(screen.getByText('Zeta Download'));

      fireEvent.click(screen.getByText('Download anyway'));

      expect(mockStartDownload).toHaveBeenCalledWith('dl-model');
      expect(
        screen.queryByText('This model may be too large for your system'),
      ).not.toBeInTheDocument();
    });

    it('abandons the download when the warning is cancelled', () => {
      mockSystemMemory = { ram_total: 1024, vram_total: 512 };
      render(<LLMProviderModal {...baseProps()} />);
      fireEvent.click(screen.getByText('Zeta Download'));

      fireEvent.click(screen.getByText('Cancel'));

      expect(mockStartDownload).not.toHaveBeenCalled();
      expect(
        screen.queryByText('This model may be too large for your system'),
      ).not.toBeInTheDocument();
    });

    it('dismisses the "already downloading" notice', () => {
      mockDownloadState = {
        status: 'downloading',
        progress: 40,
        activeModel: 'dl-model',
        message: '',
        logs: [],
        lastUpdated: '',
      };
      render(<LLMProviderModal {...baseProps()} />);
      fireEvent.click(screen.getByText('Alpha Ready'));
      expect(
        screen.getByText('A model is already downloading'),
      ).toBeInTheDocument();

      fireEvent.click(screen.getByText('Got it'));

      expect(
        screen.queryByText('A model is already downloading'),
      ).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Choosing between on-device and cloud
  // ==========================================================================

  describe('switching between on-device and cloud', () => {
    it('switches chat to an installed on-device model', () => {
      mockLocalAvailable = true;
      mockInstalledModels = ['ready-model'];
      const dispatched: string[] = [];
      const listener = (e: Event) => dispatched.push(e.type);
      window.addEventListener(LOCAL_LLM_CHANGED_EVENT, listener);

      try {
        render(<LLMProviderModal {...baseProps()} />);
        fireEvent.click(screen.getByText('Alpha Ready'));

        expect(setLocalLLMModel).toHaveBeenCalledWith('ready-model');
        expect(setLocalLLMEnabled).toHaveBeenCalledWith(true);
        // Tool support is persisted too, or local chat rejects a tool-capable
        // model with tool_support=false.
        expect(setLocalLLMToolSupport).toHaveBeenCalledWith(true);
        // Same-tab listeners (the nav-bar badge) need the explicit event.
        expect(dispatched).toEqual([LOCAL_LLM_CHANGED_EVENT]);
        // The row now reads as in use.
        expect(screen.getByText('In use')).toBeInTheDocument();
      } finally {
        window.removeEventListener(LOCAL_LLM_CHANGED_EVENT, listener);
      }
    });

    it('does nothing when the already-selected on-device model is clicked', () => {
      mockLocalAvailable = true;
      mockInstalledModels = ['ready-model'];
      mockLocalEnabled = true;
      mockLocalModelId = 'ready-model';
      render(<LLMProviderModal {...baseProps()} />);

      fireEvent.click(screen.getByText('Alpha Ready'));

      expect(setLocalLLMModel).not.toHaveBeenCalled();
      expect(mockStartDownload).not.toHaveBeenCalled();
      expect(mockCancelDownload).not.toHaveBeenCalled();
    });

    it('turns on-device mode off when a cloud model is picked', () => {
      mockLocalAvailable = true;
      mockLocalEnabled = true;
      mockLocalModelId = 'ready-model';
      const dispatched: string[] = [];
      const listener = (e: Event) => dispatched.push(e.type);
      window.addEventListener(LOCAL_LLM_CHANGED_EVENT, listener);

      try {
        const props = baseProps();
        render(<LLMProviderModal {...props} />);

        fireEvent.click(screen.getByText('GPT-3.5').closest('button')!);

        expect(setLocalLLMEnabled).toHaveBeenCalledWith(false);
        expect(dispatched).toEqual([LOCAL_LLM_CHANGED_EVENT]);
        expect(props.onSelect).toHaveBeenCalledWith('openai', 'gpt-3.5');
      } finally {
        window.removeEventListener(LOCAL_LLM_CHANGED_EVENT, listener);
      }
    });

    it('leaves on-device mode alone when it was already off', () => {
      const props = baseProps();
      render(<LLMProviderModal {...props} />);

      fireEvent.click(screen.getByText('GPT-3.5').closest('button')!);

      expect(setLocalLLMEnabled).not.toHaveBeenCalled();
      expect(props.onSelect).toHaveBeenCalledWith('openai', 'gpt-3.5');
    });
  });
});
