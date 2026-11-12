import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

import {
  DEFAULT_PROMPTS,
  MENTOR_VISIBILITY,
  MODEL_AGENTS,
} from '@/lib/constants';

// vi.mock factories are hoisted above the imports, so the state they read
// has to be hoisted with them.
const { navigateToMentor, toast, captured, freeTrial, route } = vi.hoisted(
  () => ({
    navigateToMentor: vi.fn(),
    toast: { success: vi.fn(), error: vi.fn() },
    captured: { props: null as Record<string, any> | null },
    freeTrial: { blocks: false, isModalOpen: false, closeModal: vi.fn() },
    route: { pathname: '/platform/test-tenant/test-mentor' },
  }),
);

vi.mock('sonner', () => ({ toast }));

vi.mock('next/navigation', () => ({
  usePathname: () => route.pathname,
}));

vi.mock('@/hooks/use-tenants', () => ({
  useTenantKey: () => ({ tenant: 'test-tenant' }),
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => 'test-user',
}));

vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({ navigateToMentor }),
}));

vi.mock('@/hooks/user-user-actions', () => ({
  useShowFreeTrialDialog: () => ({
    executeWithTrialCheck: (fn: () => void) => (freeTrial.blocks ? null : fn()),
    isModalOpen: freeTrial.isModalOpen,
    closeModal: freeTrial.closeModal,
    FreeTrialDialog: ({ onClose }: { onClose: () => void }) => (
      <div role="dialog" aria-label="Free trial">
        <button onClick={onClose}>Close free trial</button>
      </div>
    ),
  }),
}));

vi.mock('@/lib/config', () => ({
  config: {
    showBaseMentor: () => true,
    iblTemplateMentor: () => 'template-mentor',
  },
}));

vi.mock('@iblai/iblai-js/web-containers', () => ({
  CreateAgentModal: (props: Record<string, any>) => {
    captured.props = props;
    if (!props.isOpen) return null;
    return (
      <div role="dialog" aria-label="Create Agent">
        <button onClick={() => props.onClose()}>sdk close</button>
      </div>
    );
  },
}));

import { CreateMentorModal } from '../create-mentor-modal';

/** What the SDK modal does after a successful create: onCreated, then onClose. */
async function sdkCreates(mentor: Record<string, unknown>) {
  await captured.props!.onCreated(mentor);
  captured.props!.onClose();
}

describe('CreateMentorModal', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    captured.props = null;
    freeTrial.blocks = false;
    freeTrial.isModalOpen = false;
    route.pathname = '/platform/test-tenant/test-mentor';
  });

  afterEach(() => {
    cleanup();
  });

  it("hands the SDK form this app's identity, options and prompt defaults", () => {
    render(<CreateMentorModal isOpen onClose={onClose} />);

    expect(screen.getByRole('dialog', { name: 'Create Agent' })).toBeTruthy();
    expect(captured.props).toMatchObject({
      isOpen: true,
      org: 'test-tenant',
      username: 'test-user',
      showBaseModel: true,
      modelOptions: MODEL_AGENTS,
      visibilityOptions: MENTOR_VISIBILITY,
      defaultPrompts: {
        system: DEFAULT_PROMPTS.DEFAULT_SYSTEM_PROMPT,
        proactive: DEFAULT_PROMPTS.DEFAULT_PROACTIVE_PROMPT,
        guided: DEFAULT_PROMPTS.DEFAULT_GUIDED_PROMPT,
        moderation: DEFAULT_PROMPTS.DEFAULT_MODERATION_PROMPT,
      },
    });
    expect(captured.props!.initialValues).toBeUndefined();
  });

  it('forwards prefilled values and the closed state', () => {
    const initialValues = { name: 'Prefilled', description: 'From the host' };
    render(
      <CreateMentorModal
        isOpen={false}
        onClose={onClose}
        initialValues={initialValues}
      />,
    );

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(captured.props).toMatchObject({ isOpen: false, initialValues });
  });

  it('passes a close through when nothing was created', () => {
    render(<CreateMentorModal isOpen onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'sdk close' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('lets the create through when the trial gate allows the action', () => {
    render(<CreateMentorModal isOpen onClose={onClose} />);

    expect(captured.props!.onBeforeCreate()).toBe(true);
  });

  it('blocks the create when the trial gate takes over', () => {
    freeTrial.blocks = true;
    render(<CreateMentorModal isOpen onClose={onClose} />);

    expect(captured.props!.onBeforeCreate()).toBe(false);
  });

  it('toasts, opens the new agent and swallows the close the SDK fires next', async () => {
    render(<CreateMentorModal isOpen onClose={onClose} />);

    await sdkCreates({ unique_id: 'new-agent' });

    expect(toast.success).toHaveBeenCalledWith('Agent created successfully');
    expect(navigateToMentor).toHaveBeenCalledWith(
      'new-agent',
      undefined,
      undefined,
    );
    expect(onClose).not.toHaveBeenCalled();

    // The guard covers one close only; a later close is a real one.
    fireEvent.click(screen.getByRole('button', { name: 'sdk close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('opens the new agent under the tenant from the /create-mentor page', async () => {
    route.pathname = '/create-mentor';
    render(<CreateMentorModal isOpen onClose={onClose} />);

    await sdkCreates({ unique_id: 'new-agent' });

    expect(navigateToMentor).toHaveBeenCalledWith(
      'new-agent',
      undefined,
      'test-tenant',
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it('only toasts and closes when the created agent has no id', async () => {
    render(<CreateMentorModal isOpen onClose={onClose} />);

    await sdkCreates({});

    expect(toast.success).toHaveBeenCalledWith('Agent created successfully');
    expect(navigateToMentor).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('toasts the backend message on a failed create and logs it', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    render(<CreateMentorModal isOpen onClose={onClose} />);

    captured.props!.onError({ error: { error: 'Name already taken' } });

    expect(toast.error).toHaveBeenCalledWith('Name already taken');
    expect(consoleError).toHaveBeenCalledWith(
      JSON.stringify({
        tenant: 'test-tenant',
        error: { error: { error: 'Name already taken' } },
      }),
    );
    consoleError.mockRestore();
  });

  it('falls back to a generic message when the error carries none', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    render(<CreateMentorModal isOpen onClose={onClose} />);

    captured.props!.onError(new Error('boom'));
    captured.props!.onError(null);

    expect(toast.error).toHaveBeenNthCalledWith(1, 'Failed to create agent');
    expect(toast.error).toHaveBeenNthCalledWith(2, 'Failed to create agent');
    consoleError.mockRestore();
  });

  it('shows the free-trial dialog while the trial hook has it open', () => {
    freeTrial.isModalOpen = true;
    render(<CreateMentorModal isOpen onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Close free trial' }));

    expect(screen.getByRole('dialog', { name: 'Free trial' })).toBeTruthy();
    expect(freeTrial.closeModal).toHaveBeenCalledTimes(1);
  });
});
