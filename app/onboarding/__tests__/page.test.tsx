import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const { state, push } = vi.hoisted(() => ({
  state: { tenantKey: 'acme' },
  push: vi.fn(),
}));

vi.mock('@/hooks/use-onboarding', () => ({
  useOnboardingAccess: () => ({ canAccess: true, tenantKey: state.tenantKey }),
}));

vi.mock('@/hooks/use-user', () => ({ useUsername: () => 'tester' }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

vi.mock('@/lib/initial-loader', () => ({ hideInitialLoader: vi.fn() }));
vi.mock('@/components/spinner', () => ({ Spinner: () => <div>spinner</div> }));

// The OS-local final screen; stub it so the page test doesn't pull the data layer.
vi.mock('@/components/onboarding/onboarding-create-agent-step', () => ({
  OnboardingCreateAgentStep: () => <div>create-agent-step</div>,
}));

// The route renders the SDK wizard from @iblai/iblai-js/web-containers; stub it,
// expose onComplete, and render whatever final step the page passes. The wizard
// persists the answers itself (default), so the page no longer wires that.
vi.mock('@iblai/iblai-js/web-containers', () => ({
  OnboardingWizard: ({
    tenant,
    username,
    onComplete,
    renderFinalStep,
  }: {
    tenant: string;
    username: string;
    onComplete: (agentId: string | null) => void;
    renderFinalStep?: (context: unknown) => React.ReactNode;
  }) => (
    <div>
      <div>
        onboarding-wizard:{tenant}:{username}
      </div>
      <button type="button" onClick={() => onComplete('agent-1')}>
        complete-with-agent
      </button>
      <button type="button" onClick={() => onComplete(null)}>
        complete-no-agent
      </button>
      <div>
        {renderFinalStep?.({
          tenant,
          username,
          answers: { organizationName: '', sector: null },
          goBack: () => {},
          complete: () => {},
        })}
      </div>
    </div>
  ),
}));

import OnboardingPage from '../page';

describe('OnboardingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.tenantKey = 'acme';
  });

  it('renders the SDK wizard with the tenant + username and the OS create-agent final step', () => {
    render(<OnboardingPage />);
    expect(
      screen.getByText('onboarding-wizard:acme:tester'),
    ).toBeInTheDocument();
    expect(screen.getByText('create-agent-step')).toBeInTheDocument();
  });

  it('shows a loader while the current tenant resolves', () => {
    state.tenantKey = '';
    render(<OnboardingPage />);
    expect(screen.getByText('spinner')).toBeInTheDocument();
    expect(screen.queryByText(/onboarding-wizard/)).not.toBeInTheDocument();
  });

  it('redirects to the agent explore page on complete (tenant-level when no agent)', () => {
    render(<OnboardingPage />);
    fireEvent.click(
      screen.getByRole('button', { name: 'complete-with-agent' }),
    );
    expect(push).toHaveBeenCalledWith('/platform/acme/agent-1/explore');

    fireEvent.click(screen.getByRole('button', { name: 'complete-no-agent' }));
    expect(push).toHaveBeenCalledWith('/platform/acme/explore');
  });
});
