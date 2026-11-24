import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BrowserAgentNotSetUp } from '@/components/errors/browser-agent-not-set-up';

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
  vi.clearAllMocks();
  currentTenant = { key: 'acme', name: 'Acme Corporation' };
  metadata = {};
});

describe('naming the organization', () => {
  it('says which one is not set up, and says it strongly', () => {
    render(<BrowserAgentNotSetUp />);

    const named = screen.getByText('Acme Corporation');
    expect(named.tagName).toBe('STRONG');
  });

  it('falls back to the key when the organization has no name', () => {
    currentTenant = { key: 'acme' };
    render(<BrowserAgentNotSetUp />);

    expect(screen.getByText('acme')).toBeInTheDocument();
  });

  it('still reads as a sentence when there is no organization at all', () => {
    currentTenant = null;
    render(<BrowserAgentNotSetUp />);

    expect(screen.getByText('this organization')).toBeInTheDocument();
  });
});

describe('the way out', () => {
  it('offers to change organization, which the panel opens itself', async () => {
    render(<BrowserAgentNotSetUp />);

    await userEvent.click(
      screen.getByRole('button', { name: 'Change Organization' }),
    );

    // In an embed this posts the chooser to the host rather than navigating
    // the iframe, which would tear the panel out of the page.
    expect(openTenantSwitcher).toHaveBeenCalledWith({
      authUrl: 'https://login.iblai.app',
      tenant: 'acme',
      popup: true,
    });
  });

  it('mails the organization’s own address when it has one', () => {
    metadata = { support_email: 'admins@acme.com' };
    render(<BrowserAgentNotSetUp />);

    expect(
      screen.getByRole('link', { name: 'admins@acme.com' }),
    ).toHaveAttribute('href', 'mailto:admins@acme.com');
  });

  it('falls back to ibl.ai support when it has none', () => {
    render(<BrowserAgentNotSetUp />);

    expect(
      screen.getByRole('link', { name: 'support@ibl.ai' }),
    ).toHaveAttribute('href', 'mailto:support@ibl.ai');
  });

  // The panel has nowhere to go back to: a `mailto:` followed in place
  // replaced this screen with the browser's broken-page icon.
  it('opens the mail client away from the panel, and shows the address', () => {
    render(<BrowserAgentNotSetUp />);

    const link = screen.getByRole('link', { name: 'support@ibl.ai' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(screen.getByText(/Ask someone to set it up/)).toBeInTheDocument();
  });
});
