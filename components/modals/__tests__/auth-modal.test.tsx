import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { AuthModal } from '../auth-modal';

// Mock the auth redirect util — we only assert it is invoked with the tenant.
// Partial mock: the dialog primitives also pull `cn` from this module.
const mockRedirect = vi.fn();
vi.mock('@/lib/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils')>();
  return {
    ...actual,
    redirectToAuthSpaJoinTenant: (...args: unknown[]) => mockRedirect(...args),
  };
});

// Logo pulls in many runtime hooks (params, header, mentor settings); stub it
// down to a deterministic marker that echoes the tenantKey prop. The source
// imports it via `../logo` which resolves to `@/components/logo`; mocking the
// alias keeps the mock stable regardless of importer.
vi.mock('@/components/logo', () => ({
  default: ({ tenantKey }: { tenantKey: string }) => (
    <div data-testid="logo">{tenantKey}</div>
  ),
}));

describe('AuthModal', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('does not render content when closed', () => {
    render(<AuthModal isOpen={false} onClose={vi.fn()} tenantKey="acme" />);
    expect(screen.queryByText('Welcome to Agentic OS')).not.toBeInTheDocument();
  });

  it('renders the title, prompt, description, logo and login button when open', () => {
    render(<AuthModal isOpen onClose={vi.fn()} tenantKey="acme" />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Welcome to Agentic OS')).toBeInTheDocument();
    expect(
      screen.getByText('Create an account or login to continue'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Please login to continue using the chat.'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('logo')).toHaveTextContent('acme');
    expect(
      screen.getByRole('button', { name: 'Login To Chat' }),
    ).toBeInTheDocument();
  });

  it('redirects to the tenant join flow when the login button is clicked', () => {
    render(<AuthModal isOpen onClose={vi.fn()} tenantKey="acme" />);

    fireEvent.click(screen.getByRole('button', { name: 'Login To Chat' }));

    expect(mockRedirect).toHaveBeenCalledTimes(1);
    expect(mockRedirect).toHaveBeenCalledWith('acme');
  });

  it('invokes onClose when the dialog requests to close (Escape)', () => {
    const onClose = vi.fn();
    render(<AuthModal isOpen onClose={onClose} tenantKey="acme" />);

    fireEvent.keyDown(screen.getByRole('dialog'), {
      key: 'Escape',
      code: 'Escape',
    });

    expect(onClose).toHaveBeenCalled();
  });
});
