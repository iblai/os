import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

let mockTenant: { key?: string; name?: string; platform_name?: string } | null = {
  key: 'acme',
  name: 'Acme',
  platform_name: 'Acme Academy',
};

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/hooks/use-user', () => ({
  useCurrentTenant: () => ({ currentTenant: mockTenant }),
  useIsAdmin: () => false,
  useUsername: () => 'tester',
}));

// Heavy SDK/nav children are exercised elsewhere; stub them here.
vi.mock('@iblai/iblai-js/web-containers', () => ({
  NotificationDropdown: () => <div data-testid="notifications" />,
}));

vi.mock(
  '@/app/platform/[tenantKey]/[mentorId]/_components/nav-bar/user-profile',
  () => ({ UserProfile: () => <div data-testid="user-profile" /> }),
);

import { ApplyNavbar } from '../apply-navbar';

beforeEach(() => {
  mockTenant = { key: 'acme', name: 'Acme', platform_name: 'Acme Academy' };
});
afterEach(cleanup);

describe('ApplyNavbar', () => {
  it('shows the tenant name and the translated "Application" label', () => {
    render(<ApplyNavbar />);
    expect(screen.getByText('Acme Academy')).toBeInTheDocument();
    expect(screen.getByText('Application')).toBeInTheDocument();
  });

  it('falls back to the default brand name when no tenant is present', () => {
    mockTenant = null;
    render(<ApplyNavbar />);
    expect(screen.getByText('American Faith Academy')).toBeInTheDocument();
  });
});
