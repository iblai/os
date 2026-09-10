import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockUseParams = vi.fn();
const mockUseUsername = vi.fn();
const auditSpy = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => mockUseUsername(),
}));

vi.mock('@iblai/iblai-js/web-containers', () => ({
  AnalyticsAuditLogStats: (props: { tenantKey: string; userId: string }) => {
    auditSpy(props);
    return (
      <div data-testid="analytics-audit">
        <span data-testid="tenant-key">{props.tenantKey}</span>
      </div>
    );
  },
}));

const AuditPageModule = await import('../page');
const AuditPage = AuditPageModule.default;

describe('tenant analytics/audit page', () => {
  it('should export dynamic config', () => {
    expect(AuditPageModule.dynamic).toBe('force-dynamic');
  });

  it('renders the audit log for the tenant with no mentor id', () => {
    mockUseParams.mockReturnValue({ tenantKey: 'my-tenant' });
    mockUseUsername.mockReturnValue('testuser');

    render(<AuditPage />);

    expect(screen.getByTestId('tenant-key')).toHaveTextContent('my-tenant');
    const props = auditSpy.mock.calls.at(-1)![0];
    expect(props.userId).toBe('testuser');
    expect(props.mentorId).toBe('');
    expect(props.selectedMentorId).toBeUndefined();
  });

  it('falls back to an empty user id before the username resolves', () => {
    mockUseParams.mockReturnValue({ tenantKey: 'my-tenant' });
    mockUseUsername.mockReturnValue(undefined);

    render(<AuditPage />);

    expect(auditSpy.mock.calls.at(-1)![0].userId).toBe('');
  });
});
