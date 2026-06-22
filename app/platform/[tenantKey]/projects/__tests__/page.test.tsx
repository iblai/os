import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProjectsRoute from '../page';

// Mock next/navigation
let mockTenantKey: string | undefined = 'test-tenant';
vi.mock('next/navigation', () => ({
  useParams: () => ({
    tenantKey: mockTenantKey,
    mentorId: 'mentor-123',
  }),
}));

// Capture the props handed to the web-containers ProjectsPage. The route is a
// thin wrapper, so the only thing under test is how it derives and forwards
// these props.
const mockProjectsPage = vi.fn();
vi.mock('@iblai/iblai-js/web-containers', () => ({
  ProjectsPage: (props: Record<string, unknown>) => {
    mockProjectsPage(props);
    return <div data-testid="projects-page" />;
  },
}));

// Mock username hook
let mockUsername: string | undefined = 'test-user';
vi.mock('@/hooks/use-user', () => ({
  useUsername: () => mockUsername,
}));

// Mock navigate hook
const mockNavigateToProject = vi.fn();
const mockNavigateToMentorInProject = vi.fn();
vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({
    navigateToProject: mockNavigateToProject,
    navigateToMentorInProject: mockNavigateToMentorInProject,
  }),
}));

// Mock free-trial gate
const mockExecuteWithTrialCheck = vi.fn((fn: () => void) => fn());
vi.mock('@/hooks/user-user-actions', () => ({
  useShowFreeTrialDialog: () => ({
    executeWithTrialCheck: mockExecuteWithTrialCheck,
  }),
}));

// Mock lazy project-details query
const mockUnwrap = vi.fn();
const mockTriggerDetails = vi.fn(() => ({ unwrap: mockUnwrap }));
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useLazyGetUserProjectDetailsQuery: () => [mockTriggerDetails],
}));

// Mock sonner toast
const mockToastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

describe('ProjectsRoute (thin wrapper)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTenantKey = 'test-tenant';
    mockUsername = 'test-user';
  });

  it('renders the web-containers ProjectsPage', () => {
    render(<ProjectsRoute />);
    expect(screen.getByTestId('projects-page')).toBeInTheDocument();
  });

  it('passes tenantKey and username derived from hooks', () => {
    render(<ProjectsRoute />);
    expect(mockProjectsPage).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantKey: 'test-tenant',
        username: 'test-user',
      }),
    );
  });

  it('forwards navigateToMentorInProject and executeWithTrialCheck', () => {
    render(<ProjectsRoute />);
    const props = mockProjectsPage.mock.calls[0][0];
    expect(props.navigateToMentorInProject).toBe(mockNavigateToMentorInProject);
    expect(props.executeWithTrialCheck).toBe(mockExecuteWithTrialCheck);
  });

  const getOpenProject = () => {
    render(<ProjectsRoute />);
    const props = mockProjectsPage.mock.calls[0][0] as {
      onOpenProject: (project: unknown) => Promise<void>;
    };
    return props.onOpenProject;
  };

  it('onOpenProject navigates using an already-populated first mentor', async () => {
    const onOpenProject = getOpenProject();

    await onOpenProject({
      id: 42,
      name: 'Test Project',
      mentor_count: 1,
      mentors: [{ id: 9, unique_id: 'm-9', name: 'A' }],
    });

    expect(mockNavigateToProject).toHaveBeenCalledWith('42', 'm-9');
    expect(mockTriggerDetails).not.toHaveBeenCalled();
  });

  it('onOpenProject shows a toast and does not navigate for a 0-agent project', async () => {
    const onOpenProject = getOpenProject();

    await onOpenProject({
      id: 5,
      name: 'Empty',
      mentor_count: 0,
      mentors: [],
    });

    expect(mockNavigateToProject).not.toHaveBeenCalled();
    expect(mockTriggerDetails).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith(
      'This project has no agents yet.',
    );
  });

  it('onOpenProject lazily fetches details when mentors are not populated', async () => {
    mockUnwrap.mockResolvedValueOnce({
      mentors: [{ id: 3, unique_id: 'm-3', name: 'B' }],
    });
    const onOpenProject = getOpenProject();

    await onOpenProject({
      id: 11,
      name: 'Lazy',
      mentor_count: 2,
      mentors: [],
    });

    expect(mockTriggerDetails).toHaveBeenCalledWith({
      tenantKey: 'test-tenant',
      username: 'test-user',
      id: 11,
    });
    expect(mockNavigateToProject).toHaveBeenCalledWith('11', 'm-3');
  });

  it('onOpenProject shows an error toast when details have no mentors', async () => {
    mockUnwrap.mockResolvedValueOnce({ mentors: [] });
    const onOpenProject = getOpenProject();

    await onOpenProject({
      id: 12,
      name: 'No Details Mentors',
      mentor_count: 2,
      mentors: [],
    });

    expect(mockNavigateToProject).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith(
      "Couldn't open this project. Please try again.",
    );
  });

  it('onOpenProject falls back to empty tenantKey/username when undefined', async () => {
    mockTenantKey = undefined;
    mockUsername = undefined;
    mockUnwrap.mockResolvedValueOnce({
      mentors: [{ id: 4, unique_id: 'm-4', name: 'C' }],
    });
    const onOpenProject = getOpenProject();

    await onOpenProject({
      id: 14,
      name: 'No Tenant',
      mentor_count: 1,
      mentors: [],
    });

    expect(mockTriggerDetails).toHaveBeenCalledWith({
      tenantKey: '',
      username: '',
      id: 14,
    });
    expect(mockNavigateToProject).toHaveBeenCalledWith('14', 'm-4');
  });

  it('onOpenProject shows an error toast when the details fetch rejects', async () => {
    mockUnwrap.mockRejectedValueOnce(new Error('boom'));
    const onOpenProject = getOpenProject();

    await onOpenProject({
      id: 13,
      name: 'Reject',
      mentor_count: 2,
      mentors: [],
    });

    expect(mockNavigateToProject).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith(
      "Couldn't open this project. Please try again.",
    );
  });
});
