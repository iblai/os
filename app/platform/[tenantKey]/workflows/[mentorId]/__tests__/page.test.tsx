import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import WorkflowsPage from '../page';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => ({ tenantKey: 'test-tenant', mentorId: 'mentor-123' }),
}));

// The route is a thin wrapper: the only thing under test is how it derives
// and forwards the WorkflowsList props.
const mockWorkflowsList = vi.fn();
vi.mock('@iblai/iblai-js/web-containers/next', () => ({
  WorkflowsList: (props: Record<string, unknown>) => {
    mockWorkflowsList(props);
    return <div data-testid="workflows-list" />;
  },
}));

type ListProps = {
  tenantKey: string;
  mentorId: string;
  onOpenWorkflow: (workflow: {
    unique_id: string;
    entry_mentor_id: string;
  }) => void;
};

const renderAndGetProps = () => {
  render(<WorkflowsPage />);
  return mockWorkflowsList.mock.calls.at(-1)![0] as ListProps;
};

describe('WorkflowsPage (thin wrapper)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the SDK WorkflowsList', () => {
    render(<WorkflowsPage />);
    expect(screen.getByTestId('workflows-list')).toBeInTheDocument();
  });

  it('passes tenantKey and mentorId from the route', () => {
    const props = renderAndGetProps();

    expect(props).toMatchObject({
      tenantKey: 'test-tenant',
      mentorId: 'mentor-123',
    });
  });

  it("onOpenWorkflow opens the workflow under its entry agent and remembers this list's agent", () => {
    const props = renderAndGetProps();

    props.onOpenWorkflow({ unique_id: 'wf-1', entry_mentor_id: 'entry-9' });

    expect(mockPush).toHaveBeenCalledWith(
      '/platform/test-tenant/workflows/entry-9/wf-1?listMentorId=mentor-123',
    );
  });
});
