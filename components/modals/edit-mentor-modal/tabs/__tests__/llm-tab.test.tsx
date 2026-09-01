import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setLocalLLMToolSupport } from '@iblai/iblai-js/web-containers';
import { LLMTab } from '../llm-tab';

// ============================================================================
// MOCKS
// ============================================================================

const mockEditMentor = vi.fn();
const mockUnwrap = vi.fn();
let mockIsEditing = false;

const mockGetMentorSettingsQuery = vi.fn();
const mockGetLlmsQuery = vi.fn();
const mockGetMentorId = vi.fn();
const mockUseParams = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => (
    <img src={src} alt={alt} {...props} />
  ),
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => 'test-user',
}));

vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({ getMentorId: mockGetMentorId }),
}));

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetMentorSettingsQuery: (...args: unknown[]) =>
    mockGetMentorSettingsQuery(...args),
  useGetLlmsQuery: (...args: unknown[]) => mockGetLlmsQuery(...args),
  useEditMentorMutation: () => [
    (...args: unknown[]) => {
      mockEditMentor(...args);
      return { unwrap: mockUnwrap };
    },
    { isLoading: mockIsEditing },
  ],
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

// extractErrorMessage just returns the fallback string here.
vi.mock('@/lib/error', () => ({
  extractErrorMessage: (_error: unknown, fallback: string) => fallback,
}));

// WithFormPermissions renders its children with a controllable `disabled` flag.
const mockPermissionsDisabled = vi.fn();
vi.mock('@/hoc/withPermissions', () => ({
  default: ({ children }: any) =>
    children({ disabled: mockPermissionsDisabled() }),
}));

// Desktop detection is the gate on the local-only provider cards; off by default
// so the cloud tests above see the browser behaviour.
let mockIsTauri = false;
// A catalog shaped to exercise every branch of the localOnlyProviders memo:
// two models sharing a provider (the `seen` dedupe), one whose provider the
// backend already lists as a cloud provider (the `cloudKeys` skip), and a
// second local-only provider listed out of alphabetical order so the block's
// own sort is observable. The localStorage helpers keep their real semantics so
// useSelectedLocalModel — which this tab uses to decide which card is active —
// still works unmocked.
vi.mock('@iblai/iblai-js/web-containers', () => ({
  isTauriApp: () => mockIsTauri,
  LOCAL_MODELS: [
    {
      id: 'mistral-7b',
      name: 'Mistral 7B',
      provider: 'Mistral',
      size: '4 GB',
      tool_support: false,
    },
    {
      id: 'llama3.2',
      name: 'Llama 3.2',
      provider: 'Meta',
      size: '2 GB',
      tool_support: true,
    },
    {
      id: 'llama3.3',
      name: 'Llama 3.3',
      provider: 'Meta',
      size: '4 GB',
      tool_support: true,
    },
    {
      id: 'gpt-oss',
      name: 'GPT OSS',
      provider: 'OpenAI',
      size: '12 GB',
      tool_support: true,
    },
  ],
  isLocalLLMEnabled: () =>
    localStorage.getItem('ibl_local_llm_enabled') === 'true',
  getLocalLLMModel: () => localStorage.getItem('ibl_local_llm_model'),
  // Stale cache: the stored flag says the model cannot call tools while the
  // catalog says it can. useSelectedLocalModel reconciles that on read, and
  // local streaming chat depends on it — so keep the mismatch real here.
  getLocalLLMToolSupport: () => false,
  setLocalLLMToolSupport: vi.fn(),
}));

// Stub the provider modal so we can assert it opens and forwards selection.
const mockModalProps = vi.fn();
vi.mock('@/components/modals/llm-provider-modal', () => ({
  LLMProviderModal: (props: any) => {
    mockModalProps(props);
    return props.isOpen ? (
      <div data-testid="llm-provider-modal">
        <span>{props.llmProvider?.name}</span>
        <button
          data-testid="modal-select"
          onClick={() => props.onSelect('openai', 'gpt-4o')}
        >
          select
        </button>
        <button data-testid="modal-close" onClick={props.onClose}>
          close
        </button>
      </div>
    ) : null;
  },
}));

// ============================================================================
// TEST DATA
// ============================================================================

const llmProviders = [
  {
    id: 1,
    name: 'openai',
    logo: '/openai.png',
    description: 'OpenAI provider',
    chat_models: [],
    has_credentials: true,
    main_has_credentials: true,
    can_use_main_keys: true,
  },
  {
    id: 2,
    name: 'anthropic',
    logo: '/anthropic.png',
    description: 'Anthropic provider',
    chat_models: [],
  },
];

const mentorSettings = {
  llm_name: 'gpt-4o',
  llm_provider: 'openai',
  permissions: { field: { llm_provider: { read: true, write: true } } },
};

// Provider cards expose a stable testid plus the raw backend name, so tests (and
// E2E) can target one without depending on the Tailwind classes.
const providerCard = (container: HTMLElement, name: string) =>
  container.querySelector<HTMLElement>(
    `[data-testid="llm-provider-card"][data-provider="${name}"]`,
  );

// ============================================================================
// TESTS
// ============================================================================

describe('LLMTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The on-device selection lives in localStorage; clear it so a test that
    // enables local mode can't leak into the (default cloud) tests.
    localStorage.clear();
    mockIsEditing = false;
    mockIsTauri = false;
    mockUnwrap.mockResolvedValue({});
    mockUseParams.mockReturnValue({
      tenantKey: 'test-tenant',
      mentorId: 'mentor-123',
    });
    mockGetMentorId.mockReturnValue(null);
    mockPermissionsDisabled.mockReturnValue(false);
    mockGetMentorSettingsQuery.mockReturnValue({
      data: mentorSettings,
      isLoading: false,
    });
    mockGetLlmsQuery.mockReturnValue({
      data: llmProviders,
      isLoading: false,
    });
  });

  it('renders the configuration header by default', () => {
    render(<LLMTab />);
    expect(screen.getByText('LLM Configuration')).toBeInTheDocument();
    expect(
      screen.getByText('Configure the language model settings for your agent.'),
    ).toBeInTheDocument();
  });

  it('hides the configuration header when showConfigurationHeader is false', () => {
    render(<LLMTab showConfigurationHeader={false} />);
    expect(screen.queryByText('LLM Configuration')).not.toBeInTheDocument();
  });

  it('renders the search input and provider cards', () => {
    render(<LLMTab />);
    expect(screen.getByPlaceholderText('Search Providers')).toBeInTheDocument();
    // getLLMProviderDetails maps "openai" -> OpenAI and "anthropic" -> Anthropic
    expect(screen.getByText('OpenAI')).toBeInTheDocument();
    expect(screen.getByText('Anthropic')).toBeInTheDocument();
  });

  it('shows a spinner while loading', () => {
    mockGetLlmsQuery.mockReturnValue({ data: undefined, isLoading: true });
    render(<LLMTab />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('filters provider cards by the search query', async () => {
    const user = userEvent.setup();
    render(<LLMTab />);

    const search = screen.getByPlaceholderText('Search Providers');
    await user.type(search, 'anthropic');

    expect(screen.getByText('Anthropic')).toBeInTheDocument();
    expect(screen.queryByText('OpenAI')).not.toBeInTheDocument();
  });

  it('highlights the currently selected provider', () => {
    const { container } = render(<LLMTab />);
    // openai card carries the active border-blue-500 class
    expect(container.querySelector('.border-blue-500')).toBeInTheDocument();
  });

  it('does not highlight the stale cloud provider when an on-device model is active', async () => {
    // Bug: the tab highlighted the mentor's cloud provider (openai) even though
    // chat was actually using a local model (Llama 3.2 → Meta). With local mode
    // on, the openai card — the only provider here matching the cloud setting —
    // must lose its active border (no cloud card matches the local "meta" key).
    localStorage.setItem('ibl_local_llm_enabled', 'true');
    localStorage.setItem('ibl_local_llm_model', 'llama3.2');
    const { container } = render(<LLMTab />);
    await waitFor(() => {
      expect(
        container.querySelector('.border-blue-500'),
      ).not.toBeInTheDocument();
    });
  });

  it('opens the provider modal when a provider card is clicked', async () => {
    const user = userEvent.setup();
    render(<LLMTab />);

    await user.click(screen.getByText('Anthropic'));

    expect(screen.getByTestId('llm-provider-modal')).toBeInTheDocument();
  });

  it('does not open the modal when permissions disable the card', async () => {
    mockPermissionsDisabled.mockReturnValue(true);
    const user = userEvent.setup();
    render(<LLMTab />);

    await user.click(screen.getByText('Anthropic'));

    expect(screen.queryByTestId('llm-provider-modal')).not.toBeInTheDocument();
  });

  it('does not open the modal when the tab is disabled (editing in progress)', async () => {
    mockIsEditing = true;
    const user = userEvent.setup();
    render(<LLMTab />);

    await user.click(screen.getByText('Anthropic'));

    expect(screen.queryByTestId('llm-provider-modal')).not.toBeInTheDocument();
  });

  it('updates the mentor LLM and shows a success toast on selection', async () => {
    const user = userEvent.setup();
    render(<LLMTab />);

    await user.click(screen.getByText('Anthropic'));
    fireEvent.click(screen.getByTestId('modal-select'));

    await waitFor(() => {
      expect(mockEditMentor).toHaveBeenCalledWith(
        expect.objectContaining({
          mentor: 'mentor-123',
          org: 'test-tenant',
          userId: 'test-user',
          formData: { llm_provider: 'openai', llm_name: 'gpt-4o' },
        }),
      );
    });

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('LLM updated successfully');
    });
  });

  it('shows an error toast when the LLM update fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockUnwrap.mockRejectedValue(new Error('update failed'));
    const user = userEvent.setup();
    render(<LLMTab />);

    await user.click(screen.getByText('Anthropic'));
    fireEvent.click(screen.getByTestId('modal-select'));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Failed to update LLM');
    });

    consoleSpy.mockRestore();
  });

  it('closes the modal when its onClose is triggered', async () => {
    const user = userEvent.setup();
    render(<LLMTab />);

    await user.click(screen.getByText('Anthropic'));
    expect(screen.getByTestId('llm-provider-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('modal-close'));
    expect(screen.queryByTestId('llm-provider-modal')).not.toBeInTheDocument();
  });

  it('does not render the modal when mentorSettings is missing', async () => {
    mockGetMentorSettingsQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
    });
    const user = userEvent.setup();
    render(<LLMTab />);

    await user.click(screen.getByText('Anthropic'));

    expect(screen.queryByTestId('llm-provider-modal')).not.toBeInTheDocument();
  });

  it('uses getMentorId when it returns a value', () => {
    mockGetMentorId.mockReturnValue('modal-mentor-789');
    render(<LLMTab />);

    expect(mockGetMentorSettingsQuery).toHaveBeenCalledWith(
      expect.objectContaining({ mentor: 'modal-mentor-789' }),
      expect.anything(),
    );
  });

  it('falls back to the URL mentorId when getMentorId returns null', () => {
    render(<LLMTab />);

    expect(mockGetMentorSettingsQuery).toHaveBeenCalledWith(
      expect.objectContaining({ mentor: 'mentor-123' }),
      expect.anything(),
    );
  });

  it('disables the search input while data is loading', () => {
    mockGetMentorSettingsQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    });
    render(<LLMTab />);
    expect(screen.getByPlaceholderText('Search Providers')).toBeDisabled();
  });

  it('handles an empty providers list without crashing', () => {
    mockGetLlmsQuery.mockReturnValue({ data: [], isLoading: false });
    render(<LLMTab />);
    expect(screen.getByPlaceholderText('Search Providers')).toBeInTheDocument();
  });

  it('handles an undefined providers list without crashing', () => {
    mockGetLlmsQuery.mockReturnValue({ data: undefined, isLoading: false });
    render(<LLMTab />);
    expect(screen.getByPlaceholderText('Search Providers')).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // Provider grid ordering
  // --------------------------------------------------------------------------
  describe('provider ordering', () => {
    // Deliberately supplied in raw-key alphabetical order (anthropic, bedrock,
    // groq, openai) so any assertion below fails if the grid just renders the
    // API list as-is. Grouping is by canAccessProvider — credentials *and* at
    // least one chat model — so every fixture carries chat_models and the
    // credential flags are what decide the group.
    const someModels = [{ llm_name: 'model-1' }];
    const mixedProviders = [
      {
        id: 1,
        name: 'anthropic',
        logo: '',
        description: '',
        chat_models: someModels,
      },
      {
        id: 2,
        name: 'bedrock',
        logo: '',
        description: '',
        chat_models: someModels,
        // No main_has_credentials at all — still counts as "we have a key".
        can_use_main_keys: true,
      },
      {
        id: 3,
        name: 'groq',
        logo: '',
        description: '',
        chat_models: someModels,
        can_use_main_keys: true,
        main_has_credentials: false,
      },
      {
        id: 4,
        name: 'openai',
        logo: '',
        description: '',
        chat_models: someModels,
        has_credentials: true,
      },
    ];

    const renderedProviderNames = (container: HTMLElement) =>
      Array.from(container.querySelectorAll('.grid > div > span')).map(
        (el) => el.textContent,
      );

    it('renders providers we have a key for first, each group alphabetical by display name', () => {
      mockGetLlmsQuery.mockReturnValue({
        data: mixedProviders,
        isLoading: false,
      });

      const { container } = render(<LLMTab />);

      expect(renderedProviderNames(container)).toEqual([
        // keyed: bedrock → "Amazon", openai → "OpenAI"
        'Amazon',
        'OpenAI',
        // unkeyed: anthropic → "Anthropic", groq → "Groq"
        'Anthropic',
        'Groq',
      ]);
    });

    it('keeps the ordering within whatever the search filter leaves', async () => {
      mockGetLlmsQuery.mockReturnValue({
        data: mixedProviders,
        isLoading: false,
      });
      const user = userEvent.setup();

      const { container } = render(<LLMTab />);
      await user.type(screen.getByPlaceholderText('Search Providers'), 'r');

      // "r" matches anthropic, bedrock and groq — Amazon (keyed) still leads.
      expect(renderedProviderNames(container)).toEqual([
        'Amazon',
        'Anthropic',
        'Groq',
      ]);
    });

    it('sorts the local-only block alphabetically after the API providers', () => {
      mockIsTauri = true;
      mockGetLlmsQuery.mockReturnValue({
        data: mixedProviders,
        isLoading: false,
      });

      const { container } = render(<LLMTab />);

      // The catalog lists Mistral before Meta; the block sorts them, and the
      // whole block still follows every API provider card.
      expect(renderedProviderNames(container)).toEqual([
        'Amazon',
        'OpenAI',
        'Anthropic',
        'Groq',
        'Meta',
        'Mistral',
      ]);
    });

    it('demotes a keyed provider that ships no models into the grayed group', () => {
      // The ordering predicate is the same one the grid grays cards with, so a
      // provider we hold a key for but which exposes no chat models sorts after
      // the usable ones *and* renders grayed — the two must never disagree.
      mockGetLlmsQuery.mockReturnValue({
        data: [
          {
            id: 1,
            name: 'openai',
            logo: '',
            description: '',
            chat_models: [],
            has_credentials: true,
          },
          {
            id: 2,
            name: 'groq',
            logo: '',
            description: '',
            chat_models: someModels,
            has_credentials: true,
          },
        ],
        isLoading: false,
      });
      // Neither card is the mentor's active provider, so nothing is exempt.
      mockGetMentorSettingsQuery.mockReturnValue({
        data: { ...mentorSettings, llm_provider: 'anthropic' },
        isLoading: false,
      });

      const { container } = render(<LLMTab />);

      expect(renderedProviderNames(container)).toEqual(['Groq', 'OpenAI']);
      expect(providerCard(container, 'openai')).toHaveAttribute(
        'data-disabled',
        'true',
      );
      expect(providerCard(container, 'groq')).toHaveAttribute(
        'data-disabled',
        'false',
      );
    });
  });

  // --------------------------------------------------------------------------
  // Provider-level graying (no accessible models → inactive treatment)
  // --------------------------------------------------------------------------
  describe('provider graying', () => {
    const someModels = [{ llm_name: 'model-1' }];

    const usable = {
      id: 1,
      name: 'groq',
      logo: '',
      description: '',
      chat_models: someModels,
      has_credentials: true,
    };
    // Credentials are fine but the provider exposes nothing to switch to, so
    // every model row in the modal would be disabled.
    const noModels = {
      id: 2,
      name: 'bedrock',
      logo: '',
      description: '',
      chat_models: [],
      has_credentials: true,
    };
    // Models exist but no credential path passes.
    const noKey = {
      id: 3,
      name: 'anthropic',
      logo: '',
      description: '',
      chat_models: someModels,
      has_credentials: false,
      can_use_main_keys: false,
      main_has_credentials: false,
    };

    const renderGrid = (data: unknown[], llmProvider = 'openai') => {
      mockGetLlmsQuery.mockReturnValue({ data, isLoading: false });
      mockGetMentorSettingsQuery.mockReturnValue({
        data: { ...mentorSettings, llm_provider: llmProvider },
        isLoading: false,
      });
      return render(<LLMTab />);
    };

    it('marks a provider with no reachable models as grayed', () => {
      const { container } = renderGrid([usable, noModels, noKey]);

      expect(providerCard(container, 'bedrock')).toHaveAttribute(
        'data-disabled',
        'true',
      );
      expect(providerCard(container, 'anthropic')).toHaveAttribute(
        'data-disabled',
        'true',
      );
    });

    it('leaves an accessible provider ungrayed', () => {
      const { container } = renderGrid([usable, noModels, noKey]);

      expect(providerCard(container, 'groq')).toHaveAttribute(
        'data-disabled',
        'false',
      );
    });

    it('grayscales the logo but keeps every label at full contrast', () => {
      const { container } = renderGrid([usable, noKey]);

      const grayed = providerCard(container, 'anthropic')!;
      expect(grayed.querySelector('img')?.className).toContain('grayscale');
      // The label deliberately stays dark on grayed cards: the tinted card and
      // faded logo already signal "inactive", and muting the text on top of a
      // gray background only costs contrast.
      expect(grayed.querySelector('span')?.className).toContain(
        'text-gray-900',
      );

      const ungrayed = providerCard(container, 'groq')!;
      expect(ungrayed.querySelector('img')?.className).not.toContain(
        'grayscale',
      );
      expect(ungrayed.querySelector('span')?.className).toContain(
        'text-gray-900',
      );
    });

    it('fades and tints grayed cards so black logos still read as inactive', () => {
      // `grayscale` is a no-op on an already-black mark (OpenAI, xAI), so the
      // inactive state has to come from opacity + a tinted card instead.
      const { container } = renderGrid([usable, noKey]);

      const grayed = providerCard(container, 'anthropic')!;
      expect(grayed.querySelector('img')?.className).toContain('opacity-40');
      expect(grayed.className).toContain('bg-gray-50');

      const ungrayed = providerCard(container, 'groq')!;
      expect(ungrayed.querySelector('img')?.className).not.toContain(
        'opacity-40',
      );
      expect(ungrayed.className).not.toContain('bg-gray-50');
    });

    it('never grays the active provider, even when it has no reachable models', () => {
      // bedrock is the mentor's current provider; the highlighted card must not
      // also read as inactive.
      const { container } = renderGrid([usable, noModels], 'bedrock');

      const active = providerCard(container, 'bedrock')!;
      expect(active).toHaveAttribute('data-disabled', 'false');
      expect(active.className).toContain('border-blue-500');
      expect(active.querySelector('img')?.className).not.toContain('grayscale');
    });

    it('keeps a grayed card clickable so the modal can explain why', async () => {
      const user = userEvent.setup();
      const { container } = renderGrid([noKey]);

      const grayed = providerCard(container, 'anthropic')!;
      expect(grayed.className).toContain('cursor-pointer');
      expect(grayed.className).not.toContain('pointer-events-none');

      await user.click(grayed);

      expect(screen.getByTestId('llm-provider-modal')).toBeInTheDocument();
    });

    it('never grays local-only provider cards — they need no API key', () => {
      mockIsTauri = true;
      const { container } = renderGrid([noKey]);

      expect(providerCard(container, 'Meta')).toHaveAttribute(
        'data-disabled',
        'false',
      );
      expect(providerCard(container, 'Mistral')).toHaveAttribute(
        'data-disabled',
        'false',
      );
      expect(
        providerCard(container, 'Meta')?.querySelector('img')?.className,
      ).not.toContain('grayscale');
    });
  });

  // --------------------------------------------------------------------------
  // Local-only provider cards (Tauri desktop)
  // --------------------------------------------------------------------------
  describe('local-only providers', () => {
    it('does not surface them in the browser', () => {
      // Meta ships only on-device models, so outside the desktop app there is
      // nothing a user could do with the card.
      render(<LLMTab />);
      expect(screen.queryByText('Meta')).not.toBeInTheDocument();
    });

    it('adds one card per provider the backend list does not already cover', () => {
      mockIsTauri = true;
      render(<LLMTab />);

      // Meta has no cloud entry, so it earns a card — once, even though two
      // catalog models share it.
      expect(screen.getAllByText('Meta')).toHaveLength(1);
      // The catalog's OpenAI model must not duplicate the cloud OpenAI card.
      expect(screen.getAllByText('OpenAI')).toHaveLength(1);
    });

    it('opens the provider modal when a local-only card is clicked', async () => {
      mockIsTauri = true;
      const user = userEvent.setup();
      render(<LLMTab />);

      await user.click(screen.getByText('Meta'));

      // The card synthesises a provider with an empty chat_models list; the
      // modal fills it from the on-device catalog.
      expect(screen.getByTestId('llm-provider-modal')).toBeInTheDocument();
      expect(mockModalProps).toHaveBeenCalledWith(
        expect.objectContaining({
          llmProvider: expect.objectContaining({
            id: -1,
            name: 'Meta',
            chat_models: [],
          }),
        }),
      );
    });

    it('ignores clicks on a local-only card while an edit is in flight', async () => {
      mockIsTauri = true;
      mockIsEditing = true;
      const user = userEvent.setup();
      render(<LLMTab />);

      await user.click(screen.getByText('Meta'));

      expect(
        screen.queryByTestId('llm-provider-modal'),
      ).not.toBeInTheDocument();
    });

    it('highlights the local-only card whose model is the active on-device selection', async () => {
      // The mentor's cloud setting is still openai, but chat is running Llama
      // 3.2 — so Meta, not OpenAI, is the card that must read as active.
      mockIsTauri = true;
      localStorage.setItem('ibl_local_llm_enabled', 'true');
      localStorage.setItem('ibl_local_llm_model', 'llama3.2');
      render(<LLMTab />);

      await waitFor(() => {
        expect(
          screen.getByText('Meta').closest('div.border-blue-500'),
        ).not.toBeNull();
      });
      expect(
        screen.getByText('OpenAI').closest('div.border-blue-500'),
      ).toBeNull();
      // Reading the selection also repairs the stale tool-support cache, or
      // local streaming would reject this tool-capable model.
      expect(setLocalLLMToolSupport).toHaveBeenCalledWith(true);
    });
  });
});
