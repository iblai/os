'use client';

import * as React from 'react';
import * as RechartsPrimitive from 'recharts';

import { cn } from '@/lib/utils';

const THEMES = { light: '', dark: '.dark' } as const;

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode;
    icon?: React.ComponentType;
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  );
};

type ChartContextProps = {
  config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);

  if (!context) {
    throw new Error('useChart must be used within a <ChartContainer />');
  }

  return context;
}

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & {
    config: ChartConfig;
    children: React.ComponentProps<
      typeof RechartsPrimitive.ResponsiveContainer
    >['children'];
    whiteLabels?: boolean;
    showDataPointsOnHover?: boolean;
  }
>(
  (
    {
      id,
      className,
      children,
      config,
      whiteLabels,
      showDataPointsOnHover = true,
      ...props
    },
    ref,
  ) => {
    const uniqueId = React.useId();
    const chartId = `chart-${id || uniqueId.replace(/:/g, '')}`;
    const chartRef = React.useRef<HTMLDivElement>(null);
    const [activeIndex, setActiveIndex] = React.useState<number | null>(null);

    const [hoverData, setHoverData] = React.useState<any>(null);
    const [mousePosition] = React.useState({ x: 0, y: 0 });

    // Create CSS variables for each color in the config
    const style = Object.entries(config).reduce(
      (acc, [key, value]) => {
        if (
          value &&
          typeof value === 'object' &&
          'color' in value &&
          typeof value.color === 'string'
        ) {
          acc[`--color-${key}`] = value.color;
        }
        return acc;
      },
      {} as Record<string, string>,
    );

    return (
      <ChartContext.Provider value={{ config }}>
        <div
          data-chart={chartId}
          ref={(node) => {
            // Handle both the forwarded ref and our local ref
            if (typeof ref === 'function') ref(node);
            else if (ref) ref.current = node;
            chartRef.current = node;
          }}
          className={cn(
            "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-dot]:hover:stroke-primary [&_.recharts-dot]:hover:r-4 relative flex h-full w-full flex-col items-center justify-center overflow-hidden pl-4 text-xs [&_.recharts-area-area]:!fill-blue-200 [&_.recharts-area-curve]:!stroke-blue-600 [&_.recharts-bar_.recharts-rectangle]:!fill-blue-500 [&_.recharts-bar-rectangle]:!fill-blue-500 [&_.recharts-bar-rectangle]:transition-all [&_.recharts-bar-rectangle]:duration-200 [&_.recharts-bar-rectangle]:hover:cursor-pointer [&_.recharts-bar-rectangle]:hover:opacity-80 [&_.recharts-bar-rectangle]:hover:brightness-110 [&_.recharts-bar-rectangle]:hover:filter [&_.recharts-bar-rectangles]:!gap-8 [&_.recharts-cartesian-axis]:m-0 [&_.recharts-cartesian-grid]:mx-0 [&_.recharts-dot]:transition-all [&_.recharts-dot]:duration-200 [&_.recharts-dot]:hover:stroke-2 [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-line_.recharts-line-curve]:!stroke-blue-600 [&_.recharts-line-curve]:!stroke-blue-600 [&_.recharts-responsive-container]:h-full [&_.recharts-responsive-container]:w-full [&_.recharts-sector]:outline-none [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-surface]:outline-none [&_.recharts-wrapper]:!mx-auto [&_.recharts-wrapper]:h-full [&_.recharts-wrapper]:w-full [&_.recharts-wrapper]:p-0 [&_.recharts-wrapper_svg]:overflow-visible [&_.recharts-yAxis_.recharts-cartesian-axis-line]:translate-x-0 [&_.recharts-yAxis_.recharts-cartesian-axis-tick_text]:text-sm [&_.recharts-yAxis_.recharts-cartesian-axis-tick-line]:translate-x-0 [&_.recharts-yAxis_.recharts-cartesian-axis-tick-value]:translate-x-0",
            whiteLabels &&
              '[&_.recharts-bar-rectangle_text]:fill-white [&_.recharts-bar-rectangle_text]:font-medium',
            className,
          )}
          style={style}
          {...props}
        >
          <ChartStyle id={chartId} config={config} />

          {/* Enhanced data point tooltip */}
          {hoverData && showDataPointsOnHover && (
            <div
              className="bg-background border-border pointer-events-none absolute z-50 rounded-md border p-2 text-sm shadow-md"
              style={{
                left: `${mousePosition.x + 10}px`,
                top: `${mousePosition.y - 40}px`,
                transform:
                  mousePosition.x >
                  (typeof window !== 'undefined' ? window.innerWidth - 200 : 0)
                    ? 'translateX(-100%)'
                    : 'none',
              }}
            >
              {activeIndex !== null ? (
                <div className="space-y-1">
                  {hoverData.date && (
                    <div className="text-foreground mb-1 font-medium">
                      {hoverData.date}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <div className="bg-primary h-3 w-3 rounded-sm"></div>
                      <span className="text-muted-foreground">
                        {hoverData.name || 'Value'}
                      </span>
                    </div>
                    <span className="font-medium">{hoverData.value}</span>
                  </div>
                </div>
              ) : (
                <div className="text-muted-foreground">
                  Hover over a data point for details
                </div>
              )}
            </div>
          )}

          <RechartsPrimitive.ResponsiveContainer width="100%" height="100%">
            {typeof children === 'function'
              ? // @ts-expect-error - children function type inference issue with Recharts complex callback types
                children({ activeIndex, setActiveIndex, setHoverData })
              : children}
          </RechartsPrimitive.ResponsiveContainer>
        </div>
      </ChartContext.Provider>
    );
  },
);
ChartContainer.displayName = 'Chart';

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(
    ([, config]) => config.theme || config.color,
  );

  if (!colorConfig.length) {
    return null;
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, itemConfig]) => {
    const color =
      itemConfig.theme?.[theme as keyof typeof itemConfig.theme] ||
      itemConfig.color;
    return color ? `  --color-${key}: ${color};` : null;
  })
  .join('\n')}
}
`,
          )
          .join('\n'),
      }}
    />
  );
};

// @ts-expect-error - Complex interface extension issue with ChartTooltipContent component
interface ChartTooltipProps
  extends React.ComponentPropsWithoutRef<typeof ChartTooltipContent> {
  className?: string;
  content?: React.ReactNode;
  cursor?: Record<string, any>;
}

const ChartTooltip = ({ className, content, ...props }: ChartTooltipProps) => {
  // If custom content is provided, use it, otherwise use our default content
  return (
    <RechartsPrimitive.Tooltip
      // @ts-expect-error - Complex Recharts tooltip content type compatibility issue
      content={
        content ||
        ((tooltipProps) => (
          // @ts-expect-error - Complex Recharts ChartTooltipContent type compatibility issue
          <ChartTooltipContent
            className={className}
            {...tooltipProps}
            {...props}
          />
        ))
      }
      cursor={{ strokeDasharray: '3 3' }}
      wrapperStyle={{ outline: 'none' }}
    />
  );
};

interface ChartTooltipContentProps
  extends React.HTMLAttributes<HTMLDivElement> {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: string | number;

    payload?: Record<string, any>;
    dataKey?: string;
    color?: string;
  }>;
  label?: string;
}

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  ChartTooltipContentProps
>(({ className, active, payload, label, ...props }, ref) => {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div
      ref={ref}
      className={cn(
        'border-border bg-background rounded-md border p-2 text-sm shadow-md',
        className,
      )}
      {...props}
    >
      {label && <div className="text-foreground mb-1 font-medium">{label}</div>}
      <div className="space-y-1">
        {payload.map((item, index) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <div
                className="h-3 w-3 rounded-sm"
                style={{
                  backgroundColor: item.color || `var(--color-${item.dataKey})`,
                }}
              />
              <span className="text-muted-foreground">
                {item.name || item.dataKey}
              </span>
            </div>
            <span className="font-medium">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
});
ChartTooltipContent.displayName = 'ChartTooltipContent';

const ChartLegend = RechartsPrimitive.Legend;

const ChartLegendContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> &
    Pick<RechartsPrimitive.LegendProps, 'payload' | 'verticalAlign'> & {
      hideIcon?: boolean;
      nameKey?: string;
    }
>(
  (
    { className, hideIcon = false, payload, verticalAlign = 'bottom', nameKey },
    ref,
  ) => {
    const { config } = useChart();

    if (!payload?.length) {
      return null;
    }

    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center justify-center gap-4',
          verticalAlign === 'top' ? 'pb-3' : 'pt-3',
          className,
        )}
      >
        {payload.map((item) => {
          const key = `${nameKey || item.dataKey || 'value'}`;
          const itemConfig = getPayloadConfigFromPayload(config, item, key);

          return (
            <div
              key={item.value}
              className={cn(
                '[&>svg]:text-muted-foreground flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3',
              )}
            >
              {itemConfig?.icon && !hideIcon ? (
                <itemConfig.icon />
              ) : (
                <div
                  className="h-2 w-2 shrink-0 rounded-[2px]"
                  style={{
                    backgroundColor: item.color,
                  }}
                />
              )}
              {itemConfig?.label}
            </div>
          );
        })}
      </div>
    );
  },
);
ChartLegendContent.displayName = 'ChartLegend';

// Helper to extract item config from a payload.
function getPayloadConfigFromPayload(
  config: ChartConfig,
  payload: unknown,
  key: string,
) {
  if (typeof payload !== 'object' || payload === null) {
    return undefined;
  }

  const payloadPayload =
    'payload' in payload &&
    typeof payload.payload === 'object' &&
    payload.payload !== null
      ? payload.payload
      : undefined;

  let configLabelKey: string = key;

  if (
    key in payload &&
    typeof payload[key as keyof typeof payload] === 'string'
  ) {
    configLabelKey = payload[key as keyof typeof payload] as string;
  } else if (
    payloadPayload &&
    key in payloadPayload &&
    typeof payloadPayload[key as keyof typeof payloadPayload] === 'string'
  ) {
    configLabelKey = payloadPayload[
      key as keyof typeof payloadPayload
    ] as string;
  }

  return configLabelKey in config
    ? config[configLabelKey]
    : config[key as keyof typeof config];
}

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
  useChart,
};
