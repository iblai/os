import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockUseParams = vi.fn();
const topicsSpy = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

vi.mock('@iblai/iblai-js/web-containers', () => ({
  AnalyticsTopicsStats: (props: { tenantKey: string }) => {
    topicsSpy(props);
    return (
      <div data-testid="analytics-topics">
        <span data-testid="tenant-key">{props.tenantKey}</span>
      </div>
    );
  },
}));

const TopicsPageModule = await import('../page');
const TopicsPage = TopicsPageModule.default;

describe('tenant analytics/topics page', () => {
  it('should export dynamic config', () => {
    expect(TopicsPageModule.dynamic).toBe('force-dynamic');
  });

  it('renders topic stats for the tenant with no mentor id', () => {
    mockUseParams.mockReturnValue({ tenantKey: 'my-tenant' });

    render(<TopicsPage />);

    expect(screen.getByTestId('tenant-key')).toHaveTextContent('my-tenant');
    const props = topicsSpy.mock.calls.at(-1)![0];
    expect(props.mentorId).toBe('');
    expect(props.selectedMentorId).toBeUndefined();
  });
});
