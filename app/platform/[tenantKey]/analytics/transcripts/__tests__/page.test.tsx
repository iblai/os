import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockUseParams = vi.fn();
const transcriptsSpy = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

vi.mock('@iblai/iblai-js/web-containers', () => ({
  AnalyticsTranscriptsStats: (props: { tenantKey: string }) => {
    transcriptsSpy(props);
    return (
      <div data-testid="analytics-transcripts">
        <span data-testid="tenant-key">{props.tenantKey}</span>
      </div>
    );
  },
}));

const TranscriptsPageModule = await import('../page');
const TranscriptsPage = TranscriptsPageModule.default;

describe('tenant analytics/transcripts page', () => {
  it('should export dynamic config', () => {
    expect(TranscriptsPageModule.dynamic).toBe('force-dynamic');
  });

  it('renders transcripts for the tenant with no mentor id', () => {
    mockUseParams.mockReturnValue({ tenantKey: 'my-tenant' });

    render(<TranscriptsPage />);

    expect(screen.getByTestId('tenant-key')).toHaveTextContent('my-tenant');
    const props = transcriptsSpy.mock.calls.at(-1)![0];
    expect(props.mentorId).toBe('');
    expect(props.selectedMentorId).toBeUndefined();
  });
});
