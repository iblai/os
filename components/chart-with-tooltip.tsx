'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

// Sample data
const data = [
  { month: 'Jan', value: 1200 },
  { month: 'Feb', value: 1800 },
  { month: 'Mar', value: 1600 },
  { month: 'Apr', value: 2200 },
  { month: 'May', value: 2800 },
  { month: 'Jun', value: 3200 },
];

export default function ChartWithTooltip() {
  return (
    <div className="h-[400px] w-full rounded-lg border bg-white p-6">
      <h3 className="mb-4 text-lg font-medium">Monthly Performance</h3>
      <ChartContainer
        config={{
          value: {
            label: 'Value',
            color: 'hsl(var(--chart-1))',
          },
        }}
        className="h-[300px]"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#888', fontSize: 12 }}
            />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#888', fontSize: 12 }} />
            {/* This is the key part for tooltips */}
            <ChartTooltip
              cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
              content={<ChartTooltipContent />}
            />
            <Bar
              dataKey="value"
              fill="var(--color-value)"
              radius={[4, 4, 0, 0]}
              // Adding activeBar properties improves hover experience
              activeBar={{ fill: 'hsl(var(--chart-1))' }}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}
