import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import {
  OVERFLOW_ITEM_GAP,
  OVERFLOW_TRIGGER_WIDTH,
  estimatePillWidth,
  fitInlineCount,
  useOverflowFit,
} from '../use-overflow-fit';

describe('fitInlineCount', () => {
  it('keeps every item when they all fit, with no room reserved for the trigger', () => {
    // 80 + 90 + 130 + 2 gaps = 312
    expect(fitInlineCount(312, [80, 90, 130])).toBe(3);
    expect(fitInlineCount(311, [80, 90, 130])).toBeLessThan(3);
  });

  it('collapses from the END, one item at a time, reserving room for the trigger', () => {
    const widths = [80, 90, 130];
    // Two inline: 80 + 90 + trigger 32 + 2 gaps = 214
    expect(fitInlineCount(214, widths)).toBe(2);
    expect(fitInlineCount(213, widths)).toBe(1);
    // One inline: 80 + 32 + 1 gap = 118
    expect(fitInlineCount(118, widths)).toBe(1);
    expect(fitInlineCount(117, widths)).toBe(0);
  });

  it('never skips an item to fit a narrower one later in the sequence', () => {
    // The second pill is huge; the third would fit, but order wins.
    expect(fitInlineCount(150, [40, 500, 40])).toBe(1);
  });

  it('returns 0 when nothing fits and handles an empty list', () => {
    expect(fitInlineCount(0, [80])).toBe(0);
    expect(fitInlineCount(10, [])).toBe(0);
    expect(fitInlineCount(500, [])).toBe(0);
  });

  it('honours custom gap and trigger widths', () => {
    expect(fitInlineCount(100, [50, 50], { gap: 0, triggerWidth: 0 })).toBe(2);
    expect(fitInlineCount(100, [50, 50], { gap: 1, triggerWidth: 0 })).toBe(1);
  });

  it('uses the composer row constants by default', () => {
    expect(OVERFLOW_ITEM_GAP).toBe(6);
    expect(OVERFLOW_TRIGGER_WIDTH).toBe(32);
  });
});

describe('estimatePillWidth', () => {
  it('grows with the label and adds the active ✕ affordance', () => {
    expect(estimatePillWidth('Canvas')).toBe(16 + 16 + 6 + 6 * 7);
    expect(estimatePillWidth('Canvas', true)).toBe(
      estimatePillWidth('Canvas') + 16,
    );
    expect(estimatePillWidth('Deep Research')).toBeGreaterThan(
      estimatePillWidth('Canvas'),
    );
  });
});

// ---------------------------------------------------------------------------
// Hook — driven through a tiny harness with stubbed layout.
// ---------------------------------------------------------------------------

const ITEMS = [
  { key: 'a', estimate: 80 },
  { key: 'b', estimate: 90 },
  { key: 'c', estimate: 130 },
];

/** Stub layout: the root reports `root`; pills report their `data-w`. */
function stubLayout(root: number) {
  const original = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function () {
    const el = this as HTMLElement;
    let width = 0;
    if (el.getAttribute?.('data-root') !== null) width = root;
    const w = el.getAttribute?.('data-w');
    if (w) width = Number(w);
    return {
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      width,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect;
  };
  return () => {
    Element.prototype.getBoundingClientRect = original;
  };
}

function Harness({
  fixed = [] as { key: string; width: number }[],
}: {
  fixed?: { key: string; width: number }[];
}) {
  const fit = useOverflowFit(
    ITEMS,
    fixed.map((f) => f.key),
  );
  const count = fit.visibleCount;
  const inline = count === null ? ITEMS : ITEMS.slice(0, count);
  return (
    <div ref={fit.rootRef} data-root="">
      {fixed.map((f) => (
        <span key={f.key} ref={fit.itemRef(f.key)} data-w={f.width}>
          fixed-{f.key}
        </span>
      ))}
      {inline.map((item) => (
        <span
          key={item.key}
          ref={fit.itemRef(item.key)}
          data-w={item.estimate}
          data-testid={`inline-${item.key}`}
        >
          {item.key}
        </span>
      ))}
      <output data-testid="count">{count === null ? 'null' : count}</output>
    </div>
  );
}

describe('useOverflowFit', () => {
  let restore: (() => void) | undefined;
  afterEach(() => {
    restore?.();
    restore = undefined;
  });

  it('reports null (unmeasured) while the row has no width', async () => {
    restore = stubLayout(0);
    render(<Harness />);
    await waitFor(() =>
      expect(screen.getByTestId('count')).toHaveTextContent('null'),
    );
  });

  it('fits as many leading items as the measured row allows', async () => {
    restore = stubLayout(214);
    render(<Harness />);
    await waitFor(() =>
      expect(screen.getByTestId('count')).toHaveTextContent('2'),
    );
    expect(screen.getByTestId('inline-a')).toBeInTheDocument();
    expect(screen.getByTestId('inline-b')).toBeInTheDocument();
    expect(screen.queryByTestId('inline-c')).not.toBeInTheDocument();
  });

  it('subtracts always-inline (fixed) elements before fitting', async () => {
    // 214 fits two items alone; a 100px fixed pill (+ its gap) leaves 108,
    // which only fits one item (80 + trigger 32 + gap 6 = 118 > 108 → 0).
    restore = stubLayout(214);
    render(<Harness fixed={[{ key: 'code', width: 100 }]} />);
    await waitFor(() =>
      expect(screen.getByTestId('count')).toHaveTextContent('0'),
    );
  });

  it('re-fits when the row is resized', async () => {
    // Make ResizeObserver controllable for this test.
    const callbacks: ResizeObserverCallback[] = [];
    const OriginalRO = global.ResizeObserver;
    global.ResizeObserver = class {
      constructor(cb: ResizeObserverCallback) {
        callbacks.push(cb);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    try {
      restore = stubLayout(500);
      render(<Harness />);
      await waitFor(() =>
        expect(screen.getByTestId('count')).toHaveTextContent('3'),
      );

      // Shrink the row; the observer fires and the fit follows.
      restore();
      restore = stubLayout(118);
      for (const cb of callbacks) cb([], {} as ResizeObserver);
      await waitFor(() =>
        expect(screen.getByTestId('count')).toHaveTextContent('1'),
      );
    } finally {
      global.ResizeObserver = OriginalRO;
    }
  });
});
