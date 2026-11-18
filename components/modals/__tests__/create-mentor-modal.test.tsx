import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

import { DEFAULT_PROMPTS, MODEL_AGENTS } from '@/lib/constants';

// vi.mock factories are hoisted above the imports, so the state they read
// has to be hoisted with them.
const { navigateToMentor, toast, captured, freeTrial, route } = vi.hoisted(
  () => ({
    navigateToMentor: vi.fn(),
    toast: { success: vi.fn(), error: vi.fn() },
    captured: { wizard: null as Record<string, any> | null },
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

vi.mock('@iblai/iblai-js/web-utils', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@iblai/iblai-js/web-utils')>();
  return {
    ...actual,
    useShowFreeTrialDialog: () => ({
      executeWithTrialCheck: (fn: () => void) =>
        freeTrial.blocks ? null : fn(),
      isModalOpen: freeTrial.isModalOpen,
      closeModal: freeTrial.closeModal,
      FreeTrialDialog: ({ onClose }: { onClose: () => void }) => (
        <div role="dialog" aria-label="Free trial">
          <button onClick={onClose}>Close free trial</button>
        </div>
      ),
    }),
  };
});

vi.mock('@/lib/config', () => ({
  config: {
    showBaseMentor: () => true,
    iblTemplateMentor: () => 'template-mentor',
  },
}));

vi.mock('../create-agent-wizard-dialog', () => ({
  CreateAgentWizardDialog: (props: Record<string, any>) => {
    captured.wizard = props;
    return <div role="dialog" aria-label="Create Agent wizard" />;
  },
}));

import { CreateMentorModal } from '../create-mentor-modal';

describe('CreateMentorModal', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    captured.wizard = null;
    freeTrial.blocks = false;
    freeTrial.isModalOpen = false;
    route.pathname = '/platform/test-tenant/test-mentor';
  });

  afterEach(() => {
    cleanup();
  });

  async function openWizard(
    props: Partial<React.ComponentProps<typeof CreateMentorModal>> = {},
  ) {
    render(<CreateMentorModal isOpen onClose={onClose} {...props} />);
    await screen.findByRole('dialog', { name: 'Create Agent wizard' });
    return captured.wizard!;
  }

  it("hands the wizard this app's identity, options and prompt defaults", async () => {
    const wizard = await openWizard();

    expect(wizard).toMatchObject({
      org: 'test-tenant',
      username: 'test-user',
      showBaseModel: true,
      modelOptions: MODEL_AGENTS,
      defaultPrompts: {
        system: DEFAULT_PROMPTS.DEFAULT_SYSTEM_PROMPT,
        proactive: DEFAULT_PROMPTS.DEFAULT_PROACTIVE_PROMPT,
        guided: DEFAULT_PROMPTS.DEFAULT_GUIDED_PROMPT,
        moderation: DEFAULT_PROMPTS.DEFAULT_MODERATION_PROMPT,
      },
    });
    expect(wizard.initialValues).toBeUndefined();
    expect(wizard).not.toHaveProperty('visibilityOptions');
  });

  it('forwards prefilled values', async () => {
    const initialValues = { name: 'Prefilled', description: 'From the host' };
    const wizard = await openWizard({ initialValues });

    expect(wizard.initialValues).toBe(initialValues);
  });

  it('mounts nothing while closed', () => {
    render(<CreateMentorModal isOpen={false} onClose={onClose} />);

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(captured.wizard).toBeNull();
  });

  it('lets the create through when the trial gate allows the action', async () => {
    const wizard = await openWizard();

    expect(wizard.onBeforeCreate()).toBe(true);
  });

  it('blocks the create when the trial gate takes over', async () => {
    freeTrial.blocks = true;
    const wizard = await openWizard();

    expect(wizard.onBeforeCreate()).toBe(false);
  });

  it('toasts on create and stays on the page for the next steps', async () => {
    const wizard = await openWizard();

    wizard.onCreated('new-agent');

    expect(toast.success).toHaveBeenCalledWith('Agent created successfully');
    expect(navigateToMentor).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('just closes when closed before the agent exists', async () => {
    const wizard = await openWizard();

    wizard.onClose(null);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(navigateToMentor).not.toHaveBeenCalled();
  });

  it("opens the new agent's chat when closed after it was created", async () => {
    const wizard = await openWizard();

    wizard.onClose('new-agent');

    expect(navigateToMentor).toHaveBeenCalledWith(
      'new-agent',
      undefined,
      undefined,
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("opens the new agent's chat on Finish and ignores the close after it", async () => {
    const wizard = await openWizard();

    wizard.onFinish('new-agent');
    wizard.onClose('new-agent');

    expect(navigateToMentor).toHaveBeenCalledTimes(1);
    expect(navigateToMentor).toHaveBeenCalledWith(
      'new-agent',
      undefined,
      undefined,
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it('opens the new agent under the tenant from the /create-mentor page', async () => {
    route.pathname = '/create-mentor';
    const wizard = await openWizard();

    wizard.onFinish('new-agent');

    expect(navigateToMentor).toHaveBeenCalledWith(
      'new-agent',
      undefined,
      'test-tenant',
    );
  });

  it('toasts the backend message on a failed create and logs it', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const wizard = await openWizard();

    wizard.onError({ error: { error: 'Name already taken' } });

    expect(toast.error).toHaveBeenCalledWith('Name already taken');
    expect(consoleError).toHaveBeenCalledWith(
      JSON.stringify({
        tenant: 'test-tenant',
        error: { error: { error: 'Name already taken' } },
      }),
    );
    consoleError.mockRestore();
  });

  it('falls back to a generic message when the error carries none', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const wizard = await openWizard();

    wizard.onError(new Error('boom'));
    wizard.onError(null);

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
