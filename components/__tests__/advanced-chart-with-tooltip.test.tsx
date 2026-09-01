import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import AdvancedChartWithTooltip from '../advanced-chart-with-tooltip';

// recharts' ResponsiveContainer needs a measurable container, which jsdom does
// not provide. Stub the primitives so the source JSX (and tickFormatter /
// config functions) execute and produce assertable DOM.
vi.mock('recharts', () => {
  const Stub = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    AreaChart: Stub,
    Area: Stub,
    // Render the tickFormatter so its branch is covered.
    XAxis: Stub,
    YAxis: ({
      tickFormatter,
    }: {
      tickFormatter?: (value: number) => string;
    }) => <div data-testid="y-axis">{tickFormatter?.(1200)}</div>,
    CartesianGrid: Stub,
    ResponsiveContainer: Stub,
  };
});

// The `./detailed-chart-tooltip` placeholder module does not exist on disk; the
// vitest config aliases it to a test stub that renders
// `data-testid="detailed-chart-tooltip"`, so no per-test mock is needed here.

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
}));

describe('AdvancedChartWithTooltip', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the translated heading', () => {
    render(<AdvancedChartWithTooltip />);
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(
      'Monthly Revenue',
    );
  });

  it('passes the translated revenue label and color into the chart config', () => {
    render(<AdvancedChartWithTooltip />);
    const container = screen.getByTestId('chart-container');
    expect(container).toHaveAttribute('data-config-label', 'Revenue');
    expect(container).toHaveAttribute(
      'data-config-color',
      'hsl(215, 100%, 60%)',
    );
    expect(container).toHaveClass('h-[300px]');
  });

  it('formats the Y axis ticks with a dollar prefix', () => {
    render(<AdvancedChartWithTooltip />);
    expect(screen.getByTestId('y-axis')).toHaveTextContent('$1200');
  });

  it('renders the custom detailed tooltip as the tooltip content', () => {
    render(<AdvancedChartWithTooltip />);
    expect(screen.getByTestId('chart-tooltip')).toBeInTheDocument();
    expect(screen.getByTestId('detailed-chart-tooltip')).toBeInTheDocument();
  });
});
