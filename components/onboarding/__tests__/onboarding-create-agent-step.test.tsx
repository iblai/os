import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const { mockCreateMentor, mockUnwrap } = vi.hoisted(() => ({
  mockCreateMentor: vi.fn(),
  mockUnwrap: vi.fn(),
}));
const mockUseCreateMentorMutation = vi.fn();
const mockUseGetMentorsQuery = vi.fn();

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useCreateMentorMutation: (...args: unknown[]) =>
    mockUseCreateMentorMutation(...args),
  useGetMentorsQuery: (...args: unknown[]) => mockUseGetMentorsQuery(...args),
}));

// Stub the SDK shell pieces so the test doesn't load the whole web-containers bundle.
vi.mock('@iblai/iblai-js/web-containers', () => ({
  StepHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
  onboardingPrimaryButtonClass: 'btn',
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/config', () => ({
  config: { iblTemplateMentor: () => 'ai-mentor' },
}));

import { OnboardingCreateAgentStep } from '../onboarding-create-agent-step';

const baseContext = {
  tenant: 'acme',
  username: 'tester',
  answers: { organizationName: 'Acme', segment: 'higher_education' },
  suggestedAgent: { name: 'Campus Assistant', description: 'Helps students.' },
  goBack: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUnwrap.mockResolvedValue({ unique_id: 'new-agent' });
  mockCreateMentor.mockReturnValue({ unwrap: mockUnwrap });
  mockUseCreateMentorMutation.mockReturnValue([
    mockCreateMentor,
    { isLoading: false },
  ]);
  mockUseGetMentorsQuery.mockReturnValue({
    data: { count: 1, results: [{ unique_id: 'existing-agent' }] },
    isLoading: false,
  });
});

describe('OnboardingCreateAgentStep', () => {
  it('prefills name + description from the segment suggestion', () => {
    render(<OnboardingCreateAgentStep {...baseContext} complete={vi.fn()} />);
    expect(screen.getByText('Make your first agent')).toBeInTheDocument();
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe(
      'Campus Assistant',
    );
    expect(
      (screen.getByLabelText('Description') as HTMLTextAreaElement).value,
    ).toBe('Helps students.');
  });

  it('kicks off creation without waiting and completes with an existing agent id', async () => {
    // Slow endpoint — never resolves, to prove we don't wait for it.
    mockUnwrap.mockReturnValue(new Promise(() => {}));
    const complete = vi.fn();
    render(<OnboardingCreateAgentStep {...baseContext} complete={complete} />);

    fireEvent.click(screen.getByRole('button', { name: 'Create agent' }));

    await waitFor(() => expect(mockCreateMentor).toHaveBeenCalledTimes(1));
    const payload = mockCreateMentor.mock.calls[0][0];
    expect(payload.org).toBe('acme');
    expect(payload.userId).toBe('tester');
    expect(payload.formData.new_mentor_name).toBe('Campus Assistant');
    expect(payload.formData.mentor_visibility).toBe(
      'viewable_by_tenant_students',
    );
    expect(payload.formData.metadata).toEqual({ category: null });
    expect(payload.formData.categories).toBeUndefined();

    // Completes IMMEDIATELY with the EXISTING agent's id (not the new one).
    expect(complete).toHaveBeenCalledWith('existing-agent');
  });

  it('completes with null when the tenant has no agents yet', () => {
    mockUseGetMentorsQuery.mockReturnValue({
      data: { count: 0, results: [] },
      isLoading: false,
    });
    const complete = vi.fn();
    render(<OnboardingCreateAgentStep {...baseContext} complete={complete} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create agent' }));
    expect(complete).toHaveBeenCalledWith(null);
  });

  it('swaps the form for a loading state once submitted', () => {
    // Slow endpoint that never resolves — the loading state must show regardless.
    mockUnwrap.mockReturnValue(new Promise(() => {}));
    render(<OnboardingCreateAgentStep {...baseContext} complete={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Create agent' }));

    expect(screen.getByRole('status')).toHaveTextContent(
      'Creating your agent…',
    );
    // The form is replaced.
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Create agent' }),
    ).not.toBeInTheDocument();
  });
});
