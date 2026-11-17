import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from '@testing-library/react';

import { PromptCard } from '../prompt-gallery-modal/prompt-card';
import type { SelectedPrompt } from '../edit-prompt-modal';

const {
  mockExecuteWithTrialCheck,
  mockCloseModal,
  trial,
  mockDeletePrompt,
  mockUnwrap,
  deleting,
  mockCopy,
  clipboard,
  user,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => ({
  mockExecuteWithTrialCheck: vi.fn((fn: () => void) => fn()),
  mockCloseModal: vi.fn(),
  trial: {
    isModalOpen: false,
    dialog: null as React.ComponentType<any> | null,
  },
  mockDeletePrompt: vi.fn(),
  mockUnwrap: vi.fn(),
  deleting: { isLoading: false },
  mockCopy: vi.fn(),
  clipboard: { status: 'idle' as 'idle' | 'success' | 'error' },
  user: { isStudent: false },
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ tenantKey: 'tenant123', mentorId: 'mentor456' }),
}));

vi.mock('@/hooks/use-user', () => ({
  useUserIsStudent: () => user.isStudent,
}));

vi.mock('@/hooks/use-copy-to-clipboard', () => ({
  useCopyToClipboard: () => ({ copy: mockCopy, status: clipboard.status }),
}));

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useDeletePromptMutation: () => [
    mockDeletePrompt,
    { isLoading: deleting.isLoading },
  ],
}));

vi.mock('@iblai/iblai-js/web-utils', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@iblai/iblai-js/web-utils')>();
  return {
    ...actual,
    useShowFreeTrialDialog: () => ({
      executeWithTrialCheck: mockExecuteWithTrialCheck,
      FreeTrialDialog: trial.dialog,
      closeModal: mockCloseModal,
      isModalOpen: trial.isModalOpen,
    }),
  };
});

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

vi.mock('@/components/markdown', () => ({
  default: ({ children }: { children: string }) => (
    <div data-testid="markdown">{children}</div>
  ),
}));

const prompt: SelectedPrompt = {
  id: 7,
  label: 'Summarize',
  isSystem: false,
  name: 'prompt' as SelectedPrompt['name'],
  prompt: 'Summarize this **document** for me',
  category: 'General',
};

function renderCard(
  overrides: Partial<React.ComponentProps<typeof PromptCard>> = {},
) {
  const onEdit = vi.fn();
  const onSelect = vi.fn();
  const utils = render(
    <PromptCard
      prompt={prompt}
      title="Summarize"
      onEdit={onEdit}
      onSelect={onSelect}
      {...overrides}
    />,
  );
  return { ...utils, onEdit, onSelect };
}

describe('PromptCard', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockExecuteWithTrialCheck.mockImplementation((fn: () => void) => fn());
    mockDeletePrompt.mockReturnValue({ unwrap: mockUnwrap });
    mockUnwrap.mockResolvedValue(undefined);
    trial.isModalOpen = false;
    trial.dialog = null;
    deleting.isLoading = false;
    clipboard.status = 'idle';
    user.isStudent = false;
  });

  afterEach(() => {
    cleanup();
  });

  it('shows the title and the prompt body', () => {
    renderCard();

    expect(screen.getByRole('heading', { name: 'Summarize' })).toBeVisible();
    expect(screen.getByTestId('markdown')).toHaveTextContent(
      'Summarize this **document** for me',
    );
  });

  it('turns an HTML prompt into markdown before rendering it', () => {
    renderCard({
      prompt: { ...prompt, prompt: '<p>Hello <strong>there</strong></p>' },
    });

    expect(screen.getByTestId('markdown')).toHaveTextContent('Hello **there**');
  });

  describe('actions', () => {
    it('shows Edit, Run, Copy and Delete to a non-student', () => {
      renderCard();

      expect(screen.getByRole('button', { name: 'Edit' })).toBeVisible();
      expect(screen.getByRole('button', { name: 'Run' })).toBeVisible();
      expect(screen.getByRole('button', { name: 'Copy' })).toBeVisible();
      expect(screen.getByRole('button', { name: 'Delete' })).toBeVisible();
    });

    it('hides Edit and Delete from a student', () => {
      user.isStudent = true;
      renderCard();

      expect(
        screen.queryByRole('button', { name: 'Edit' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Delete' }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Run' })).toBeVisible();
      expect(screen.getByRole('button', { name: 'Copy' })).toBeVisible();
    });

    it('Edit hands the prompt to onEdit', () => {
      const { onEdit } = renderCard();

      fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

      expect(onEdit).toHaveBeenCalledWith(prompt);
    });

    it('Run passes the prompt text to onSelect behind the trial check', () => {
      const { onSelect } = renderCard();

      fireEvent.click(screen.getByRole('button', { name: 'Run' }));

      expect(mockExecuteWithTrialCheck).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith(prompt.prompt);
    });

    it('Run does nothing without an onSelect handler', () => {
      renderCard({ onSelect: undefined });

      expect(() =>
        fireEvent.click(screen.getByRole('button', { name: 'Run' })),
      ).not.toThrow();
      expect(mockExecuteWithTrialCheck).toHaveBeenCalledTimes(1);
    });

    it('Run is held back when the trial check does not let it through', () => {
      mockExecuteWithTrialCheck.mockImplementation(() => undefined);
      const { onSelect } = renderCard();

      fireEvent.click(screen.getByRole('button', { name: 'Run' }));

      expect(onSelect).not.toHaveBeenCalled();
    });

    it('Copy copies the prompt text', () => {
      renderCard();

      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

      expect(mockCopy).toHaveBeenCalledWith(prompt.prompt);
    });

    it('Copy reads "Copied" once the copy succeeded', () => {
      clipboard.status = 'success';
      renderCard();

      expect(screen.getByRole('button', { name: 'Copied' })).toBeVisible();
      expect(
        screen.queryByRole('button', { name: 'Copy' }),
      ).not.toBeInTheDocument();
    });
  });

  describe('Delete', () => {
    it('deletes the prompt for this organization and confirms', async () => {
      renderCard();

      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

      expect(mockExecuteWithTrialCheck).toHaveBeenCalledTimes(1);
      expect(mockDeletePrompt).toHaveBeenCalledWith({
        id: 7,
        org: 'tenant123',
      });
      await waitFor(() =>
        expect(mockToastSuccess).toHaveBeenCalledWith(
          'Prompt deleted successfully',
        ),
      );
      expect(mockToastError).not.toHaveBeenCalled();
    });

    it('reports a failed delete without crashing', async () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockUnwrap.mockRejectedValue(new Error('boom'));
      renderCard();

      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

      await waitFor(() =>
        expect(mockToastError).toHaveBeenCalledWith('Failed to delete prompt'),
      );
      expect(mockToastSuccess).not.toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining('"tenant":"tenant123"'),
      );
      consoleError.mockRestore();
    });

    it('disables every action and spins while the delete is in flight', () => {
      deleting.isLoading = true;
      renderCard();

      for (const name of ['Edit', 'Run', 'Copy', 'Delete']) {
        expect(screen.getByRole('button', { name })).toBeDisabled();
      }
      expect(
        screen.getByRole('button', { name: 'Delete' }).querySelector('svg'),
      ).toHaveClass('animate-spin');
    });

    it('is not spinning when idle', () => {
      renderCard();

      expect(
        screen.getByRole('button', { name: 'Delete' }).querySelector('svg'),
      ).not.toHaveClass('animate-spin');
    });
  });

  describe('free trial dialog', () => {
    it('renders the dialog when the trial check opened it', () => {
      trial.isModalOpen = true;
      trial.dialog = ({ onClose }: { onClose: () => void }) => (
        <div role="dialog" aria-label="Free trial">
          <button onClick={onClose}>Close trial</button>
        </div>
      );
      renderCard();

      expect(screen.getByRole('dialog', { name: 'Free trial' })).toBeVisible();

      fireEvent.click(screen.getByRole('button', { name: 'Close trial' }));

      expect(mockCloseModal).toHaveBeenCalledTimes(1);
    });

    it('renders no dialog while it is closed', () => {
      trial.isModalOpen = false;
      trial.dialog = () => <div role="dialog" aria-label="Free trial" />;
      renderCard();

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders no dialog when the hook offers none even if flagged open', () => {
      trial.isModalOpen = true;
      trial.dialog = null;
      renderCard();

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
