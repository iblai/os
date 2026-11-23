import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BrowserAgentUnsupported } from '@/components/errors/browser-agent-unsupported';

const openTenantSwitcher = vi.fn();

let currentTenant: { key: string; name?: string } | null = {
  key: 'acme',
  name: 'Acme Corporation',
};
let metadata: Record<string, unknown> = {};

vi.mock('@iblai/iblai-js/web-utils', () => ({
  openTenantSwitcher: (args: unknown) => openTenantSwitcher(args),
}));

vi.mock('@/hooks/use-user', () => ({
  useCurrentTenant: () => ({ currentTenant }),
}));

vi.mock('@/hooks/use-tenant-object-metadata', () => ({
  useTenantObjectMetadata: () => metadata,
}));

vi.mock('@/lib/config', () => ({
  config: {
    authUrl: () => 'https://login.iblai.app',
    supportEmail: () => 'support@ibl.ai',
    // Read at module load by lib/constants, which this graph pulls in.
    iblTemplateMentor: () => 'ai-mentor',
  },
}));

beforeEach(() => {
  openTenantSwitcher.mockClear();
  currentTenant = { key: 'acme', name: 'Acme Corporation' };
  metadata = {};
});

describe('an organization that cannot run the agent at all', () => {
  it('names the organization it is talking about', () => {
    render(<BrowserAgentUnsupported />);

    expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    expect(screen.getByText('Not Available Here')).toBeInTheDocument();
  });

  // The reader IS whoever manages the organization, so the sibling screen's
  // "ask someone who manages it" would be telling them to ask themselves —
  // and opening the panel again, which that screen suggests, never helps.
  it('does not send them to a colleague, or back round the panel', () => {
    render(<BrowserAgentUnsupported />);

    expect(screen.queryByText(/manages/i)).toBeNull();
    expect(screen.queryByText(/opening this panel/i)).toBeNull();
    expect(
      screen.getByRole('link', { name: 'Ask us to turn it on' }),
    ).toHaveAttribute('href', 'mailto:support@ibl.ai');
  });

  it('still lets them leave for an organization that works', async () => {
    render(<BrowserAgentUnsupported />);

    await userEvent.click(
      screen.getByRole('button', { name: 'Change Organization' }),
    );

    expect(openTenantSwitcher).toHaveBeenCalledWith({
      authUrl: 'https://login.iblai.app',
      tenant: 'acme',
      popup: true,
    });
  });

  // "Ask us" means us. The organization's own address is right on the sibling
  // screen, where the reader is told to ask a colleague — here it would send
  // them to their own IT desk, who cannot turn this on either.
  it("ignores the organization's own support address", () => {
    metadata = { support_email: 'help@acme.test' };
    render(<BrowserAgentUnsupported />);

    expect(
      screen.getByRole('link', { name: 'Ask us to turn it on' }),
    ).toHaveAttribute('href', 'mailto:support@ibl.ai');
  });

  it('says "this organization" when it has no name to use', () => {
    currentTenant = null;
    render(<BrowserAgentUnsupported />);

    expect(screen.getByText('this organization')).toBeInTheDocument();
  });
});
