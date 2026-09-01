import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import ChartWithTooltip from '../chart-with-tooltip';

// recharts' ResponsiveContainer needs a measurable container, which jsdom does
// not provide. Stub the primitives so the source JSX (and config functions)
// execute and produce assertable DOM.
vi.mock('recharts', () => {
  const Stub = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    BarChart: Stub,
    Bar: Stub,
    XAxis: Stub,
    YAxis: Stub,
    CartesianGrid: Stub,
    ResponsiveContainer: Stub,
  };
});

vi.mock('@/components/ui/chart', () => ({
  ChartContainer: ({
    children,
    config,
    className,
  }: {
    children?: React.ReactNode;
    config: Record<string, { label?: React.ReactNode; color?: string }>;
    className?: string;
  }) => (
    <div
      data-testid="chart-container"
      data-config-label={String(config.value.label)}
      data-config-color={config.value.color}
      className={className}
    >
      {children}
    </div>
  ),
  ChartTooltip: ({ content }: { content?: React.ReactNode }) => (
    <div data-testid="chart-tooltip">{content}</div>
  ),
  ChartTooltipContent: () => <div data-testid="chart-tooltip-content" />,
}));

describe('ChartWithTooltip', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the translated heading', () => {
    render(<ChartWithTooltip />);
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(
      'Monthly Performance',
    );
  });

  it('passes the translated value label and color into the chart config', () => {
    render(<ChartWithTooltip />);
    const container = screen.getByTestId('chart-container');
    expect(container).toHaveAttribute('data-config-label', 'Value');
    expect(container).toHaveAttribute(
      'data-config-color',
      'hsl(var(--chart-1))',
    );
    expect(container).toHaveClass('h-[300px]');
  });

  it('renders the tooltip content', () => {
    render(<ChartWithTooltip />);
    expect(screen.getByTestId('chart-tooltip')).toBeInTheDocument();
    expect(screen.getByTestId('chart-tooltip-content')).toBeInTheDocument();
  });
});
