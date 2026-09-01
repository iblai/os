import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

import { ModelDownloadLogsModal } from '../model-download-logs-modal';
import type { InstallationLog } from '@/types/tauri';

// ============================================================================
// MOCKS
// ============================================================================

const mockClearLogs = vi.fn();

// Controllable model-download state returned by the mocked hook.
let mockState: {
  logs: InstallationLog[];
  status: string;
  progress: number;
} = {
  logs: [],
  status: 'idle',
  progress: 0,
};

vi.mock('@/hooks/use-model-download', () => ({
  useModelDownload: () => ({
    state: mockState,
    clearLogs: mockClearLogs,
  }),
}));

const makeLog = (overrides: Partial<InstallationLog> = {}): InstallationLog =>
  ({
    timestamp: '2024-01-01T12:00:00.000Z',
    level: 'info',
    message: 'Test log message',
    ...overrides,
  }) as InstallationLog;

// ============================================================================
// TESTS
// ============================================================================

describe('ModelDownloadLogsModal', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockState = { logs: [], status: 'idle', progress: 0 };
  });

  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('renders title and description when open', () => {
      render(<ModelDownloadLogsModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText('Model Installation Logs')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Detailed logs for the Phi Mini 3 model download process.',
        ),
      ).toBeInTheDocument();
    });

    it('does not render content when closed', () => {
      render(<ModelDownloadLogsModal isOpen={false} onClose={vi.fn()} />);

      expect(
        screen.queryByText('Model Installation Logs'),
      ).not.toBeInTheDocument();
    });

    it('shows empty state when there are no logs', () => {
      render(<ModelDownloadLogsModal isOpen={true} onClose={vi.fn()} />);

      expect(
        screen.getByText('No logs available. Start a download to see logs.'),
      ).toBeInTheDocument();
    });

    it('disables export and clear buttons when there are no logs', () => {
      render(<ModelDownloadLogsModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByRole('button', { name: /export/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /clear/i })).toBeDisabled();
    });

    it('shows the log count for zero logs', () => {
      render(<ModelDownloadLogsModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText('0 log entries')).toBeInTheDocument();
    });
  });

  describe('with logs', () => {
    beforeEach(() => {
      mockState = {
        logs: [
          makeLog({ level: 'info', message: 'Info entry' }),
          makeLog({
            level: 'warn',
            message: 'Warn entry',
            timestamp: '2024-01-01T12:01:00.000Z',
          }),
          makeLog({
            level: 'error',
            message: 'Error entry',
            timestamp: '2024-01-01T12:02:00.000Z',
          }),
          makeLog({
            // Unknown level exercises the `|| ''` fallback in LogEntry.
            level: 'debug' as InstallationLog['level'],
            message: 'Debug entry',
            timestamp: '2024-01-01T12:03:00.000Z',
          }),
        ],
        status: 'idle',
        progress: 0,
      };
    });

    it('renders each log message and uppercased level badge', () => {
      render(<ModelDownloadLogsModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText('Info entry')).toBeInTheDocument();
      expect(screen.getByText('Warn entry')).toBeInTheDocument();
      expect(screen.getByText('Error entry')).toBeInTheDocument();
      expect(screen.getByText('Debug entry')).toBeInTheDocument();

      expect(screen.getByText('INFO')).toBeInTheDocument();
      expect(screen.getByText('WARN')).toBeInTheDocument();
      expect(screen.getByText('ERROR')).toBeInTheDocument();
      expect(screen.getByText('DEBUG')).toBeInTheDocument();
    });

    it('does not render the empty state when logs exist', () => {
      render(<ModelDownloadLogsModal isOpen={true} onClose={vi.fn()} />);

      expect(
        screen.queryByText('No logs available. Start a download to see logs.'),
      ).not.toBeInTheDocument();
    });

    it('enables export and clear buttons when logs exist', () => {
      render(<ModelDownloadLogsModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByRole('button', { name: /export/i })).toBeEnabled();
      expect(screen.getByRole('button', { name: /clear/i })).toBeEnabled();
    });

    it('shows the log count using the plural form', () => {
      render(<ModelDownloadLogsModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText('4 log entries')).toBeInTheDocument();
    });

    it('calls clearLogs when the clear button is clicked', () => {
      render(<ModelDownloadLogsModal isOpen={true} onClose={vi.fn()} />);

      fireEvent.click(screen.getByRole('button', { name: /clear/i }));

      expect(mockClearLogs).toHaveBeenCalledTimes(1);
    });
  });

  describe('singular log count', () => {
    it('shows singular form for a single log entry', () => {
      mockState = {
        logs: [makeLog({ message: 'Only entry' })],
        status: 'idle',
        progress: 0,
      };

      render(<ModelDownloadLogsModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText('1 log entry')).toBeInTheDocument();
    });
  });

  describe('export logs', () => {
    it('builds a blob and triggers a download anchor', () => {
      mockState = {
        logs: [
          makeLog({ level: 'info', message: 'First' }),
          makeLog({
            level: 'error',
            message: 'Second',
            timestamp: '2024-01-01T12:05:00.000Z',
          }),
        ],
        status: 'idle',
        progress: 0,
      };

      const createObjectURL = vi
        .spyOn(URL, 'createObjectURL')
        .mockReturnValue('blob:mock-url');
      const revokeObjectURL = vi
        .spyOn(URL, 'revokeObjectURL')
        .mockImplementation(() => {});
      const clickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => {});
      const appendSpy = vi.spyOn(document.body, 'appendChild');
      const removeSpy = vi.spyOn(document.body, 'removeChild');

      render(<ModelDownloadLogsModal isOpen={true} onClose={vi.fn()} />);

      fireEvent.click(screen.getByRole('button', { name: /export/i }));

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(createObjectURL.mock.calls[0][0]).toBeInstanceOf(Blob);
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(appendSpy).toHaveBeenCalled();
      expect(removeSpy).toHaveBeenCalled();
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

      createObjectURL.mockRestore();
      revokeObjectURL.mockRestore();
      clickSpy.mockRestore();
      appendSpy.mockRestore();
      removeSpy.mockRestore();
    });
  });

  describe('download status indicator', () => {
    it('shows the in-progress indicator when downloading', () => {
      mockState = {
        logs: [makeLog()],
        status: 'downloading',
        progress: 42.6,
      };

      render(<ModelDownloadLogsModal isOpen={true} onClose={vi.fn()} />);

      // Math.round(42.6) === 43
      expect(
        screen.getByText('Download in progress... (43%)'),
      ).toBeInTheDocument();
    });

    it('does not show the in-progress indicator when idle', () => {
      mockState = { logs: [makeLog()], status: 'idle', progress: 0 };

      render(<ModelDownloadLogsModal isOpen={true} onClose={vi.fn()} />);

      expect(
        screen.queryByText(/Download in progress/),
      ).not.toBeInTheDocument();
    });
  });

  describe('auto-scroll effect', () => {
    it('scrolls the viewport to the bottom when new logs arrive while open', () => {
      // A stand-in viewport whose scrollTop assignment is observable. The
      // ScrollArea ref is attached after the first commit, so we rerender with
      // an extra log to fire the effect once the ref is in place.
      const viewport = document.createElement('div');
      viewport.setAttribute('data-radix-scroll-area-viewport', '');
      Object.defineProperty(viewport, 'scrollHeight', {
        configurable: true,
        value: 500,
      });
      let scrollTopValue = 0;
      Object.defineProperty(viewport, 'scrollTop', {
        configurable: true,
        get: () => scrollTopValue,
        set: (v: number) => {
          scrollTopValue = v;
        },
      });

      const realQS = Element.prototype.querySelector;
      const querySpy = vi
        .spyOn(Element.prototype, 'querySelector')
        .mockImplementation(function (this: Element, selector: string) {
          if (selector.includes('radix-scroll-area-viewport')) {
            return viewport;
          }
          return realQS.call(this, selector);
        });

      mockState = {
        logs: [makeLog({ message: 'First log' })],
        status: 'idle',
        progress: 0,
      };
      const { rerender } = render(
        <ModelDownloadLogsModal isOpen={true} onClose={vi.fn()} />,
      );

      // New log arrives -> logs.length changes -> effect runs with ref attached.
      mockState = {
        logs: [
          makeLog({ message: 'First log' }),
          makeLog({
            message: 'Second log',
            timestamp: '2024-01-01T12:10:00.000Z',
          }),
        ],
        status: 'idle',
        progress: 0,
      };
      rerender(<ModelDownloadLogsModal isOpen={true} onClose={vi.fn()} />);

      expect(scrollTopValue).toBe(500);

      querySpy.mockRestore();
    });
  });

  describe('onClose', () => {
    it('invokes onClose when the dialog requests to close', () => {
      const onClose = vi.fn();
      render(<ModelDownloadLogsModal isOpen={true} onClose={onClose} />);

      fireEvent.keyDown(document.activeElement || document.body, {
        key: 'Escape',
        code: 'Escape',
      });

      expect(onClose).toHaveBeenCalled();
    });
  });
});
