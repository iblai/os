import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
} from '@testing-library/react';

// ---- Hoisted mocks ----
const {
  mockUseGetApiKeysQuery,
  mockUseShowFreeTrialDialog,
  mockExecuteWithTrialCheck,
  mockCloseModal,
} = vi.hoisted(() => {
  const mockExecuteWithTrialCheck = vi.fn((fn: () => void) => fn());
  const mockCloseModal = vi.fn();
  return {
    mockUseGetApiKeysQuery: vi.fn(),
    mockExecuteWithTrialCheck,
    mockCloseModal,
    mockUseShowFreeTrialDialog: vi.fn(() => ({
      executeWithTrialCheck: mockExecuteWithTrialCheck,
      isModalOpen: false,
      FreeTrialDialog: null as
        | null
        | ((props: { isOpen: boolean; onClose: () => void }) => unknown),
      closeModal: mockCloseModal,
    })),
  };
});

vi.mock('next/navigation', () => ({
  useParams: () => ({ tenantKey: 'test-tenant', mentorId: 'mentor-123' }),
}));

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetApiKeysQuery: (...args: unknown[]) => mockUseGetApiKeysQuery(...args),
  // The endpoint returns either a bare array or a paginated envelope depending
  // on the backend version, and the real helper normalises both. Mirrored here
  // rather than importing the SDK so the mock stays self-contained.
  unwrapApiTokenList: (response?: unknown) => {
    if (Array.isArray(response))
      return { tokens: response, count: response.length };
    const paginated = response as
      | { results?: unknown[]; count?: number }
      | undefined;
    const tokens = paginated?.results ?? [];
    return { tokens, count: paginated?.count ?? tokens.length };
  },
}));

vi.mock('@/hooks/user-user-actions', () => ({
  useShowFreeTrialDialog: () => mockUseShowFreeTrialDialog(),
}));

// Permission HOC: supports both call shapes used by the source
// (`{ hasPermission }` destructure and the raw `hasPermission` form).
let hocHasPermission = true;
vi.mock('@/hoc/withPermissions', () => ({
  WithPermissions: ({
    children,
  }: {
    children: (props: { hasPermission: boolean }) => React.ReactNode;
    rbacResource: string;
  }) => <>{children({ hasPermission: hocHasPermission })}</>,
}));

// Stub the heavy child modals to keep this unit focused on ApiTab logic.
const mockCreateApiModal = vi.fn();
vi.mock('../api-tab/create-api-modal', () => ({
  CreateApiModal: (props: { isOpen: boolean; onClose: () => void }) => {
    mockCreateApiModal(props);
    return props.isOpen ? (
      <div data-testid="create-api-modal">
        <button onClick={props.onClose}>close-create</button>
      </div>
    ) : null;
  },
}));

const mockDeleteApiModal = vi.fn();
vi.mock('../api-tab/delete-api-modal', () => ({
  DeleteApiModal: (props: {
    isOpen: boolean;
    onClose: () => void;
    apiKey: { name: string };
  }) => {
    mockDeleteApiModal(props);
    return props.isOpen ? (
      <div data-testid="delete-api-modal">
        <span>{props.apiKey.name}</span>
        <button onClick={props.onClose}>close-delete</button>
      </div>
    ) : null;
  },
}));

import { ApiTab } from '../api-tab';

const sampleKeys = [
  {
    name: 'production-key',
    created: '2024-01-01T00:00:00Z',
    expires: '2025-01-01T00:00:00Z',
  },
  {
    name: 'no-dates-key',
    created: null,
    expires: null,
  },
];

describe('ApiTab', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    hocHasPermission = true;
    mockExecuteWithTrialCheck.mockImplementation((fn: () => void) => fn());
    mockUseShowFreeTrialDialog.mockReturnValue({
      executeWithTrialCheck: mockExecuteWithTrialCheck,
      isModalOpen: false,
      FreeTrialDialog: null,
      closeModal: mockCloseModal,
    });
    mockUseGetApiKeysQuery.mockReturnValue({
      data: sampleKeys,
      isLoading: false,
    });
  });

  afterEach(() => cleanup());

  it('renders headings and descriptions', () => {
    render(<ApiTab />);
    expect(screen.getByText('API')).toBeInTheDocument();
    expect(
      screen.getByText('Manage API keys and integrations.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Your secret API keys are listed below/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Do not share your API key/)).toBeInTheDocument();
  });

  it('shows spinner while loading', () => {
    mockUseGetApiKeysQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    });
    const { container } = render(<ApiTab />);
    // table headers should not render in the loading branch
    expect(screen.queryByText('NAME')).not.toBeInTheDocument();
    // spinner present (svg)
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('renders a populated table with formatted and N/A dates', () => {
    render(<ApiTab />);
    expect(screen.getByText('NAME')).toBeInTheDocument();
    expect(screen.getByText('CREATED')).toBeInTheDocument();
    expect(screen.getByText('EXPIRES')).toBeInTheDocument();
    expect(screen.getByText('production-key')).toBeInTheDocument();
    expect(screen.getByText('no-dates-key')).toBeInTheDocument();
    // formatted dates for production-key
    expect(screen.getByText('January 1st, 2024')).toBeInTheDocument();
    expect(screen.getByText('January 1st, 2025')).toBeInTheDocument();
    // N/A appears for the row without dates (created + expires)
    expect(screen.getAllByText('N/A').length).toBe(2);
  });

  it('renders empty state when there are no api keys', () => {
    mockUseGetApiKeysQuery.mockReturnValue({ data: [], isLoading: false });
    render(<ApiTab />);
    expect(screen.getByText('No API keys found')).toBeInTheDocument();
  });

  it('shows the no-permission message when list permission is missing', () => {
    hocHasPermission = false;
    render(<ApiTab />);
    expect(
      screen.getByText('You do not have permission to view API keys'),
    ).toBeInTheDocument();
  });

  it('opens and closes the create api modal', () => {
    render(<ApiTab />);
    expect(screen.queryByTestId('create-api-modal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Create New'));
    expect(screen.getByTestId('create-api-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByText('close-create'));
    expect(screen.queryByTestId('create-api-modal')).not.toBeInTheDocument();
  });

  it('opens delete modal through trial check and closes it', () => {
    render(<ApiTab />);
    const deleteButtons = screen.getAllByText('Delete API Key');
    fireEvent.click(deleteButtons[0]);
    expect(mockExecuteWithTrialCheck).toHaveBeenCalledTimes(1);
    const modal = screen.getByTestId('delete-api-modal');
    expect(modal).toBeInTheDocument();
    expect(within(modal).getByText('production-key')).toBeInTheDocument();
    fireEvent.click(screen.getByText('close-delete'));
    expect(screen.queryByTestId('delete-api-modal')).not.toBeInTheDocument();
  });

  it('renders the FreeTrialDialog when the trial modal is open', () => {
    const FreeTrialDialog = ({
      isOpen,
      onClose,
    }: {
      isOpen: boolean;
      onClose: () => void;
    }) =>
      isOpen ? (
        <div data-testid="free-trial-dialog">
          <button onClick={onClose}>close-trial</button>
        </div>
      ) : null;
    mockUseShowFreeTrialDialog.mockReturnValue({
      executeWithTrialCheck: mockExecuteWithTrialCheck,
      isModalOpen: true,
      FreeTrialDialog,
      closeModal: mockCloseModal,
    });
    render(<ApiTab />);
    expect(screen.getByTestId('free-trial-dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByText('close-trial'));
    expect(mockCloseModal).toHaveBeenCalled();
  });

  it('hides per-row delete buttons when the list permission is missing', () => {
    // When the #list permission is false the table body short-circuits to the
    // "no permission" row, so no per-row delete buttons are rendered.
    hocHasPermission = false;
    mockUseGetApiKeysQuery.mockReturnValue({
      data: [sampleKeys[0]],
      isLoading: false,
    });
    render(<ApiTab />);
    expect(
      screen.getByText('You do not have permission to view API keys'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Delete API Key')).not.toBeInTheDocument();
  });
});
