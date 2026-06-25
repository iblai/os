import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockUseParams = vi.fn();
const mockUseSelector = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

vi.mock('react-redux', () => ({
  useSelector: (selector: any) => mockUseSelector(selector),
}));

vi.mock('@iblai/iblai-js/web-containers', () => ({
  AnalyticsTranscriptsStats: vi.fn(({ selectedMentorId }) => (
    <div data-testid="analytics-transcripts">
      <span data-testid="selected-mentor-id">{selectedMentorId}</span>
    </div>
  )),
}));

vi.mock('@/features/analytics/slice', () => ({
  selectSelectedMentor: vi.fn(),
}));

const TranscriptsPageModule = await import('../page');
const TranscriptsPage = TranscriptsPageModule.default;

describe('analytics/transcripts page', () => {
  it('should export dynamic config', () => {
    expect(TranscriptsPageModule.dynamic).toBe('force-dynamic');
  });

  it('should render component', () => {
    mockUseParams.mockReturnValue({ tenantKey: 'test', mentorId: 'test' });
    mockUseSelector.mockReturnValue(null);
    render(<TranscriptsPage />);
    expect(screen.getByTestId('analytics-transcripts')).toBeInTheDocument();
  });
});
