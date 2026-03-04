import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockUseParams = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

vi.mock('next/dynamic', () => ({
  default: (_importFn: any, _options: any) => {
    const DynamicComponent = ({ tenantKey }: { tenantKey: string }) => (
      <div data-testid="explore-page-content">
        <span data-testid="tenant-key">{tenantKey}</span>
      </div>
    );
    return DynamicComponent;
  },
}));

const ExplorePageModule = await import('../page');
const ExplorePage = ExplorePageModule.default;

describe('explore page', () => {
  it('should export dynamicConfig', () => {
    expect(ExplorePageModule.dynamicConfig).toBe('force-dynamic');
  });

  it('should render with tenantKey from params', () => {
    mockUseParams.mockReturnValue({
      tenantKey: 'my-tenant',
      mentorId: 'my-mentor',
    });

    render(<ExplorePage />);

    expect(screen.getByTestId('explore-page-content')).toBeInTheDocument();
    expect(screen.getByTestId('tenant-key')).toHaveTextContent('my-tenant');
  });

  it('should handle missing params', () => {
    mockUseParams.mockReturnValue({});

    render(<ExplorePage />);

    expect(screen.getByTestId('explore-page-content')).toBeInTheDocument();
  });
});
