import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

let lastProviderProps: Record<string, unknown> | null;
let mockEmbedMode: boolean;
let mockIsLoggedIn: boolean;
let mockUsername: string | null;

vi.mock('next/navigation', () => ({
  useParams: () => ({ tenantKey: 'test-tenant' }),
}));

vi.mock('@iblai/iblai-js/web-containers', () => ({
  MasterAgentProvider: ({
    children,
    ...props
  }: { children: React.ReactNode } & Record<string, unknown>) => {
    lastProviderProps = props;
    return <>{children}</>;
  },
}));

vi.mock('@/hooks/use-embed-mode', () => ({
  useEmbedMode: () => mockEmbedMode,
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => mockUsername,
}));

vi.mock('@/lib/utils', () => ({
  isLoggedIn: () => mockIsLoggedIn,
}));

vi.mock('@/lib/config', () => ({
  config: {
    authUrl: () => 'https://auth.example.com',
    legacyLmsUrl: () => 'https://learn.example.com',
  },
}));

import TenantLayout from '../layout';

beforeEach(() => {
  lastProviderProps = null;
  mockEmbedMode = false;
  mockIsLoggedIn = true;
  mockUsername = 'test-user';
});

describe('TenantLayout', () => {
  it("holds the Assistant for the organization's pages", () => {
    render(
      <TenantLayout>
        <div data-testid="page">Page</div>
      </TenantLayout>,
    );

    expect(screen.getByTestId('page')).toBeInTheDocument();
    expect(lastProviderProps).toEqual({
      tenant: 'test-tenant',
      username: 'test-user',
      authUrl: 'https://auth.example.com',
      lmsUrl: 'https://learn.example.com',
      enabled: true,
    });
  });

  it('turns it off when signed out', () => {
    mockIsLoggedIn = false;
    mockUsername = null;

    render(<TenantLayout>Page</TenantLayout>);

    expect(lastProviderProps).toMatchObject({ username: '', enabled: false });
  });

  it('turns it off when the app is itself embedded', () => {
    mockEmbedMode = true;

    render(<TenantLayout>Page</TenantLayout>);

    expect(lastProviderProps?.enabled).toBe(false);
  });
});
