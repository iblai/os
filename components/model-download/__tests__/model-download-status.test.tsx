import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ModelDownloadState, OsType } from '@/types/tauri';
import { ModelDownloadStatus } from '../model-download-status';

// ============================================================================
// MOCKS
// ============================================================================

const mockStartDownload = vi.fn();
const mockCancelDownload = vi.fn();
const mockInstallOllama = vi.fn();
const mockCheckStatus = vi.fn();
const mockResetState = vi.fn();
const mockUseModelDownload = vi.fn();

vi.mock('@/hooks/use-model-download', () => ({
  useModelDownload: () => mockUseModelDownload(),
}));

// Stub the logs modal so we can assert it opens/closes via test ids.
vi.mock('@/components/modals/model-download-logs-modal', () => ({
  ModelDownloadLogsModal: ({
    isOpen,
    onClose,
  }: {
    isOpen: boolean;
    onClose: () => void;
  }) =>
    isOpen ? (
      <div data-testid="logs-modal">
        <button data-testid="close-logs" onClick={onClose}>
          Close
        </button>
      </div>
    ) : null,
}));

// ============================================================================
// HELPERS
// ============================================================================

type OllamaStatus = {
  installed: boolean;
  running?: boolean;
  model_installed?: boolean;
};

function buildState(
  overrides: Partial<ModelDownloadState> = {},
): ModelDownloadState {
  return {
    status: 'idle',
    progress: 0,
    message: '',
    logs: [],
    lastUpdated: new Date().toISOString(),
    ...overrides,
  };
}

function setup({
  isAvailable = true,
  state,
  ollamaStatus = { installed: true, running: true, model_installed: false },
  osType = 'macos',
}: {
  isAvailable?: boolean;
  state?: Partial<ModelDownloadState>;
  ollamaStatus?: OllamaStatus | null;
  osType?: OsType | null;
} = {}) {
  mockUseModelDownload.mockReturnValue({
    isAvailable,
    state: buildState(state),
    ollamaStatus,
    osType,
    startDownload: mockStartDownload,
    cancelDownload: mockCancelDownload,
    installOllama: mockInstallOllama,
    checkStatus: mockCheckStatus,
    resetState: mockResetState,
  });
}

// Opens the dropdown menu so its content (badge/buttons) is rendered.
async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByLabelText('Local AI model status'));
}

describe('ModelDownloadStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setup();
  });

  it('renders nothing when not running inside the Tauri app', () => {
    setup({ isAvailable: false });
    const { container } = render(<ModelDownloadStatus />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the trigger button with its aria-label', () => {
    render(<ModelDownloadStatus />);
    expect(screen.getByLabelText('Local AI model status')).toBeInTheDocument();
  });

  it('shows the model name and manager status inside the dropdown', async () => {
    const user = userEvent.setup();
    render(<ModelDownloadStatus />);
    await openMenu(user);

    expect(screen.getByText('Phi Mini 3 Model')).toBeInTheDocument();
    expect(screen.getByText(/Model Manager: Installed/)).toBeInTheDocument();
    expect(screen.getByText(/Service: Running/)).toBeInTheDocument();
  });

  it('shows the download button when ollama is installed but the model is not', async () => {
    const user = userEvent.setup();
    render(<ModelDownloadStatus />);
    await openMenu(user);

    const downloadBtn = screen.getByText('Download Model');
    expect(downloadBtn).toBeInTheDocument();
    await user.click(downloadBtn);
    expect(mockStartDownload).toHaveBeenCalled();
  });

  it('shows the install model-manager button when ollama is not installed', async () => {
    setup({ ollamaStatus: { installed: false } });
    const user = userEvent.setup();
    render(<ModelDownloadStatus />);
    await openMenu(user);

    expect(
      screen.getByText(/Model Manager: Not installed/),
    ).toBeInTheDocument();
    const installBtn = screen.getByText('Install Model Manager');
    await user.click(installBtn);
    expect(mockInstallOllama).toHaveBeenCalled();
  });

  it('shows the "Stopped" service status when ollama is installed but not running', async () => {
    setup({
      ollamaStatus: { installed: true, running: false, model_installed: false },
    });
    const user = userEvent.setup();
    render(<ModelDownloadStatus />);
    await openMenu(user);

    expect(screen.getByText(/Service: Stopped/)).toBeInTheDocument();
  });

  describe('downloading state', () => {
    it('shows progress, percentage badge, message and the cancel button', async () => {
      setup({
        state: {
          status: 'downloading',
          progress: 42.6,
          message: 'Pulling model layers',
        },
      });
      const user = userEvent.setup();
      render(<ModelDownloadStatus />);
      await openMenu(user);

      // Rounded percentage badge.
      expect(screen.getByText('43%')).toBeInTheDocument();
      expect(screen.getByText('Pulling model layers')).toBeInTheDocument();

      const cancelBtn = screen.getByText('Cancel');
      await user.click(cancelBtn);
      expect(mockCancelDownload).toHaveBeenCalled();
    });

    it('shows the "Downloading..." badge and message without progress bar on Windows', async () => {
      setup({
        osType: 'windows',
        state: {
          status: 'downloading',
          progress: 50,
          message: 'Win download in progress',
        },
      });
      const user = userEvent.setup();
      render(<ModelDownloadStatus />);
      await openMenu(user);

      expect(screen.getByText('Downloading...')).toBeInTheDocument();
      expect(screen.getByText('Win download in progress')).toBeInTheDocument();
      // No percentage badge on Windows.
      expect(screen.queryByText('50%')).not.toBeInTheDocument();
    });

    it('renders the downloading status indicator dot on the trigger', () => {
      setup({ state: { status: 'downloading', progress: 10 } });
      const { container } = render(<ModelDownloadStatus />);
      expect(container.querySelector('.animate-ping')).toBeInTheDocument();
    });
  });

  describe('completed state', () => {
    it('shows the Ready badge and a Refresh button', async () => {
      setup({
        ollamaStatus: { installed: true, running: true, model_installed: true },
        state: { status: 'completed', progress: 100 },
      });
      const user = userEvent.setup();
      render(<ModelDownloadStatus />);
      await openMenu(user);

      expect(screen.getByText('Ready')).toBeInTheDocument();
      const refreshBtn = screen.getByText('Refresh');
      await user.click(refreshBtn);
      expect(mockCheckStatus).toHaveBeenCalled();
    });
  });

  describe('error state', () => {
    it('shows the error badge, error message, refresh and reset buttons', async () => {
      setup({
        state: {
          status: 'error',
          error: 'Disk full',
        },
      });
      const user = userEvent.setup();
      render(<ModelDownloadStatus />);
      await openMenu(user);

      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Disk full')).toBeInTheDocument();

      await user.click(screen.getByText('Refresh'));
      expect(mockCheckStatus).toHaveBeenCalled();

      await user.click(screen.getByText('Reset'));
      expect(mockResetState).toHaveBeenCalled();
    });

    it('shows the download button in the error state when model not installed', async () => {
      setup({ state: { status: 'error', error: 'boom' } });
      const user = userEvent.setup();
      render(<ModelDownloadStatus />);
      await openMenu(user);

      expect(screen.getByText('Download Model')).toBeInTheDocument();
    });
  });

  describe('cancelled state', () => {
    it('shows the cancelled badge and a Refresh button', async () => {
      setup({ state: { status: 'cancelled' } });
      const user = userEvent.setup();
      render(<ModelDownloadStatus />);
      await openMenu(user);

      expect(screen.getByText('Cancelled')).toBeInTheDocument();
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });
  });

  describe('checking state', () => {
    it('shows the Checking badge', async () => {
      setup({ state: { status: 'checking' } });
      const user = userEvent.setup();
      render(<ModelDownloadStatus />);
      await openMenu(user);

      expect(screen.getByText('Checking')).toBeInTheDocument();
    });
  });

  describe('logs', () => {
    it('opens and closes the logs modal from the view-logs link', async () => {
      setup({
        state: {
          status: 'completed',
          logs: [
            // shape only needs length for the link
            { message: 'log a' },
            { message: 'log b' },
          ] as unknown as ModelDownloadState['logs'],
        },
      });
      const user = userEvent.setup();
      render(<ModelDownloadStatus />);
      await openMenu(user);

      const viewLogs = screen.getByText('View logs (2)');
      await user.click(viewLogs);

      expect(screen.getByTestId('logs-modal')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('close-logs'));
      expect(screen.queryByTestId('logs-modal')).not.toBeInTheDocument();
    });

    it('does not render the view-logs link when there are no logs', async () => {
      const user = userEvent.setup();
      render(<ModelDownloadStatus />);
      await openMenu(user);

      expect(screen.queryByText(/View logs/)).not.toBeInTheDocument();
    });
  });

  it('renders no badge for the idle status', async () => {
    const user = userEvent.setup();
    render(<ModelDownloadStatus />);
    await openMenu(user);

    expect(screen.queryByText('Ready')).not.toBeInTheDocument();
    expect(screen.queryByText('Error')).not.toBeInTheDocument();
    expect(screen.queryByText('Checking')).not.toBeInTheDocument();
  });

  it('handles a null ollamaStatus by hiding install/download buttons', async () => {
    setup({ ollamaStatus: null });
    const user = userEvent.setup();
    render(<ModelDownloadStatus />);
    await openMenu(user);

    expect(screen.queryByText('Install Model Manager')).not.toBeInTheDocument();
    expect(screen.queryByText('Download Model')).not.toBeInTheDocument();
    expect(
      screen.getByText(/Model Manager: Not installed/),
    ).toBeInTheDocument();
  });
});
