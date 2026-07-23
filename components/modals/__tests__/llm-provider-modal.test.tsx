import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

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
vi.mock('@/hooks/use-model-download', () => ({
  useModelDownload: () => ({
    isAvailable: mockLocalAvailable,
    state: {
      status: 'idle',
      progress: 0,
      activeModel: undefined,
      message: '',
      logs: [],
      lastUpdated: '',
    },
    ollamaStatus: { installed_models: mockInstalledModels },
    startDownload: vi.fn(),
    cancelDownload: vi.fn(),
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
  isLocalLLMEnabled: () => false,
  getLocalLLMModel: () => null,
  getLocalLLMToolSupport: () => true,
  setLocalLLMModel: vi.fn(),
  setLocalLLMEnabled: vi.fn(),
  setLocalLLMToolSupport: vi.fn(),
}));
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

    expect(screen.getByText('gpt-4')).toBeInTheDocument();
    expect(screen.getByText('gpt-3.5')).toBeInTheDocument();
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
    expect(screen.queryByText('gpt-4')).not.toBeInTheDocument();
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
    const cloud = screen.getByText('gpt-4');
    // The installed local model precedes the unavailable cloud model.
    expect(
      ready.compareDocumentPosition(cloud) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('disables the active model and enables the non-active one (no grayscale on active)', () => {
    render(<LLMProviderModal {...baseProps()} />);

    // gpt-4 is the active model (matches mentorSettings) -> disabled + active styling.
    const activeBtn = screen.getByText('gpt-4').closest('button')!;
    expect(activeBtn).toBeDisabled();
    expect(activeBtn.className).toContain('border-blue-500');
    const activeImg = activeBtn.querySelector('img')!;
    expect(activeImg.className).not.toContain('grayscale');

    // gpt-3.5 is selectable.
    const otherBtn = screen.getByText('gpt-3.5').closest('button')!;
    expect(otherBtn).not.toBeDisabled();
  });

  it('invokes onSelect with provider + model when an enabled model is clicked', () => {
    const props = baseProps();
    render(<LLMProviderModal {...props} />);

    fireEvent.click(screen.getByText('gpt-3.5').closest('button')!);

    expect(props.onSelect).toHaveBeenCalledWith('openai', 'gpt-3.5');
  });

  it('disables every model and greys out non-active logos when switching LLMs is not allowed', () => {
    mockSwitchLLm = false;
    render(<LLMProviderModal {...baseProps()} />);

    const otherBtn = screen.getByText('gpt-3.5').closest('button')!;
    expect(otherBtn).toBeDisabled();
    // Non-active + disabled -> grayscale logo branch.
    expect(otherBtn.querySelector('img')!.className).toContain('grayscale');
  });

  it('disables models when the provider cannot be switched', () => {
    mockSwitchProvider = false;
    render(<LLMProviderModal {...baseProps()} />);

    expect(screen.getByText('gpt-3.5').closest('button')!).toBeDisabled();
  });

  it('disables the search input and all models while a selection is in flight', () => {
    render(<LLMProviderModal {...baseProps()} isSelecting />);

    expect(screen.getByPlaceholderText('Search')).toBeDisabled();
    expect(screen.getByText('gpt-3.5').closest('button')!).toBeDisabled();
  });

  it('filters the model grid by the search query (case-insensitive)', () => {
    render(<LLMProviderModal {...baseProps()} />);

    fireEvent.change(screen.getByPlaceholderText('Search'), {
      target: { value: 'GPT-3' },
    });

    expect(screen.getByText('gpt-3.5')).toBeInTheDocument();
    expect(screen.queryByText('gpt-4')).not.toBeInTheDocument();
  });

  it('renders no model buttons when the query matches nothing', () => {
    render(<LLMProviderModal {...baseProps()} />);

    fireEvent.change(screen.getByPlaceholderText('Search'), {
      target: { value: 'no-such-model' },
    });

    expect(screen.queryByText('gpt-4')).not.toBeInTheDocument();
    expect(screen.queryByText('gpt-3.5')).not.toBeInTheDocument();
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
});
