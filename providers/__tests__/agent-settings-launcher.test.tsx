import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AgentSettingsLink } from '@iblai/iblai-js/web-containers';

const mockOpenEditMentorModal = vi.fn();
let mockIsAdmin = true;
let mockUserIsStudent = false;

vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({ openEditMentorModal: mockOpenEditMentorModal }),
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

  it('keeps agent names plain text for non-admins', () => {
    mockIsAdmin = false;
    renderLink();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('IT Help Desk')).toBeInTheDocument();
  });
});
