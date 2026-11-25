import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';

const { captured, segments, hydration, tabProps, tab } = vi.hoisted(() => {
  const tabProps = {} as Record<string, Record<string, unknown>>;
  return {
    tabProps,
    tab: (name: string) => (props: Record<string, unknown>) => {
      tabProps[name] = props;
      return <div data-testid={`${name}-tab`} />;
    },
    captured: { props: null as Record<string, any> | null },
    segments: {
      values: ['llm', 'prompts', 'skills', 'datasets', 'mcp'] as string[],
      isLoading: false,
      mentorSettings: { mentor_id: 42 } as Record<string, unknown> | undefined,
      calls: [] as Array<Record<string, unknown>>,
    },
    hydration: { done: true, calls: [] as Array<Record<string, unknown>> },
  };
});

vi.mock('@iblai/iblai-js/web-containers', () => ({
  CREATE_AGENT_WIZARD_STEPS: ['llm', 'prompts', 'skills', 'datasets', 'mcp'],
  CreateAgentWizard: (props: Record<string, any>) => {
    captured.props = props;
    return <div role="dialog" aria-label="Create Agent" />;
  },
}));

vi.mock('@/hooks/use-mentor-segments', () => ({
  useMentorSegments: (options: Record<string, unknown>) => {
    segments.calls.push(options);
    return {
      filteredSegments: segments.values.map((value) => ({ value })),
      isLoading: segments.isLoading,
      mentorSettings: segments.mentorSettings,
    };
  },
}));

vi.mock('@/hooks/use-hydrate-mentor-rbac', () => ({
  useHydrateMentorRbac: (options: Record<string, unknown>) => {
    hydration.calls.push(options);
    return hydration.done;
  },
}));

vi.mock('@/components/spinner', () => ({
  Spinner: () => <div data-testid="spinner" />,
}));

vi.mock('../edit-mentor-modal/llm-tab', () => ({ LLMTab: tab('llm') }));
vi.mock('../edit-mentor-modal/tabs/prompts-tab', () => ({
  PromptsTab: tab('prompts'),
}));
vi.mock('../edit-mentor-modal/tabs/mcp-tab', () => ({ McpTab: tab('mcp') }));
vi.mock('../edit-mentor-modal/tabs/skills-tab', () => ({
  SkillsTab: tab('skills'),
}));
vi.mock('../edit-mentor-modal/tabs/datasets-tab/agent-datasets-tab', () => ({
  AgentDatasetsTabWrapper: tab('datasets'),
}));

import { CreateAgentWizardDialog } from '../create-agent-wizard-dialog';

const baseProps = {
  org: 'acme',
  username: 'alice',
  onCreated: vi.fn(),
  onFinish: vi.fn(),
  onClose: vi.fn(),
};

function renderStep(step: string) {
  return render(
    <>{captured.props!.renderStep({ mentorId: 'new-agent', step })}</>,
  );
}

describe('CreateAgentWizardDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captured.props = null;
    segments.values = ['llm', 'prompts', 'skills', 'datasets', 'mcp'];
    segments.isLoading = false;
    segments.mentorSettings = { mentor_id: 42 };
    segments.calls = [];
    hydration.done = true;
    hydration.calls = [];
    for (const key of Object.keys(tabProps)) delete tabProps[key];
  });

  afterEach(() => cleanup());

  it('opens the SDK wizard with the host props and every step before the agent exists', () => {
    render(<CreateAgentWizardDialog {...baseProps} />);

    expect(captured.props).toMatchObject({
      isOpen: true,
      org: 'acme',
      username: 'alice',
      onFinish: baseProps.onFinish,
      onClose: baseProps.onClose,
      steps: ['llm', 'prompts', 'skills', 'datasets', 'mcp'],
    });
    expect(segments.calls.at(-1)).toEqual({
      mentorId: null,
      tenantKey: 'acme',
    });
    expect(hydration.calls.at(-1)).toMatchObject({ enabled: false });
  });

  it('reads the new agent once created and tells the host', () => {
    render(<CreateAgentWizardDialog {...baseProps} />);

    act(() => captured.props!.onCreated('new-agent'));

    expect(baseProps.onCreated).toHaveBeenCalledWith('new-agent');
    expect(segments.calls.at(-1)).toEqual({
      mentorId: 'new-agent',
      tenantKey: 'acme',
    });
    expect(hydration.calls.at(-1)).toEqual({
      enabled: true,
      mentorDbId: 42,
      tenantKey: 'acme',
    });
  });

  it('works without an onCreated from the host', () => {
    render(<CreateAgentWizardDialog {...baseProps} onCreated={undefined} />);

    expect(() =>
      act(() => captured.props!.onCreated('new-agent')),
    ).not.toThrow();
  });

  it('leaves out the steps the person cannot use, as Edit Agent hides tabs', () => {
    segments.values = ['settings', 'prompts', 'skills', 'mcp'];
    render(<CreateAgentWizardDialog {...baseProps} />);

    act(() => captured.props!.onCreated('new-agent'));

    expect(captured.props!.steps).toEqual(['prompts', 'skills', 'mcp']);
    expect(baseProps.onFinish).not.toHaveBeenCalled();
  });

  it('finishes once, for the new agent, when the person may use no step', () => {
    segments.values = ['settings'];
    const { rerender } = render(<CreateAgentWizardDialog {...baseProps} />);

    act(() => captured.props!.onCreated('new-agent'));
    rerender(<CreateAgentWizardDialog {...baseProps} />);

    expect(captured.props!.steps).toEqual([]);
    expect(baseProps.onFinish).toHaveBeenCalledTimes(1);
    expect(baseProps.onFinish).toHaveBeenCalledWith('new-agent');
  });

  it('does not finish before the agent exists', () => {
    segments.values = [];
    render(<CreateAgentWizardDialog {...baseProps} />);

    expect(baseProps.onFinish).not.toHaveBeenCalled();
  });

  it('shows a spinner in the step until the permissions have loaded', () => {
    hydration.done = false;
    render(<CreateAgentWizardDialog {...baseProps} />);
    act(() => captured.props!.onCreated('new-agent'));

    expect(captured.props!.steps).toEqual([
      'llm',
      'prompts',
      'skills',
      'datasets',
      'mcp',
    ]);
    renderStep('llm');
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('shows a spinner while the settings load', () => {
    segments.isLoading = true;
    render(<CreateAgentWizardDialog {...baseProps} />);
    act(() => captured.props!.onCreated('new-agent'));

    renderStep('prompts');
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('does not wait on permissions when the settings carry no agent number', () => {
    hydration.done = false;
    segments.mentorSettings = {};
    render(<CreateAgentWizardDialog {...baseProps} />);
    act(() => captured.props!.onCreated('new-agent'));

    renderStep('llm');
    expect(screen.getByTestId('llm-tab')).toBeInTheDocument();
  });

  it.each(['llm', 'prompts', 'skills'])(
    'renders the OS %s tab pinned to the new agent',
    (step) => {
      render(<CreateAgentWizardDialog {...baseProps} />);
      act(() => captured.props!.onCreated('new-agent'));

      renderStep(step);

      expect(screen.getByTestId(`${step}-tab`)).toBeInTheDocument();
      expect(tabProps[step]).toEqual({
        mentorId: 'new-agent',
        tenantKey: 'acme',
      });
    },
  );

  it('renders the OS mcp tab pinned to the new agent, without the header switch', () => {
    render(<CreateAgentWizardDialog {...baseProps} />);
    act(() => captured.props!.onCreated('new-agent'));

    renderStep('mcp');

    expect(screen.getByTestId('mcp-tab')).toBeInTheDocument();
    expect(tabProps.mcp).toEqual({
      mentorId: 'new-agent',
      tenantKey: 'acme',
      showCapabilitySwitch: false,
    });
  });

  it('renders the OS datasets tab pinned to the new agent, off the URL', () => {
    render(<CreateAgentWizardDialog {...baseProps} />);
    act(() => captured.props!.onCreated('new-agent'));

    renderStep('datasets');

    expect(tabProps.datasets).toEqual({
      mentorId: 'new-agent',
      tenantKey: 'acme',
      syncToUrl: false,
      showCapabilitySwitch: false,
    });
  });
});
