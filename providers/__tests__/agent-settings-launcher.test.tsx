import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AgentSettingsLink } from '@iblai/iblai-js/web-containers';

const mockOpenEditMentorModal = vi.fn();
let mockIsAdmin = true;
let mockUserIsStudent = false;

// `undefined` is what the SDK `useTenantContext` returns on the routes where
// `TenantProvider` runs with `skip` (/sso-login*, /version).
let mockTenantContext: { setDetermineUserPath: () => void } | undefined = {
  setDetermineUserPath: () => {},
};

vi.mock('@iblai/iblai-js/web-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@iblai/iblai-js/web-utils')>()),
  useTenantContext: () => mockTenantContext,
}));
// Mirrors the real hook's hard dependency on the tenant context: it
// destructures `useTenantContext()` on its first line, so it throws the same
// TypeError wherever no tenant context is provided.
vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => {
    const { setDetermineUserPath } = mockTenantContext as {
      setDetermineUserPath: () => void;
    };
    void setDetermineUserPath;
    return { openEditMentorModal: mockOpenEditMentorModal };
  },
}));
vi.mock('@/hooks/use-user', () => ({
  useIsAdmin: () => mockIsAdmin,
  useUserIsStudent: () => mockUserIsStudent,
}));

import { AgentSettingsLauncher } from '../agent-settings-launcher';

const AGENT = { uniqueId: 'agent-uuid', name: 'IT Help Desk' };

const renderLink = () =>
  render(
    <AgentSettingsLauncher>
      <AgentSettingsLink uniqueId={AGENT.uniqueId} name={AGENT.name} />
    </AgentSettingsLauncher>,
  );

describe('AgentSettingsLauncher', () => {
  beforeEach(() => {
    mockOpenEditMentorModal.mockClear();
    mockIsAdmin = true;
    mockUserIsStudent = false;
    mockTenantContext = { setDetermineUserPath: () => {} };
  });

  it('opens the Edit Agent dialog for the named agent, on its unique id', () => {
    renderLink();
    const link = screen.getByRole('button', {
      name: 'Open settings for IT Help Desk',
    });
    // Reads as a link: pointer, and blue + underline on hover.
    expect(link).toHaveClass(
      'cursor-pointer',
      'hover:text-blue-600',
      'hover:underline',
    );
    fireEvent.click(link);
    // No tab: the dialog opens on its default (Settings) tab.
    expect(mockOpenEditMentorModal).toHaveBeenCalledWith(
      undefined,
      'agent-uuid',
    );
  });

  it('keeps agent names plain text for admins browsing in user mode', () => {
    mockUserIsStudent = true;
    renderLink();
    expect(screen.queryByRole('button')).toBeNull();
    const name = screen.getByText('IT Help Desk');
    expect(name).toBeInTheDocument();
    // No pointer, no hover colour: it is not an affordance here.
    expect(name.closest('[class*="cursor-pointer"]')).toBeNull();
    expect(name.closest('[class*="hover:"]')).toBeNull();
  });

  it('renders its children without touching useNavigate on routes that have no tenant context (/sso-login*, /version)', () => {
    // Regression: the launcher is mounted from AppProvider on every route.
    // On the SSO hop the SDK TenantProvider is skipped and provides no tenant
    // context, so calling useNavigate there threw "Cannot destructure property
    // 'setDetermineUserPath' ... as it is undefined" and crashed sign-in.
    mockTenantContext = undefined;
    expect(() => renderLink()).not.toThrow();
    // Children still render; with no launcher the agent name is plain text.
    expect(screen.getByText('IT Help Desk')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('keeps agent names plain text for non-admins', () => {
    mockIsAdmin = false;
    renderLink();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('IT Help Desk')).toBeInTheDocument();
  });
});
