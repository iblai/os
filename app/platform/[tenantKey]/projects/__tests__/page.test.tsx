import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProjectsRoute from '../page';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useParams: () => ({
    tenantKey: 'test-tenant',
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
vi.mock('@/hooks/use-user', () => ({
  useUsername: () => 'test-user',
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

describe('ProjectsRoute (thin wrapper)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('onOpenProject navigates to the project with its first mentor', async () => {
    render(<ProjectsRoute />);
    const props = mockProjectsPage.mock.calls[0][0] as {
      onOpenProject: (project: unknown) => void;
    };

    props.onOpenProject({
      id: 42,
      name: 'Test Project',
      mentors: [{ id: 9, unique_id: 'm-9', name: 'A' }],
    });

    expect(mockNavigateToProject).toHaveBeenCalledWith('42', 'm-9');
  });

  it('onOpenProject falls back to empty mentor id when there are no mentors', () => {
    render(<ProjectsRoute />);
    const props = mockProjectsPage.mock.calls[0][0] as {
      onOpenProject: (project: unknown) => void;
    };

    props.onOpenProject({ id: 7, name: 'No Mentors', mentors: [] });
    expect(mockNavigateToProject).toHaveBeenCalledWith('7', '');
  });

  it('onOpenProject falls back to empty mentor id when mentors is undefined', () => {
    render(<ProjectsRoute />);
    const props = mockProjectsPage.mock.calls[0][0] as {
      onOpenProject: (project: unknown) => void;
    };

    props.onOpenProject({ id: 8, name: 'Undefined Mentors' });
    expect(mockNavigateToProject).toHaveBeenCalledWith('8', '');
  });
});
