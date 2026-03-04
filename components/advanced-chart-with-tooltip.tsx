'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
// @ts-expect-error - detailed-chart-tooltip module does not exist yet, placeholder import
import { DetailedChartTooltip } from './detailed-chart-tooltip';

// Sample data with additional info
const data = [
  { month: 'Jan', value: 1200, additionalInfo: 'New year campaign' },
  { month: 'Feb', value: 1800, additionalInfo: "Valentine's promotion" },
  { month: 'Mar', value: 1600, additionalInfo: 'Spring collection launch' },
  { month: 'Apr', value: 2200, additionalInfo: 'Easter sale' },
  { month: 'May', value: 2800, additionalInfo: 'Memorial day weekend' },
  { month: 'Jun', value: 3200, additionalInfo: 'Summer kickoff' },
];

export default function AdvancedChartWithTooltip() {
  return (
    <div className="h-[400px] w-full rounded-lg border bg-white p-6">
      <h3 className="mb-4 text-lg font-medium">Monthly Revenue</h3>
      <ChartContainer
        config={{
          value: {
            label: 'Revenue',
            color: 'hsl(215, 100%, 60%)',
          },
        }}
        className="h-[300px]"
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(215, 100%, 60%)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="hsl(215, 100%, 60%)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="month" axisLine={false} tickLine={false} />
            <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`} />
            {/* Using our custom tooltip */}
            <ChartTooltip
              content={<DetailedChartTooltip />}
              cursor={{
                stroke: 'hsl(215, 100%, 60%)',
                strokeWidth: 1,
                strokeDasharray: '5 5',
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="hsl(215, 100%, 60%)"
              fillOpacity={1}
              fill="url(#colorValue)"
              // Improve the dot appearance on hover
              activeDot={{
                r: 6,
                stroke: 'white',
                strokeWidth: 2,
                fill: 'hsl(215, 100%, 60%)',
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}
