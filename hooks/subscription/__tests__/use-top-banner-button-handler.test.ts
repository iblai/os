import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useTopBannerButtonHandler } from '../use-top-banner-button-handler';

// ---- Mocks ----
let mockMetadata: { support_email?: string } | undefined = {
  support_email: 'metadata-support@example.com',
};
let mockCurrentTenant: { org?: string } | undefined = {
  org: 'acme',
};
let mockUserEmail: string | null = 'student@example.com';

vi.mock('next/navigation', () => ({
  useParams: () => ({ tenantKey: 'acme' }),
}));

vi.mock('@iblai/iblai-js/web-utils', () => ({
  SUBSCRIPTION_V2_TRIGGERS: {
    CONTACT_ADMIN: 'TRIGGER_CONTACT_ADMIN',
    PRICING_MODAL: 'TRIGGER_PRICING_MODAL',
  },
  SUBSCRIPTION_MESSAGES: {
    CREDIT_EXHAUSTED: {
      STUDENT_UNDER_PAID_PACKAGE_EMAIL_SUBJECT: ({
        currentTenantOrg,
      }: {
        currentTenantOrg: string;
      }) => `Credits exhausted (${currentTenantOrg})`,
      STUDENT_UNDER_PAID_PACKAGE_EMAIL_BODY: ({
        currentTenantOrg,
        userEmail,
      }: {
        currentTenantOrg: string;
        userEmail: string;
      }) => `Hello, please top up ${currentTenantOrg} for ${userEmail}`,
    },
  },
  useTenantMetadata: ({ org }: { org: string }) => ({
    metadata: mockMetadata,
    metadataLoaded: true,
    _org: org,
  }),
}));

vi.mock('@/hooks/use-user', () => ({
  useCurrentTenant: () => ({ currentTenant: mockCurrentTenant }),
}));

vi.mock('@/features/utils', () => ({
  getUserEmail: () => mockUserEmail,
}));

vi.mock('@/lib/config', () => ({
  config: {
    supportEmail: () => 'fallback-support@example.com',
  },
}));

beforeEach(() => {
  mockMetadata = { support_email: 'metadata-support@example.com' };
  mockCurrentTenant = { org: 'acme' };
  mockUserEmail = 'student@example.com';
});

describe('useTopBannerButtonHandler', () => {
  it('returns a no-op for an unknown trigger', () => {
    const { result } = renderHook(() => useTopBannerButtonHandler());

    const handler = result.current('UNKNOWN_TRIGGER');
    expect(typeof handler).toBe('function');
    expect(() => handler()).not.toThrow();
  });

  it('returns a no-op when no trigger is supplied', () => {
    const { result } = renderHook(() => useTopBannerButtonHandler());

    const handler = result.current();
    expect(() => handler()).not.toThrow();
  });

  it('opens a mailto with metadata support_email and tenant/user details for CONTACT_ADMIN', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    const { result } = renderHook(() => useTopBannerButtonHandler());
    const handler = result.current('TRIGGER_CONTACT_ADMIN');
    handler();

    expect(openSpy).toHaveBeenCalledTimes(1);
    const [url, target] = openSpy.mock.calls[0];
    expect(target).toBe('_blank');
    expect(url).toContain('mailto:metadata-support@example.com');
    expect(url).toContain(
      `subject=${encodeURIComponent('Credits exhausted (acme)')}`,
    );
    expect(url).toContain(
      `body=${encodeURIComponent(
        'Hello, please top up acme for student@example.com',
      )}`,
    );

    openSpy.mockRestore();
  });

  it('falls back to config.supportEmail() when metadata.support_email is missing', () => {
    mockMetadata = {};
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    const { result } = renderHook(() => useTopBannerButtonHandler());
    result.current('TRIGGER_CONTACT_ADMIN')();

    const [url] = openSpy.mock.calls[0];
    expect(url).toContain('mailto:fallback-support@example.com');

    openSpy.mockRestore();
  });

  it('substitutes empty strings when tenant org and user email are unavailable', () => {
    mockCurrentTenant = undefined;
    mockUserEmail = null;
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    const { result } = renderHook(() => useTopBannerButtonHandler());
    result.current('TRIGGER_CONTACT_ADMIN')();

    const [url] = openSpy.mock.calls[0];
    expect(url).toContain(
      `subject=${encodeURIComponent('Credits exhausted ()')}`,
    );
    expect(url).toContain(
      `body=${encodeURIComponent('Hello, please top up  for ')}`,
    );

    openSpy.mockRestore();
  });
});
