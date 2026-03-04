import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useParams: () => ({ tenantKey: 'test' }),
}));

vi.mock('next/dynamic', () => ({
  default: () => {
    return () => <div data-testid="explore-content" />;
  },
}));

const PageModule = await import('../page');
const Page = PageModule.default;

describe('tenant explore page', () => {
  it('should export dynamicConfig', () => {
    expect(PageModule.dynamicConfig).toBe('force-dynamic');
  });

  it('should render', () => {
    const { getByTestId } = render(<Page />);
    expect(getByTestId('explore-content')).toBeInTheDocument();
  });
});
